# Publish

## With the Artifact tool

1. Publish `<fb>/design-map.html`, rendered with `--inline`, so every crop is built into the page. No asset upload is needed: a map's crops come to about 1MB, and the page limit is 16MB.
2. Above 12MB, render without `--inline`, upload each crop the page uses as an asset of the artifact (this needs the page's `assets` capability), write `<fb>/images.json` mapping each `img/crops/<file>.png` to the URL the upload returned, and render again with `--images <fb>/images.json`.
3. On a refresh, or when `meta.json` holds an artifact URL, update that artifact rather than creating a new one. Keep the URL in `meta.json`.

## Without it

The session has no Artifact tool when the client runs Claude Code as an SDK session without artifacts enabled (T3 Code, other Agent SDK hosts). The tool is absent, not refused.

1. Render without `--inline`: images then keep absolute local paths, which `html_render` inlines itself, and the page text stays under its 512KB limit. Call `html_render` with that HTML and a height of 2000.
2. Add one line to the reply: the Artifact tool needs `CLAUDE_CODE_ARTIFACT=1` (and `CLAUDE_CODE_ARTIFACT_AUTO_OPEN=0` on a remote host) in the client's Claude environment variables, then a new session.

When neither tool exists, give the path of `design-map.html` and say the page has to be opened on this machine.
