// The design map's fixed page parts: fonts, theme tokens, layout, and the runtime script for the theme switch,
// review marks and comments. render.ts fills the content between them.

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Every color is a token, redefined for dark mode by system setting and by the theme switch. */
export function pageHead(title: string): string {
  return `<title>${escapeHtml(title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap">
<style>
/* Layout: a reading column beside a contents rail that stays put on wide screens; every reviewable item carries a review switch and a comment button. */
:root {
  --bg: #ffffff; --fg: #242424; --body: #333333; --muted: #6b6b6b; --faint: #8a8a8a;
  --line: #f0f0f0; --line-strong: #e6e6e6; --shot: #ececec; --chip: #f6f6f6;
  --ok: #1a7f37; --ok-soft: #e6f4ea;
  --rev-bg: #e6f4ea; --rev-fg: #14632b; --new-bg: #e8eefc; --new-fg: #1d3f9e;
  --con-bg: #fff1dc; --con-fg: #7a4a00; --nd-bg: #efefef; --nd-fg: #4d4d4d;
  --serif: 'Source Serif 4', Georgia, 'Times New Roman', serif;
  --sans: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: ui-monospace, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #121212; --fg: #e8e8e8; --body: #d0d0d0; --muted: #a3a3a3; --faint: #8f8f8f;
  --line: #262626; --line-strong: #333333; --shot: #2e2e2e; --chip: #1d1d1d;
  --ok: #4ac26b; --ok-soft: #12301c;
  --rev-bg: #12301c; --rev-fg: #8fe0a8; --new-bg: #172447; --new-fg: #a9c1ff;
  --con-bg: #3a2a0c; --con-fg: #f3c27a; --nd-bg: #2a2a2a; --nd-fg: #c4c4c4; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #121212; --fg: #e8e8e8; --body: #d0d0d0; --muted: #a3a3a3; --faint: #8f8f8f;
  --line: #262626; --line-strong: #333333; --shot: #2e2e2e; --chip: #1d1d1d;
  --ok: #4ac26b; --ok-soft: #12301c;
  --rev-bg: #12301c; --rev-fg: #8fe0a8; --new-bg: #172447; --new-fg: #a9c1ff;
  --con-bg: #3a2a0c; --con-fg: #f3c27a; --nd-bg: #2a2a2a; --nd-fg: #c4c4c4; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font-family: var(--serif); }
a { color: var(--fg); text-decoration: underline; text-decoration-color: var(--faint); text-underline-offset: 3px; }
a:hover { text-decoration-color: var(--fg); }
:focus-visible { outline: 2px solid var(--new-fg); outline-offset: 2px; }
h1, h2, h3, h4 { font-family: var(--sans); text-wrap: balance; color: var(--fg); }
code { font: .88em var(--mono); }
.wrap { box-sizing: border-box; max-width: 1240px; margin: 0 auto; padding-block: 64px 120px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
  display: flex; flex-wrap: wrap; gap: 48px 64px; align-items: flex-start; }
.rail { flex: 0 1 230px; min-width: 200px; box-sizing: border-box; padding: 8px 6px 8px 4px; font-family: var(--sans); }
@media (min-width: 900px) { .rail { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 24px); max-height: calc(100vh - 48px); overflow-y: auto; overscroll-behavior: contain; } }
main { flex: 999 1 560px; min-width: 0; }
.kick { font-family: var(--sans); font-size: 13px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.rail .kick + .rl, .rail .kick + .rs { margin-top: 4px; }
.rail-group { margin: 24px 0 6px; }
.rl, .rs { display: flex; align-items: baseline; gap: 6px; text-decoration: none; }
.rl { padding: 6px 0; font-size: 14px; line-height: 20px; font-weight: 600; color: var(--fg); }
.rs { padding: 3px 0 3px 14px; font-size: 13px; line-height: 18px; color: var(--muted); }
.rs.rs2 { padding-left: 28px; }
.rl:hover, .rs:hover { color: var(--fg); text-decoration: underline; }
.dot { flex: 0 0 auto; width: 12px; height: 12px; display: inline-block; transform: translateY(1px); color: var(--ok); visibility: hidden; }
.done > .dot { visibility: visible; }
.progress { margin: 4px 0 18px; font-size: 13px; color: var(--muted); }
.bar { height: 4px; border-radius: 2px; background: var(--line-strong); margin-top: 6px; overflow: hidden; }
.bar > i { display: block; height: 100%; width: 0; background: var(--ok); transition: width .3s; }
@media (prefers-reduced-motion: reduce) { .bar > i { transition: none; } }
.head { max-width: 720px; }
.title { margin: 12px 0 0; font-size: 44px; line-height: 52px; font-weight: 700; letter-spacing: -0.02em; }
.lede { margin: 14px 0 0; font-size: 22px; line-height: 32px; color: var(--muted); }
.meta { margin-top: 22px; padding: 14px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 8px 24px; font-family: var(--sans); font-size: 14px; color: var(--muted); }
.meta a { color: var(--muted); }
.intro { margin-top: 48px; }
.p { font-size: 20px; line-height: 32px; margin: 0 0 20px; max-width: 720px; color: var(--fg); }
.pp { margin: 0 0 14px; max-width: 720px; font-size: 18px; line-height: 29px; color: var(--body); }
.h2 { margin: 8px 0 16px; font-size: 32px; line-height: 40px; font-weight: 700; letter-spacing: -0.015em; }
.h3 { margin: 0 0 8px; font-size: 21px; line-height: 28px; font-weight: 700; }
.h4 { margin: 0 0 8px; font-size: 18px; line-height: 26px; font-weight: 700; }
.code { color: var(--muted); font-weight: 600; margin-right: 6px; font-variant-numeric: tabular-nums; }
section.sec { margin-top: 72px; }
.part { margin-top: 40px; }
.part.sub { margin-top: 32px; }
.ref { margin-top: 96px; padding-top: 48px; border-top: 1px solid var(--line-strong); }
.tbox { overflow-x: auto; }
table { border-collapse: collapse; font-family: var(--sans); color: var(--fg); }
table.v { width: 100%; min-width: 760px; font-size: 14px; line-height: 22px; }
table.v th, table.q th { text-align: left; font-weight: 600; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); padding: 0 16px 12px 0; border-bottom: 1px solid var(--line-strong); }
table.v td { vertical-align: top; padding: 18px 16px 18px 0; border-bottom: 1px solid var(--line); }
table.k { width: 100%; max-width: 720px; margin-bottom: 32px; font-family: var(--serif); font-size: 18px; line-height: 28px; }
table.k td { vertical-align: top; padding: 12px 16px 12px 0; border-bottom: 1px solid var(--line); }
table.k ul { margin: 4px 0 0; padding-left: 20px; }
table.q { width: 100%; min-width: 760px; font-size: 15px; line-height: 23px; }
table.q td { vertical-align: top; padding: 16px 16px 16px 0; border-bottom: 1px solid var(--line); }
table.q td.n { font-weight: 600; white-space: nowrap; }
.vname { font-weight: 600; }
.fig { font-size: 12px; color: var(--muted); }
.shot { display: block; max-width: 100%; height: auto; border: 1px solid var(--shot); border-radius: 4px; }
.shot + .shot { margin-top: 8px; }
.crop { max-width: 720px; margin: 0 0 18px; }
.lab { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--faint); margin: 0 0 4px; }
.blk + .blk { margin-top: 14px; }
.blk ul { margin: 0; padding-left: 18px; }
.blk li { margin-bottom: 4px; }
.blk.copy li { color: var(--body); }
.blk.notes li { color: var(--muted); }
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
.legend { margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: var(--muted); }
/* review + comment strip */
.rv { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin: 0 0 18px; font-family: var(--sans); font-size: 13px; color: var(--muted); }
.rv button { font: 500 13px/18px var(--sans); color: var(--fg); background: var(--chip); border: 1px solid var(--line-strong); border-radius: 999px; padding: 6px 12px; min-height: 32px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.rv button:hover { border-color: var(--muted); }
.rv button[hidden], [hidden] { display: none !important; }
.rv button:disabled { cursor: default; opacity: .6; }
.rv .rv-btn[aria-pressed="true"] { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
.rv .box { width: 14px; height: 14px; border: 1.5px solid currentColor; border-radius: 3px; display: inline-grid; place-items: center; }
.rv .box svg { width: 10px; height: 10px; visibility: hidden; }
.rv .rv-btn[aria-pressed="true"] .box svg { visibility: visible; }
.rv-who { font-variant-numeric: tabular-nums; }
.rail-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.theme-btn { position: relative; flex: 0 0 auto; width: 40px; height: 22px; padding: 0; border: 1px solid var(--line-strong); border-radius: 999px; background: var(--chip); cursor: pointer; }
.theme-btn:hover { border-color: var(--muted); }
.theme-btn:focus-visible { outline: 2px solid var(--new-fg); outline-offset: 1px; }
.theme-btn .knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--fg); color: var(--bg); display: grid; place-items: center; transition: transform .2s; }
.theme-btn[aria-checked="true"] .knob { transform: translateX(18px); }
.theme-btn svg { width: 10px; height: 10px; }
@media (prefers-reduced-motion: reduce) { .theme-btn .knob { transition: none; } }
.notice { margin-top: 16px; font-family: var(--sans); font-size: 13px; color: var(--muted); }
</style>
`
}

export const CHECK =
  '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5 5 9.2 10 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

/** One item's review switch and comment button; both stay hidden until the runtime grants them. */
export function reviewStrip(id: string, label: string): string {
  return `<div class="rv" data-rv="${id}"><button type="button" class="rv-btn" aria-pressed="false" data-id="${id}" aria-label="Mark ${escapeHtml(label)} reviewed" hidden><span class="box">${CHECK}</span><span class="rv-text">Mark reviewed</span></button><span class="rv-who"></span><button type="button" class="cm-btn" data-cm="${id}" hidden>Comment</button></div>`
}

/**
 * The theme switch keeps its choice in localStorage: a per-viewer convenience. Review marks live in the db
 * (`reviews/<item id>`, `{reviewed, by, at}`) so every viewer sees them; comments go to the shell's own thread store.
 */
export const PAGE_SCRIPT = `<script>
(() => {
  const root = document.documentElement;
  const btn = document.getElementById("theme-btn");
  const MOON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.6A5.5 5.5 0 0 1 6.4 2.5a5.5 5.5 0 1 0 7.1 7.1Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  const SUN = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const current = () => root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const paint = () => { const dark = current() === "dark"; btn.innerHTML = '<span class="knob">' + (dark ? MOON : SUN) + "</span>"; btn.setAttribute("aria-checked", dark ? "true" : "false"); };
  try { const saved = localStorage.getItem("figma-map-theme"); if (saved === "dark" || saved === "light") root.dataset.theme = saved; } catch (e) {}
  btn.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("figma-map-theme", next); } catch (e) {}
    paint();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paint);
  paint();
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
  const me = user ? await user.id() : null;
  const state = {};
  const col = db.collection("reviews");

  async function paint() {
    const ids = [...new Set(Object.values(state).filter((d) => d && d.reviewed && d.by).map((d) => d.by))];
    const ps = user && ids.length ? await user.profiles(ids) : {};
    let done = 0;
    for (const id of ITEMS) {
      const d = state[id];
      const on = !!(d && d.reviewed);
      if (on) done++;
      const strip = document.querySelector('.rv[data-rv="' + id + '"]');
      const b = strip.querySelector(".rv-btn");
      b.hidden = false;
      b.disabled = !me;
      b.title = me ? "" : "Sign in to mark this reviewed";
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.querySelector(".rv-text").textContent = on ? "Reviewed" : "Mark reviewed";
      const who = strip.querySelector(".rv-who");
      if (on) {
        const name = (ps[d.by] && ps[d.by].name) || "Someone";
        const when = d.at ? new Date(d.at).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
        who.textContent = "by " + name + (when ? " · " + when : "");
      } else who.textContent = "";
      const nav = document.querySelector('[data-nav="' + id + '"]');
      if (nav) nav.classList.toggle("done", on);
    }
    document.getElementById("prog-text").textContent = done + " of " + ITEMS.length + " reviewed";
    document.getElementById("prog-bar").style.width = (ITEMS.length ? (100 * done) / ITEMS.length : 0).toFixed(1) + "%";
  }

  for (const id of ITEMS) {
    const b = document.querySelector('.rv-btn[data-id="' + id + '"]');
    b.addEventListener("click", async () => {
      if (!me) return;
      const on = !(state[id] && state[id].reviewed);
      state[id] = { reviewed: on, by: me, at: new Date().toISOString() };
      paint();
      try { await col.doc(id).set({ reviewed: on, by: me, at: state[id].at }); }
      catch (e) { notice.hidden = false; notice.textContent = "Couldn’t save that review mark. Try again in a moment."; }
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
