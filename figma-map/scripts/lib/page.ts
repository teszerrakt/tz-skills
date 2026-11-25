// The design map's fixed page parts: fonts, theme tokens, layout, and the runtime script for the contents rail, theme
// switch, crop viewer, review marks and comments. render.ts fills the content between them.
// The rail, theme switch, review checkbox and crop viewer are ui-sdk elements, loaded from browser/web.js, which
// references/publish.md ships beside the page: the Artifact CSP refuses scripts from ui-sdk.dev.

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Every color is a token, redefined for dark mode by system setting and by the theme switch. */
export function pageHead(title: string): string {
  return `<title>${escapeHtml(title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<script type="module" src="browser/web.js"></script>
<link rel="stylesheet" href="browser/web.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap">
<style>
@layer ui-sdk;
/* Layout: a review rail beside one reading column. Wide screens pin the rail; phones fold it into a sticky "Contents" bar. */
:root {
  --bg: #ffffff; --fg: #242424; --body: #333333; --muted: #6b6b6b; --faint: #8a8a8a;
  --line: #f0f0f0; --line-strong: #e6e6e6; --shot: #ececec; --chip: #f6f6f6; --card: #fbfbfb;
  --ok: #1a7f37; --ok-soft: #e6f4ea; --accent: #1d3f9e; --accent-soft: #e8eefc; --shade: rgba(0,0,0,.14);
  --rev-bg: #e6f4ea; --rev-fg: #14632b; --new-bg: #e8eefc; --new-fg: #1d3f9e;
  --con-bg: #fff1dc; --con-fg: #7a4a00; --nd-bg: #efefef; --nd-fg: #4d4d4d;
  --get-bg: #e3f5e9; --get-fg: #116329; --post-bg: #e5edff; --post-fg: #1d3f9e; --put-bg: #fff0d9; --put-fg: #8a4b00;
  --patch-bg: #f1e8ff; --patch-fg: #5b2a9e; --del-bg: #fde7e7; --del-fg: #a11d1d;
  --serif: 'Source Serif 4', Georgia, 'Times New Roman', serif;
  --sans: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: ui-monospace, Menlo, Consolas, monospace;
  --rail: 264px; --bar-h: 0px;
  --ui-background: var(--bg); --ui-foreground: var(--fg); --ui-muted: var(--chip); --ui-muted-foreground: var(--muted);
  --ui-border: var(--line-strong); --ui-input: var(--faint); --ui-primary: var(--ok); --ui-primary-foreground: #ffffff;
  --ui-ring: var(--accent-soft); --ui-ring-border: var(--accent); --ui-overlay: rgba(0,0,0,.5);
  --ui-radius: 6px; --ui-font-sans: var(--sans); --ui-font-size: 13px;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #121212; --fg: #e8e8e8; --body: #d0d0d0; --muted: #a3a3a3; --faint: #8f8f8f;
  --line: #262626; --line-strong: #333333; --shot: #2e2e2e; --chip: #1d1d1d; --card: #171717;
  --ok: #4ac26b; --ok-soft: #12301c; --accent: #a9c1ff; --accent-soft: #172447; --shade: rgba(0,0,0,.6);
  --rev-bg: #12301c; --rev-fg: #8fe0a8; --new-bg: #172447; --new-fg: #a9c1ff;
  --con-bg: #3a2a0c; --con-fg: #f3c27a; --nd-bg: #2a2a2a; --nd-fg: #c4c4c4; --get-bg: #12301c; --get-fg: #8fe0a8; --post-bg: #172447; --post-fg: #a9c1ff; --put-bg: #3a2a0c; --put-fg: #f3c27a; --patch-bg: #2a1d45; --patch-fg: #cdb2ff; --del-bg: #3d1616; --del-fg: #ff9e9e; --ui-primary-foreground: #0d1f12; --ui-overlay: rgba(0,0,0,.7); color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #121212; --fg: #e8e8e8; --body: #d0d0d0; --muted: #a3a3a3; --faint: #8f8f8f;
  --line: #262626; --line-strong: #333333; --shot: #2e2e2e; --chip: #1d1d1d; --card: #171717;
  --ok: #4ac26b; --ok-soft: #12301c; --accent: #a9c1ff; --accent-soft: #172447; --shade: rgba(0,0,0,.6);
  --rev-bg: #12301c; --rev-fg: #8fe0a8; --new-bg: #172447; --new-fg: #a9c1ff;
  --con-bg: #3a2a0c; --con-fg: #f3c27a; --nd-bg: #2a2a2a; --nd-fg: #c4c4c4; --get-bg: #12301c; --get-fg: #8fe0a8; --post-bg: #172447; --post-fg: #a9c1ff; --put-bg: #3a2a0c; --put-fg: #f3c27a; --patch-bg: #2a1d45; --patch-fg: #cdb2ff; --del-bg: #3d1616; --del-fg: #ff9e9e; --ui-primary-foreground: #0d1f12; --ui-overlay: rgba(0,0,0,.7); color-scheme: dark }
body { background: var(--bg); color: var(--fg); font-family: var(--serif); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); }
a { color: var(--fg); text-decoration: underline; text-decoration-color: var(--faint); text-underline-offset: 3px; }
a:hover { text-decoration-color: var(--fg); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
h1, h2, h3, h4 { font-family: var(--sans); text-wrap: balance; color: var(--fg); }
code { font: .88em var(--mono); }
.wrap { box-sizing: border-box; max-width: 1200px; margin: 0 auto;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
main { min-width: 0; padding-block: 40px 120px; container-type: inline-size; }

/* Phones: a sticky bar whose list drops over the page, so opening it never shifts the text. */
.rail { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 6; font-family: var(--sans);
  margin-inline: calc(-1 * max(16px, env(safe-area-inset-left, 0px))) calc(-1 * max(16px, env(safe-area-inset-right, 0px)));
  background: var(--bg); border-bottom: 1px solid var(--line-strong); }
.rail ui-collapsible { position: relative; }
.toc-toggle { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; border: 0; background: none; color: var(--fg); font: 500 14px var(--sans); text-align: left; cursor: pointer;
  padding: 0 max(16px, env(safe-area-inset-right, 0px)) 0 max(16px, env(safe-area-inset-left, 0px)); }
.toc-toggle:focus-visible { outline-offset: -2px; }
.toc-k { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.toc-current { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.toc-prog { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.rail-panel { position: absolute; inset: 100% 0 auto; max-height: min(72dvh, 600px); display: flex; flex-direction: column; overflow: hidden;
  padding: 12px max(16px, env(safe-area-inset-right, 0px)) 0 max(16px, env(safe-area-inset-left, 0px));
  background: var(--bg); border-bottom: 1px solid var(--line-strong); box-shadow: 0 16px 28px -16px var(--shade); }
.rail:not([data-ready]) .rail-panel { display: none; }
/* The rail's head (theme switch and progress) stays pinned; only the list under it scrolls. */
.rail-pin { flex: none; transition: box-shadow .15s; }
.rail-pin.scrolled { box-shadow: 0 1px 0 var(--line-strong); }
.rail-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; padding: 12px 4px 20px 0; }
@media (min-width: 1000px) {
  .wrap { display: grid; grid-template-columns: var(--rail) minmax(0, 1fr); gap: 64px; }
  /* Wide: the rail stays in view for the whole page; its list scrolls on its own when taller than the screen. */
  .rail { align-self: start; margin: 0; border: 0; padding-top: 40px; height: calc(100dvh - env(safe-area-inset-top, 0px)); box-sizing: border-box; display: flex; flex-direction: column; }
  .rail ui-collapsible { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
  .toc-toggle { display: none; }
  .rail .rail-panel, .rail:not([data-ready]) .rail-panel { position: static; display: flex; flex: 1 1 auto; min-height: 0; max-height: none; padding: 0; border: 0; box-shadow: none; background: none; }
}
.rail-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.kick { font-family: var(--sans); font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.rail-scroll > .kick { margin-bottom: 6px; }
.rail-group { margin: 20px 0 6px; }
.rl, .rs { display: flex; align-items: baseline; gap: 6px; text-decoration: none; border-left: 2px solid transparent; border-radius: 0 4px 4px 0; }
.rl { padding: 5px 8px; font-size: 13.5px; line-height: 19px; font-weight: 600; color: var(--fg); }
.rs { padding: 3px 8px 3px 22px; font-size: 13px; line-height: 18px; color: var(--muted); }
.rs.rs2 { padding-left: 36px; }
.rl:hover, .rs:hover { background: var(--chip); color: var(--fg); }
.rl[aria-current="true"], .rs[aria-current="true"] { border-left-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.dot { flex: 0 0 auto; width: 12px; height: 12px; display: inline-block; transform: translateY(1px); color: var(--ok); visibility: hidden; }
.dot svg { width: 12px; height: 12px; display: block; }
.done > .dot { visibility: visible; }
.progress { margin: 0 0 12px; font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
.bar { height: 4px; border-radius: 2px; background: var(--line-strong); margin-top: 6px; overflow: hidden; }
.bar > i { display: block; height: 100%; width: 0; background: var(--ok); transition: width .3s; }
.legend { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); display: grid; gap: 8px; font-size: 12.5px; color: var(--muted); }

/* Theme switch: match system, light, dark. */
.theme { position: relative; isolation: isolate; display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--line-strong); border-radius: 999px; background: var(--chip); box-shadow: none; }
.theme [data-slot="segmented-control-indicator"] { position: absolute; z-index: -1; top: var(--segmented-control-indicator-top); left: var(--segmented-control-indicator-left);
  width: var(--segmented-control-indicator-width); height: var(--segmented-control-indicator-height); border: 0; border-radius: 999px;
  background: var(--bg); box-shadow: 0 0 0 1px var(--line-strong), 0 1px 2px var(--shade); transition: left .2s ease, width .2s ease; }
.theme [data-slot="segmented-control-indicator"][data-activation-direction="none"] { transition: none; }
.theme [data-slot="segmented-control-item"] { display: grid; place-items: center; width: 28px; height: 24px; padding: 0; border: 0; border-radius: 999px; background: none; box-shadow: none; color: var(--faint); cursor: pointer; }
.theme [data-slot="segmented-control-item"]:hover, .theme [data-slot="segmented-control-item"][data-checked] { color: var(--fg); background: none; }
.theme [data-slot="segmented-control-item"]:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.theme svg { width: 14px; height: 14px; display: block; }

/* Reading column */
.head { max-width: 720px; }
.title { margin: 12px 0 0; font-size: 44px; line-height: 52px; font-weight: 700; letter-spacing: -0.02em; }
.lede { margin: 14px 0 0; font-size: 21px; line-height: 31px; color: var(--muted); }
.meta { margin-top: 22px; padding: 14px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 8px 24px; font-family: var(--sans); font-size: 14px; color: var(--muted); }
.meta a { color: var(--muted); }
.notice { margin-top: 16px; font-family: var(--sans); font-size: 13px; color: var(--muted); }
.intro { margin-top: 48px; }
.p { font-size: 20px; line-height: 32px; margin: 0 0 20px; max-width: 720px; color: var(--fg); }
.pp { margin: 0 0 14px; max-width: 720px; font-size: 18px; line-height: 29px; color: var(--body); }
.h2 { margin: 8px 0 12px; font-size: 32px; line-height: 40px; font-weight: 700; letter-spacing: -0.015em; }
.h3 { margin: 0 0 8px; font-size: 21px; line-height: 28px; font-weight: 700; }
.h4 { margin: 0 0 8px; font-size: 18px; line-height: 26px; font-weight: 700; }
.code { color: var(--muted); font-weight: 600; margin-right: 8px; font-variant-numeric: tabular-nums; }
section.sec { margin-top: 80px; }
.part { margin-top: 48px; }
.part.sub { margin-top: 32px; }
.ref { margin-top: 104px; padding-top: 48px; border-top: 1px solid var(--line-strong); }
table { border-collapse: collapse; font-family: var(--sans); color: var(--fg); }
table.k { width: 100%; max-width: 720px; margin-bottom: 32px; font-family: var(--serif); font-size: 18px; line-height: 28px; }
table.k td { vertical-align: top; padding: 12px 16px 12px 0; border-bottom: 1px solid var(--line); }
table.k ul { margin: 4px 0 0; padding-left: 20px; }
ul.items { margin: 0 0 14px; padding-left: 24px; max-width: 720px; }
ul.items li { font-size: 18px; line-height: 29px; margin-bottom: 4px; }
ul.items ul { margin: 4px 0 0; padding-left: 22px; }
.shared-link { margin: 0 0 18px; font-family: var(--sans); font-size: 14px; color: var(--muted); }
a.cite { font: 12px var(--sans); color: var(--muted); text-decoration: none; font-variant-numeric: tabular-nums; }
a.cite:hover { text-decoration: underline; }
ol.src { margin: 0; padding-left: 36px; max-width: 720px; font-family: var(--sans); font-size: 13px; line-height: 20px; color: var(--muted); }
ol.src li { margin-bottom: 6px; overflow-wrap: anywhere; }
ol.src a { color: var(--muted); }
.tg { display: inline-block; font: 600 11px/18px var(--sans); letter-spacing: .05em; text-transform: uppercase; padding: 1px 8px; border-radius: 999px; white-space: nowrap; }
.tg-rev { background: var(--rev-bg); color: var(--rev-fg); }
.tg-new { background: var(--new-bg); color: var(--new-fg); }
.tg-con { background: var(--con-bg); color: var(--con-fg); }
.tg-nd { background: var(--nd-bg); color: var(--nd-fg); }
.crop { max-width: 720px; margin: 0 0 18px; }
.shot { display: block; max-width: 100%; height: auto; border: 1px solid var(--shot); border-radius: 4px; background: #fff; }
.shot-btn { display: block; padding: 0; border: 0; background: none; cursor: zoom-in; border-radius: 4px; justify-self: start; align-self: start; max-width: 100%; }
.shot-btn + .shot-btn { margin-top: 8px; }
.shot-btn:hover .shot { border-color: var(--muted); }

/* Review strip */
.rv { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin: 0 0 18px; font-family: var(--sans); font-size: 13px; color: var(--muted); }
.rv-check { display: inline-flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 12px; border: 1px solid var(--line-strong); border-radius: 999px; background: var(--chip); color: var(--fg); font: 500 13px var(--sans); cursor: pointer; }
.rv-check:hover { border-color: var(--muted); }
.rv-check:has([data-checked]) { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
.rv-check:has([data-disabled]) { cursor: default; opacity: .6; }
.rv-check [data-slot="checkbox"][data-checked] { background: var(--ok); border-color: var(--ok); }
.rv-check svg { width: 10px; height: 10px; display: block; }
.rv-who { font-variant-numeric: tabular-nums; }
.cm-btn { font: 500 13px/18px var(--sans); color: var(--fg); background: none; border: 1px solid var(--line-strong); border-radius: 999px; padding: 6px 12px; min-height: 32px; cursor: pointer; }
.cm-btn:hover { border-color: var(--muted); background: var(--chip); }

/* Item bar: an item's heading and review strip stay pinned until the item ends. A part's bar covers its section's. */
.stick { position: sticky; top: var(--bar-h); z-index: 4; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px;
  min-height: 56px; box-sizing: border-box; padding: 8px 0; margin: 0 0 12px; background: var(--bg); border-bottom: 1px solid var(--line); }
.part > .stick { z-index: 5; box-shadow: 0 -48px 0 var(--bg); }
.part.sub > .stick { z-index: 6; }
.stick .h2, .stick .h3, .stick .h4 { margin: 0; flex: 1 1 auto; min-width: 0; }
.stick .h2 { font-size: 26px; line-height: 34px; }
.stick .rv { margin: 0; }
[id] { scroll-margin-top: calc(var(--bar-h) + 72px); }

/* Cross-references and REST methods */
a.xref { font-family: var(--sans); font-weight: 600; font-size: .9em; color: var(--accent); text-decoration: none; }
a.xref:hover { text-decoration: underline; }
.row:target { background: var(--accent-soft); }
.m { display: inline-block; font: 700 10.5px/16px var(--sans); letter-spacing: .04em; padding: 0 6px; border-radius: 4px; vertical-align: 1px; }
.m-get { background: var(--get-bg); color: var(--get-fg); }
.m-post { background: var(--post-bg); color: var(--post-fg); }
.m-put { background: var(--put-bg); color: var(--put-fg); }
.m-patch { background: var(--patch-bg); color: var(--patch-fg); }
.m-delete { background: var(--del-bg); color: var(--del-fg); }

/* Variants: one card per variant; the crop sits beside its notes once the column is wide enough. */
.variants { display: grid; gap: 12px; margin: 8px 0 18px; font-family: var(--sans); }
.variant { border: 1px solid var(--line-strong); border-radius: 8px; background: var(--card); padding: 14px 16px; }
.v-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-bottom: 12px; }
.vname { font-weight: 600; font-size: 15px; }
.v-head .fig { margin-left: auto; font-size: 12px; color: var(--muted); }
.v-body { display: grid; gap: 14px; font-size: 14px; line-height: 22px; color: var(--fg); }
@container (min-width: 640px) { .v-body { grid-template-columns: minmax(0, 300px) minmax(0, 1fr); } .v-body.no-shot { grid-template-columns: minmax(0, 1fr); } }
.lab { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--faint); margin: 0 0 4px; }
.blk + .blk { margin-top: 12px; }
.blk ul { margin: 0; padding-left: 18px; }
.blk li { margin-bottom: 4px; }
.blk.copy li { color: var(--body); }
.blk.notes li { color: var(--muted); }

/* Tables: rows that stack on a narrow column. */
.rows { font-family: var(--sans); border-top: 1px solid var(--line-strong); margin-bottom: 18px; }
.row { display: grid; gap: 4px 16px; padding: 14px 0; border-bottom: 1px solid var(--line); font-size: 15px; line-height: 23px; grid-template-columns: var(--narrow); }
.row > * { grid-column: -2; min-width: 0; }
.row > .n { grid-column: 1; font-weight: 600; font-variant-numeric: tabular-nums; }
.row > .c + .c { color: var(--body); }
.row.head { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); padding-top: 0; display: none; }
@container (min-width: 720px) {
  .row { grid-template-columns: var(--wide); }
  .row > * { grid-column: auto; }
  .row.head { display: grid; }
}

/* Crop viewer */
.zoom { width: min(1100px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); padding: 0; overflow: hidden; display: flex; flex-direction: column; background: var(--bg); color: var(--fg); border: 1px solid var(--line-strong); border-radius: 10px; box-shadow: 0 24px 60px -20px var(--shade); font-family: var(--sans); }
.zoom-bar { display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 16px; border-bottom: 1px solid var(--line-strong); }
.zoom-bar [data-slot="dialog-title"] { flex: 1; min-width: 0; font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.zoom-close { width: 32px; height: 32px; border: 1px solid var(--line-strong); border-radius: 6px; background: var(--chip); color: var(--fg); font-size: 16px; line-height: 1; cursor: pointer; }
.zoom-body { overflow: auto; padding: 16px; background: var(--chip); }
.zoom-body img { display: block; max-width: 100%; height: auto; margin: 0 auto; background: #fff; border-radius: 4px; }
@media (prefers-reduced-motion: reduce) { .bar > i, .theme [data-slot="segmented-control-indicator"], .rail-pin { transition: none; } * { scroll-behavior: auto !important; } }
</style>
`
}

export const CHECK =
  '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5 5 9.2 10 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

/** One item's Reviewed checkbox and comment button; both stay hidden until the runtime grants them. */
export function reviewStrip(id: string, label: string): string {
  return `<div class="rv" data-rv="${id}"><label class="rv-check" hidden><ui-checkbox data-id="${id}" aria-label="Mark ${escapeHtml(label)} reviewed" disabled><ui-checkbox-indicator>${CHECK}</ui-checkbox-indicator></ui-checkbox><span>Reviewed</span></label><span class="rv-who"></span><button type="button" class="cm-btn" data-cm="${id}" hidden>Comment</button></div>`
}

const THEMES = [
  [
    'system',
    'Match system',
    '<circle cx="8" cy="8" r="5.75" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 2.25a5.75 5.75 0 0 1 0 11.5Z" fill="currentColor"/>',
  ],
  [
    'light',
    'Light',
    '<circle cx="8" cy="8" r="2.75" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ],
  [
    'dark',
    'Dark',
    '<path d="M13.25 9.6A5.5 5.5 0 0 1 6.4 2.75a5.5 5.5 0 1 0 6.85 6.85Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  ],
] as const

/** The rail around its link list: a pinned head (theme switch, progress), then the list. `default-open` keeps it visible on a page opened without ui-sdk. */
export function railShell(title: string, links: string, count: number): string {
  const themes = THEMES.map(
    ([value, label, icon]) =>
      `<ui-segmented-control-item value="${value}" aria-label="${label}" title="${label}"><svg viewBox="0 0 16 16" aria-hidden="true">${icon}</svg></ui-segmented-control-item>`,
  ).join('')
  return `<nav class="rail" aria-label="Contents" id="rail"><ui-collapsible id="toc" default-open>
<ui-collapsible-trigger><button type="button" class="toc-toggle"><span class="toc-k">Contents</span><span class="toc-current">${escapeHtml(title)}</span><span class="toc-prog"></span></button></ui-collapsible-trigger>
<ui-collapsible-panel class="rail-panel"><div class="rail-pin"><div class="rail-head"><div class="kick">Review</div><ui-segmented-control id="theme" class="theme" aria-label="Theme" default-value="system"><ui-segmented-control-indicator></ui-segmented-control-indicator>${themes}</ui-segmented-control></div>
<div class="progress"><span id="prog-text">${count} parts to review</span><div class="bar"><i id="prog-bar"></i></div></div></div>
<div class="rail-scroll">${links}</div></ui-collapsible-panel></ui-collapsible></nav>`
}

export const CROP_VIEWER = `<ui-dialog id="zoom"><ui-dialog-backdrop hidden></ui-dialog-backdrop><ui-dialog-content class="zoom" hidden>
<div class="zoom-bar"><ui-dialog-title>Crop</ui-dialog-title><ui-dialog-close><button type="button" class="zoom-close" aria-label="Close">✕</button></ui-dialog-close></div>
<div class="zoom-body"><img alt=""></div></ui-dialog-content></ui-dialog>
`

/**
 * Each feature waits for its ui-sdk element, so the page still reads where ui-sdk never loads. The theme choice is a
 * per-viewer convenience in localStorage. Review marks live in the db (`reviews/<item id>`, `{reviewed, by, at}`) so
 * every viewer sees them; comments go to the shell's own thread store.
 */
export const PAGE_SCRIPT = `<script>
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const defined = (...tags) => Promise.all(tags.map((t) => customElements.whenDefined(t)));
  const wide = matchMedia("(min-width: 1000px)");
  const root = document.documentElement;
  const rail = $(".rail"), toc = $("#toc");

  // "Match system" hands the theme back to whatever the viewer app set on <html>, else the OS.
  const host = root.getAttribute("data-theme");
  let saved = "system";
  try { const t = localStorage.getItem("figma-map-theme"); if (t === "dark" || t === "light") saved = t; } catch (e) {}
  const applyTheme = (v) => {
    if (v === "light" || v === "dark") root.setAttribute("data-theme", v);
    else if (host) root.setAttribute("data-theme", host);
    else root.removeAttribute("data-theme");
  };
  applyTheme(saved);
  defined("ui-segmented-control").then(() => {
    const ctl = $("#theme");
    ctl.value = saved;
    ctl.addEventListener("valuechange", (e) => {
      applyTheme(e.detail.value);
      try { localStorage.setItem("figma-map-theme", e.detail.value); } catch (err) {}
    });
  });

  // Every crop opens full size in one shared dialog.
  for (const img of $$("main img.shot")) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "shot-btn";
    b.setAttribute("aria-label", "Enlarge: " + img.alt);
    img.replaceWith(b);
    b.append(img);
  }
  $("main").addEventListener("click", async (e) => {
    const b = e.target.closest(".shot-btn");
    if (!b) return;
    const img = b.querySelector("img");
    await defined("ui-dialog");
    $(".zoom-body img").src = img.src;
    $(".zoom-body img").alt = img.alt;
    const where = b.closest(".part, .sec, .ref")?.querySelector(".h4, .h3, .h2")?.textContent || "";
    $("#zoom ui-dialog-title").textContent = (where ? where + " · " : "") + (img.alt || "Crop");
    $("#zoom").api.open();
  });

  // Wide: the rail stays open beside the page. Phones: a closed bar; picking an entry or Escape closes it again.
  defined("ui-collapsible").then(() => {
    const list = $(".rail-scroll"), pin = $(".rail-pin"), current = $(".toc-current");
    const links = $$(".rail a[data-nav]");
    const byId = new Map(links.map((a) => [a.dataset.nav, a]));
    const targets = links.map((a) => document.getElementById(a.dataset.nav)).filter(Boolean);
    const fallback = current.textContent;
    let active = null;
    const spy = () => {
      const line = (wide.matches ? 0 : rail.offsetHeight) + Math.min(240, innerHeight * 0.3);
      const atEnd = innerHeight + scrollY >= root.scrollHeight - 4;
      let cur = null;
      for (const el of targets) if (atEnd || el.getBoundingClientRect().top <= line) cur = el;
      const a = cur ? byId.get(cur.id) : null;
      if (a === active) return;
      active?.removeAttribute("aria-current");
      active = a;
      current.textContent = a ? a.textContent.trim() : fallback;
      if (!a) return;
      a.setAttribute("aria-current", "true");
      if (wide.matches) {
        const r = a.getBoundingClientRect(), lr = list.getBoundingClientRect();
        if (r.top < lr.top + 40 || r.bottom > lr.bottom - 40) list.scrollTop += r.top - lr.top - lr.height / 2;
      }
    };
    const sync = () => {
      toc.open = wide.matches;
      root.style.setProperty("--bar-h", (wide.matches ? 0 : rail.offsetHeight) + "px");
      spy();
    };
    rail.addEventListener("click", (e) => {
      const a = e.target.closest("a[href^='#']");
      const el = a && document.getElementById(a.getAttribute("href").slice(1));
      if (!el) return;
      e.preventDefault();
      if (!wide.matches) toc.open = false;
      el.scrollIntoView({ block: "start" });
      try { history.replaceState(null, "", a.getAttribute("href")); } catch (err) {}
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !wide.matches && toc.open) { toc.open = false; $(".toc-toggle").focus(); }
    });
    list.addEventListener("scroll", () => pin.classList.toggle("scrolled", list.scrollTop > 0), { passive: true });
    let ticking = false;
    addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; spy(); });
    }, { passive: true });
    wide.addEventListener("change", sync);
    addEventListener("resize", () => { if (!wide.matches) sync(); });
    sync();
    rail.setAttribute("data-ready", "");
    if (location.hash.length > 1) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: "start" });
  });
})();

(async () => {
  const ITEMS = [...document.querySelectorAll(".rv[data-rv]")].map((el) => el.dataset.rv);
  const use = window.claude && window.claude.use ? (n) => window.claude.use(n) : async () => null;
  const notice = document.getElementById("notice");
  const [db, user, comments] = await Promise.all([use("db"), use("user"), use("comments")]);

  if (comments) {
    for (const b of document.querySelectorAll(".cm-btn")) {
      b.hidden = false;
      b.addEventListener("click", async () => {
        const el = document.getElementById(b.dataset.cm);
        try { await comments.openComposer({ element: el }); }
        catch (e) { if (e && (e.code === "unavailable" || e.code === "not_granted" || e.code === "capability_disabled")) document.querySelectorAll(".cm-btn").forEach((x) => (x.hidden = true)); }
      });
    }
  }

  if (!db) { notice.hidden = false; notice.textContent = "Review status can’t be saved in this view."; return; }
  await customElements.whenDefined("ui-checkbox");
  const me = user ? await user.id() : null;
  const state = {};
  const col = db.collection("reviews");
  let painting = false;

  async function paint() {
    const ids = [...new Set(Object.values(state).filter((d) => d && d.reviewed && d.by).map((d) => d.by))];
    const ps = user && ids.length ? await user.profiles(ids) : {};
    let done = 0;
    painting = true;
    for (const id of ITEMS) {
      const d = state[id];
      const on = !!(d && d.reviewed);
      if (on) done++;
      const strip = document.querySelector('.rv[data-rv="' + id + '"]');
      const label = strip.querySelector(".rv-check");
      const cb = label.querySelector("ui-checkbox");
      label.hidden = false;
      label.title = me ? "" : "Sign in to mark this reviewed";
      if (me) cb.removeAttribute("disabled"); else cb.setAttribute("disabled", "");
      if (cb.checked !== on) cb.checked = on;
      const who = strip.querySelector(".rv-who");
      if (on) {
        const name = (ps[d.by] && ps[d.by].name) || "Someone";
        const when = d.at ? new Date(d.at).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
        who.textContent = "by " + name + (when ? " · " + when : "");
      } else who.textContent = "";
      const nav = document.querySelector('[data-nav="' + id + '"]');
      if (nav) nav.classList.toggle("done", on);
    }
    painting = false;
    document.getElementById("prog-text").textContent = done + " of " + ITEMS.length + " reviewed";
    document.getElementById("prog-bar").style.width = (ITEMS.length ? (100 * done) / ITEMS.length : 0).toFixed(1) + "%";
    document.querySelector(".toc-prog").textContent = done + "/" + ITEMS.length;
  }

  for (const id of ITEMS) {
    const cb = document.querySelector('ui-checkbox[data-id="' + id + '"]');
    cb.addEventListener("checkedchange", async (e) => {
      if (painting) return;
      if (!me) { e.preventDefault(); return; }
      const on = e.detail.value === true;
      state[id] = { reviewed: on, by: me, at: new Date().toISOString() };
      paint();
      try { await col.doc(id).set({ reviewed: on, by: me, at: state[id].at }); }
      catch (err) { notice.hidden = false; notice.textContent = "Couldn’t save that review mark. Try again in a moment."; }
    });
  }

  col.onSnapshot((snap) => {
    for (const k of Object.keys(state)) delete state[k];
    for (const d of snap.docs) if (d.exists) state[d.id] = d.data();
    paint();
  }, () => { notice.hidden = false; notice.textContent = "Review status stopped updating. Reload the page to see the latest."; });
  paint();
})();
</script>
`
