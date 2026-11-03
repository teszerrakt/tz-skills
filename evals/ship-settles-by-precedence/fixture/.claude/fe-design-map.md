# fe-design-map

## Sources

- Backend handover: `handover.md` at the repo root.
- Figma: the frames in `frames.md`.

## Precedence

- Handover vs staging: what the server sends and accepts (field names, nulls, error codes, which actions exist and whether they are enabled) follows staging, because the server owns the rule. What the screen shows (layout, copy, empty states, how a value reads) follows the Figma frames. Record each gap as a `Gap:` line and build on; ask only when staging returns a state no frame draws.
