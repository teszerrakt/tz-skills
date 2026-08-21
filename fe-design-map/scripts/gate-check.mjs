#!/usr/bin/env node
// Runs every CHECK in a gate ledger, records its output as EVIDENCE, and ticks
// the box only when EXPECT matches. The runner is the only thing that may tick a
// box: a box ticked by hand carries no evidence, and a gate with no evidence is
// unmet.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const file = process.argv[2];
if (!file) {
  console.error("usage: gate-check.mjs <ledger.md>");
  process.exit(2);
}

const lines = readFileSync(file, "utf8").split("\n");

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
// match first and a substring match second.
const matches = (expect, out) => {
  const re = expect.match(/^\/(.*)\/([gimsuy]*)$/);
  if (re) return new RegExp(re[1], re[2]).test(out);
  return out.trim() === expect.trim() || out.includes(expect);
};

const abandoned = () => gates.filter((g) => g.abandon).length;

let unmet = 0;
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
    out = execSync(gate.check, { shell: "/bin/bash", encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
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
}

writeFileSync(file, lines.join("\n"));
const total = gates.length - abandoned();
console.log(`\n${total - unmet}/${total} gates met, ${abandoned()} abandoned`);
process.exit(unmet === 0 ? 0 : 1);
