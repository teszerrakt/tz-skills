/**
 * Symlinking shared by both entry points: `bin/install.ts` (bunx, clones first)
 * and `setup.ts` (local dev, links this checkout).
 *
 * Skills are directories holding a `SKILL.md`. Agents are `agents/*.md` — they
 * exist because the Agent tool takes a per-call model but no per-call tool list,
 * so a reviewer that must not hold `Edit` needs a file to say so.
 */

import {
  existsSync,
  readdirSync,
  statSync,
  symlinkSync,
  readlinkSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";

export const SKILLS_DIR = join(homedir(), ".claude/skills");
export const AGENTS_DIR = join(homedir(), ".claude/agents");

const NON_SKILL_DIRS = new Set([
  "bin",
  "_shared",
  "agents",
  "docs",
  "node_modules",
  ".git",
]);

function isSkill(repoRoot: string, entry: string): boolean {
  if (entry.startsWith(".")) return false;
  if (NON_SKILL_DIRS.has(entry)) return false;
  try {
    const path = join(repoRoot, entry);
    return statSync(path).isDirectory() && existsSync(join(path, "SKILL.md"));
  } catch {
    return false;
  }
}

/** Every linkable thing in the repo, as {source, targetDir, name} triples. */
export function discover(
  repoRoot: string
): { source: string; targetDir: string; name: string }[] {
  const skills = readdirSync(repoRoot)
    .filter((entry) => isSkill(repoRoot, entry))
    .map((name) => ({
      source: join(repoRoot, name),
      targetDir: SKILLS_DIR,
      name,
    }));

  const agentsDir = join(repoRoot, "agents");
  const agents = existsSync(agentsDir)
    ? readdirSync(agentsDir)
        .filter((entry) => entry.endsWith(".md"))
        .map((name) => ({
          source: join(agentsDir, name),
          targetDir: AGENTS_DIR,
          name,
        }))
    : [];

  return [...skills, ...agents];
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`Created ${dir}`);
  }
}

/** Where an existing target points, or null when it is not a symlink. */
function pointsAt(target: string): string | null {
  try {
    return resolve(dirname(target), readlinkSync(target));
  } catch {
    return null;
  }
}

export function linkAll(entries: ReturnType<typeof discover>): void {
  let linked = 0;
  let ok = 0;

  for (const { source, targetDir, name } of entries) {
    ensureDir(targetDir);
    const target = join(targetDir, name);

    if (existsSync(target)) {
      const current = pointsAt(target);
      if (current === source) {
        console.log(`  ok    ${name} (already linked)`);
        ok++;
      } else if (current) {
        console.log(`  skip  ${name} (symlink points elsewhere: ${current})`);
      } else {
        console.log(`  skip  ${name} (non-symlink already at ${target})`);
      }
      continue;
    }

    symlinkSync(source, target);
    console.log(`  link  ${name}`);
    linked++;
  }

  console.log(`\nDone. ${linked} linked, ${ok} already present.`);
}

export function unlinkAll(entries: ReturnType<typeof discover>): void {
  for (const { source, targetDir, name } of entries) {
    const target = join(targetDir, name);
    if (!existsSync(target)) continue;

    const current = pointsAt(target);
    if (current === null) {
      console.log(`  skip  ${name} (not a symlink, refusing to delete)`);
      continue;
    }
    if (current !== source) {
      console.log(`  skip  ${name} (symlink points elsewhere)`);
      continue;
    }

    unlinkSync(target);
    console.log(`  rm    ${name}`);
  }
}
