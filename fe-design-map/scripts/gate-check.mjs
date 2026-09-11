#!/usr/bin/env node
// Runs every CHECK in a gate ledger, records its output as EVIDENCE, and ticks
// the box only when EXPECT matches. The runner is the only thing that may tick a
// box: a box ticked by hand carries no evidence, and a gate with no evidence is
// unmet.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

// --dry inverts the exit code: it passes only when every gate FAILS. Run it at
// chart time, before any harvest. A gate that already passes on an empty fact
// base proves nothing later, and that is how both of this script's own bugs
// survived a full run (2026-09-10).
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: gate-check.mjs [--dry] <ledger.md>");
  process.exit(2);
}

const lines = readFileSync(file, "utf8").split("\n");

// $FB comes from the ledger's own `FB:` header, not the caller's environment. An
// unexported FB used to run every CHECK against `/`, which overwrote each
// EVIDENCE line with a path error and unticked a met gate.
const fbHeader = lines.find((l) => /^FB:\s*\S/.test(l));
const env = { ...process.env };
if (fbHeader) env.FB = fbHeader.replace(/^FB:\s*/, "").trim();
if (!env.FB) {
  console.error(`${file}: no \`FB:\` header and no FB in the environment`);
  process.exit(2);
}

const gates = [];
let current = null;
lines.forEach((line, i) => {
  const head = line.match(/^- \[([ xX])\] (G\d+)\s+(.*)$/);
  if (head) {
    current = { head: i, id: head[2], title: head[3], check: null, expect: null, evidence: null };
    gates.push(current);
    return;
  }
  if (!current) return;
  const check = line.match(/^\s+CHECK:\s*(.*)$/);
  if (check) return void (current.check = check[1]);
  const expect = line.match(/^\s+EXPECT:\s*(.*)$/);
  if (expect) return void (current.expect = expect[1]);
  if (/^\s+EVIDENCE:/.test(line)) return void (current.evidence = i);
  if (/^\s+ABANDON:\s*\S/.test(line)) return void (current.abandon = line.trim());
  if (line.trim() === "") current = null;
});

// EXPECT is a /regex/ when it is slash-delimited, otherwise an exact trimmed
// match first and a substring match second. Two rules the obvious version gets
// wrong, both found by gates that could not fail (2026-09-10):
//   - Match against trimmed output. A CHECK is a shell command, and `wc` /
//     `grep -c` always end theirs with a newline that JS `$` will not match past
//     without the `m` flag, so every /^...$/ EXPECT was unpassable.
//   - The substring fallback must land on a word boundary, or EXPECT `MATCH` is
//     satisfied by output reading `MISMATCH` and the gate tests nothing.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matches = (expect, out) => {
  const trimmed = out.trim();
  const re = expect.match(/^\/(.*)\/([gimsuy]*)$/);
  if (re) return new RegExp(re[1], re[2]).test(trimmed);
  if (trimmed === expect.trim()) return true;
  return new RegExp(`(^|\\W)${escapeRe(expect.trim())}($|\\W)`).test(out);
};

const abandoned = () => gates.filter((g) => g.abandon).length;

let unmet = 0;
const vacuous = [];
for (const gate of gates) {
  if (gate.abandon) {
    console.log(`ABANDONED ${gate.id} ${gate.title} — ${gate.abandon}`);
    continue;
  }
  if (!gate.check || gate.expect === null) {
    console.log(`MALFORMED ${gate.id} ${gate.title} — no CHECK or no EXPECT`);
    unmet++;
    continue;
  }
  let out = "";
  let threw = false;
  try {
    out = execSync(gate.check, { shell: "/bin/bash", encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env });
  } catch (err) {
    out = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim() || String(err.message);
    threw = true;
  }
  const digest = out.trim().split("\n").slice(0, 3).join(" | ") || "(no output)";
  const pass = !threw && matches(gate.expect, out);
  lines[gate.head] = lines[gate.head].replace(/^- \[[ xX]\]/, pass ? "- [x]" : "- [ ]");
  if (gate.evidence !== null) {
    const indent = lines[gate.evidence].match(/^\s*/)[0];
    lines[gate.evidence] = `${indent}EVIDENCE: ${digest}`;
  }
  console.log(`${pass ? "PASS" : "FAIL"} ${gate.id} ${gate.title} -> ${digest}`);
  if (!pass) unmet++;
  if (dry && pass) vacuous.push(`${gate.id} ${gate.title} -> ${digest}`);
}

const total = gates.length - abandoned();

if (dry) {
  // A dry run must not leave ticks or evidence behind: nothing has been
  // harvested, so every box goes back to unticked and pending.
  for (const gate of gates) {
    lines[gate.head] = lines[gate.head].replace(/^- \[[ xX]\]/, "- [ ]");
    if (gate.evidence !== null) {
      const indent = lines[gate.evidence].match(/^\s*/)[0];
      lines[gate.evidence] = `${indent}EVIDENCE: pending`;
    }
  }
  writeFileSync(file, lines.join("\n"));
  console.log(`\ndry run: ${total - vacuous.length}/${total} gates correctly fail on an empty fact base`);
  if (vacuous.length) {
    console.log("\nThese gates pass before any work exists, so they can never prove it:");
    for (const v of vacuous) console.log(`  VACUOUS ${v}`);
    console.log("\nTighten each one, or state in the ledger why it is knowingly vacuous.");
  }
  process.exit(vacuous.length === 0 ? 0 : 1);
}

writeFileSync(file, lines.join("\n"));
console.log(`\n${total - unmet}/${total} gates met, ${abandoned()} abandoned`);
process.exit(unmet === 0 ? 0 : 1);
