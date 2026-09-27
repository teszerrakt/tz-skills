#!/usr/bin/env bun
/**
 * `bunx @teszerrakt/skills` entry point: add the marketplaces, then install the
 * plugin. Matt Pocock's plugin installs as its dependency from Claude's official
 * marketplace, which a bare config lacks, so that marketplace is added too.
 *
 *   bunx @teszerrakt/skills              install
 *   bunx @teszerrakt/skills --uninstall  uninstall the plugin
 */

const MARKETPLACES = [
  "anthropics/claude-plugins-official",
  "teszerrakt/tz-skills",
];
const PLUGIN = "tz-skills@teszerrakt";

function plugin(...args: string[]): void {
  const { exitCode } = Bun.spawnSync(["claude", "plugin", ...args], {
    stdio: ["inherit", "inherit", "inherit"],
  });
  if (exitCode !== 0) process.exit(exitCode ?? 1);
}

if (process.argv.includes("--uninstall")) {
  plugin("uninstall", PLUGIN);
} else {
  for (const source of MARKETPLACES) plugin("marketplace", "add", source);
  plugin("install", PLUGIN);
}
