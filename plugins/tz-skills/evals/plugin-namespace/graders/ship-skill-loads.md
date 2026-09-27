---
type: regex
target: trace
pattern: 'Launching skill: tz-skills:ship(?![\w-])[\s\S]*Base directory for this skill: [^"]*?skills[\\/]+ship(?![\w-])'
---

`tz-skills:ship` launched under its namespaced id and loaded from the plugin's own `skills/ship` directory. A failed lookup returns "Unknown skill" and prints neither line.
