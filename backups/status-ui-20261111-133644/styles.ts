export const PAGE_CSS = `
:root {
  color-scheme: light dark;
  --bg: #f3f5f9;
  --surface: #ffffff;
  --text: #111827;
  --muted: #5b6676;
  --line: #e3e7ee;
  --accent: #1f3a5f;
  --ok: #16a34a;
  --warn: #d97706;
  --bad: #dc2626;
  --shadow: 0 1px 2px rgba(16, 24, 40, 0.05), 0 12px 32px rgba(16, 24, 40, 0.06);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0b0f15;
    --surface: #131922;
    --text: #e8ecf3;
    --muted: #8b97a8;
    --line: #222a36;
    --accent: #8fb4ff;
    --shadow: 0 0 0 1px rgba(255, 255, 255, 0.02);
  }
}
* { box-sizing: border-box; }
html { background: var(--bg); }
body {
  margin: 0;
  min-height: 100vh;
  color: var(--text);
  background:
    radial-gradient(900px 340px at 50% -80px, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%),
    var(--bg);
  font: 15px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 880px; margin: 0 auto; padding: 48px 20px 64px; }
.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
.mark {
  width: 38px; height: 38px; border-radius: 10px; flex: none;
  display: grid; place-items: center;
  background: var(--accent); color: var(--bg);
}
.mark svg { width: 20px; height: 20px; }
.brand h1 { margin: 0; font-size: 20px; line-height: 1.2; letter-spacing: -0.01em; }
.brand p { margin: 0; color: var(--muted); font-size: 13px; }

.hero {
  position: relative; overflow: hidden;
  display: flex; align-items: center; gap: 18px;
  padding: 22px 24px; margin-bottom: 16px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 16px;
  box-shadow: var(--shadow);
}
.hero::before {
  content: ""; position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--state);
}
.hero--operational { --state: var(--ok); }
.hero--degraded { --state: var(--warn); }
.hero--down { --state: var(--bad); }
.hero h2 { margin: 0; font-size: 22px; letter-spacing: -0.01em; }
.hero p { margin: 2px 0 0; color: var(--muted); font-size: 13px; }

.dot { position: relative; width: 14px; height: 14px; border-radius: 50%; flex: none; background: var(--state); }
.dot::after {
  content: ""; position: absolute; inset: 0; border-radius: 50%;
  background: var(--state); opacity: 0.45; animation: pulse 2.2s ease-out infinite;
}
@keyframes pulse { 0% { transform: scale(1); opacity: 0.45; } 100% { transform: scale(2.8); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .dot::after { animation: none; } }

.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.stat {
  padding: 16px 18px; background: var(--surface);
  border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow);
}
.stat dt { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
.stat dd { margin: 4px 0 0; }
.stat .value { display: block; font-size: 24px; font-weight: 650; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.stat .hint { display: block; color: var(--muted); font-size: 12px; }

.panel {
  background: var(--surface); border: 1px solid var(--line);
  border-radius: 16px; box-shadow: var(--shadow); overflow: hidden;
}
.panel h3 { margin: 0; padding: 16px 22px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.services { list-style: none; margin: 0; padding: 0; }
.service {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 22px; border-top: 1px solid var(--line);
}
.service strong { display: block; font-weight: 600; }
.service span.detail { color: var(--muted); font-size: 13px; }

.pill {
  flex: none; padding: 3px 11px; border-radius: 999px;
  font-size: 12px; font-weight: 600; white-space: nowrap;
  color: var(--state); background: color-mix(in srgb, var(--state) 14%, transparent);
}
.pill--operational { --state: var(--ok); }
.pill--degraded { --state: var(--warn); }
.pill--down { --state: var(--bad); }

footer { margin-top: 24px; display: flex; flex-wrap: wrap; gap: 8px 22px; color: var(--muted); font-size: 13px; }
footer a { color: var(--accent); text-decoration: none; }
footer a:hover, footer a:focus-visible { text-decoration: underline; }
footer code { font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }

@media (max-width: 700px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
  .wrap { padding-top: 32px; }
  .hero h2 { font-size: 19px; }
}
`;