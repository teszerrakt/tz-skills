---
type: regex
target: trace
pattern: 'Base directory for this skill: [^"]*?skills[\\/]+ship(?![\w-])'
---

`tz-skills:ship` loaded from the plugin's own `skills/ship` directory. A failed lookup returns "Unknown skill" and never prints this line.
