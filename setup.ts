#!/usr/bin/env bun
/**
 * Symlink each `learn-*` skill in this repo into `~/.claude/skills/`.
 * Idempotent: skips skills already linked to this repo, warns on conflicts.
 *
 * Usage:
 *   bun run setup            # install
 *   bun run setup --uninstall  # remove our symlinks
 */

import { readdirSync, statSync, existsSync, symlinkSync, unlinkSync, readlinkSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

const repoRoot = resolve(import.meta.dir);
const skillsDir = join(homedir(), ".claude/skills");

function isSkillDir(name: string): boolean {
  const path = join(repoRoot, name);
  return (
    statSync(path).isDirectory() &&
    existsSync(join(path, "SKILL.md"))
  );
}

function discoverSkills(): string[] {
  return readdirSync(repoRoot)
    .filter((entry) => !entry.startsWith(".") && entry !== "node_modules")
    .filter((entry) => {
      try {
        return isSkillDir(entry);
      } catch {
        return false;
      }
    });
}

function install(): void {
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true });
    console.log(`created ${skillsDir}`);
  }

  const skills = discoverSkills();
  if (skills.length === 0) {
    console.log("no skills found in repo");
    return;
  }

  for (const skill of skills) {
    const source = join(repoRoot, skill);
    const target = join(skillsDir, skill);

    if (existsSync(target)) {
      try {
        const linkTarget = readlinkSync(target);
        if (resolve(linkTarget) === source) {
          console.log(`  ok    ${skill} (already linked)`);
          continue;
        }
        console.log(`  skip  ${skill} (symlink to different location: ${linkTarget})`);
      } catch {
        console.log(`  skip  ${skill} (non-symlink already exists at ${target})`);
      }
      continue;
    }

    symlinkSync(source, target);
    console.log(`  link  ${skill}`);
  }

  console.log(`\ndone. ${skills.length} skill(s) processed.`);
}

function uninstall(): void {
  const skills = discoverSkills();

  for (const skill of skills) {
    const source = join(repoRoot, skill);
    const target = join(skillsDir, skill);

    if (!existsSync(target)) {
      console.log(`  skip  ${skill} (not installed)`);
      continue;
    }

    try {
      const linkTarget = readlinkSync(target);
      if (resolve(linkTarget) !== source) {
        console.log(`  skip  ${skill} (symlink points elsewhere: ${linkTarget})`);
        continue;
      }
    } catch {
      console.log(`  skip  ${skill} (not a symlink, refusing to delete)`);
      continue;
    }

    unlinkSync(target);
    console.log(`  rm    ${skill}`);
  }

  console.log("\ndone.");
}

const action = process.argv.includes("--uninstall") ? uninstall : install;
action();
