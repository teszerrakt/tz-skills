#!/usr/bin/env bun
/**
 * `bunx tz-skills` entry point.
 *
 * Bootstraps an installable clone of github.com/teszerrakt/tz-skills, then
 * symlinks each skill directory into `~/.claude/skills/`.
 *
 * Clone target:
 *   $TZ_SKILLS_DIR if set, else ~/.local/share/tz-skills
 *
 * Subsequent invocations pull the latest from main, then refresh symlinks.
 *
 * Subcommands:
 *   bunx tz-skills              install or update
 *   bunx tz-skills --uninstall  remove our symlinks (leaves clone in place)
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
import { $ } from "bun";

const REPO_URL = "https://github.com/teszerrakt/tz-skills.git";
const DEFAULT_TARGET = join(homedir(), ".local/share/tz-skills");
const SKILLS_DIR = join(homedir(), ".claude/skills");
const NON_SKILL_DIRS = new Set(["bin", "_shared", "node_modules", ".git"]);

function targetDir(): string {
  return process.env.TZ_SKILLS_DIR ?? DEFAULT_TARGET;
}

function isSkill(repoRoot: string, entry: string): boolean {
  if (entry.startsWith(".")) return false;
  if (NON_SKILL_DIRS.has(entry)) return false;
  const skillPath = join(repoRoot, entry);
  try {
    return (
      statSync(skillPath).isDirectory() &&
      existsSync(join(skillPath, "SKILL.md"))
    );
  } catch {
    return false;
  }
}

function discoverSkills(repoRoot: string): string[] {
  return readdirSync(repoRoot).filter((entry) => isSkill(repoRoot, entry));
}

async function ensureClone(target: string): Promise<void> {
  if (existsSync(target)) {
    if (!existsSync(join(target, ".git"))) {
      console.error(
        `Refusing to update: ${target} exists but is not a git checkout. ` +
          `Remove it or set $TZ_SKILLS_DIR.`
      );
      process.exit(1);
    }
    console.log(`Updating clone at ${target}`);
    await $`git -C ${target} pull --ff-only`.quiet();
    return;
  }

  console.log(`Cloning ${REPO_URL} → ${target}`);
  mkdirSync(dirname(target), { recursive: true });
  await $`git clone --depth=1 ${REPO_URL} ${target}`.quiet();
}

function ensureSkillsDir(): void {
  if (!existsSync(SKILLS_DIR)) {
    mkdirSync(SKILLS_DIR, { recursive: true });
    console.log(`Created ${SKILLS_DIR}`);
  }
}

function linkSkill(repoRoot: string, skill: string): "linked" | "ok" | "conflict" {
  const source = join(repoRoot, skill);
  const target = join(SKILLS_DIR, skill);

  if (existsSync(target)) {
    try {
      const link = readlinkSync(target);
      const linkAbs = resolve(dirname(target), link);
      if (linkAbs === source) return "ok";
      console.log(`  skip  ${skill} (symlink points elsewhere: ${link})`);
      return "conflict";
    } catch {
      console.log(`  skip  ${skill} (non-symlink already at ${target})`);
      return "conflict";
    }
  }

  symlinkSync(source, target);
  return "linked";
}

function unlinkSkill(repoRoot: string, skill: string): "removed" | "skip" {
  const source = join(repoRoot, skill);
  const target = join(SKILLS_DIR, skill);

  if (!existsSync(target)) return "skip";
  try {
    const link = readlinkSync(target);
    const linkAbs = resolve(dirname(target), link);
    if (linkAbs !== source) {
      console.log(`  skip  ${skill} (symlink points elsewhere)`);
      return "skip";
    }
  } catch {
    console.log(`  skip  ${skill} (not a symlink, refusing to delete)`);
    return "skip";
  }
  unlinkSync(target);
  return "removed";
}

async function install(): Promise<void> {
  const target = targetDir();
  await ensureClone(target);
  ensureSkillsDir();

  const skills = discoverSkills(target);
  if (skills.length === 0) {
    console.log(`No skills found in ${target}`);
    return;
  }

  let linked = 0;
  let ok = 0;
  for (const skill of skills) {
    const result = linkSkill(target, skill);
    if (result === "linked") {
      console.log(`  link  ${skill}`);
      linked++;
    } else if (result === "ok") {
      console.log(`  ok    ${skill} (already linked)`);
      ok++;
    }
  }

  console.log(
    `\nDone. ${linked} linked, ${ok} already present. Clone at ${target}.`
  );
}

async function uninstall(): Promise<void> {
  const target = targetDir();
  if (!existsSync(target)) {
    console.log(`No clone found at ${target}; nothing to unlink.`);
    return;
  }
  const skills = discoverSkills(target);
  for (const skill of skills) {
    const result = unlinkSkill(target, skill);
    if (result === "removed") console.log(`  rm    ${skill}`);
  }
  console.log(`\nDone. Clone left in place at ${target}.`);
}

const action = process.argv.includes("--uninstall") ? uninstall : install;
action().catch((err) => {
  console.error(err);
  process.exit(1);
});
