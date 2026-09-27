#!/usr/bin/env bun
// `bunx @teszerrakt/skills [--uninstall]`.

// Matt Pocock's plugin installs as a dependency from Claude's official
// marketplace, which a bare config lacks.
const MARKETPLACES = [
  "anthropics/claude-plugins-official",
  "teszerrakt/tz-skills",
];
const PLUGIN = "tz-skills@teszerrakt";

function claudePlugin(...args: string[]): void {
  const { exitCode } = Bun.spawnSync(["claude", "plugin", ...args], {
    stdio: ["inherit", "inherit", "inherit"],
  });
  if (exitCode !== 0) process.exit(exitCode ?? 1);
}

if (process.argv.includes("--uninstall")) {
  claudePlugin("uninstall", PLUGIN);
} else {
  for (const source of MARKETPLACES) claudePlugin("marketplace", "add", source);
  claudePlugin("install", PLUGIN);
}
