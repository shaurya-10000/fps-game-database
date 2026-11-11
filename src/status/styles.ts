export const PAGE_CSS = `
:root {
  color-scheme: dark;
  --bg: #0b1018;
  --surface: #111925;
  --surface-raised: #151f2d;
  --text: #edf3fc;
  --muted: #91a1b7;
  --subtle: #64748b;
  --line: #243145;
  --accent: #78a9ff;
  --ok: #22c879;
  --warn: #f4b544;
  --bad: #f16b72;
  --shadow: 0 12px 36px rgba(0, 0, 0, 0.14);
}

* {
  box-sizing: border-box;
}

html {
  min-height: 100%;
  background: var(--bg);
}

body {
  margin: 0;
  min-height: 100vh;
  color: var(--text);
  background:
    radial-gradient(ellipse at 50% -240px, rgba(68, 119, 205, 0.18), transparent 68%),
    var(--bg);
  font: 14px/1.6 Inter, ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}

.wrap {
  width: min(100% - 48px, 1040px);
  margin: 0 auto;
  padding: 38px 0 32px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 48px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
}

.mark {
  width: 44px;
  height: 44px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid rgba(120, 169, 255, 0.35);
  border-radius: 13px;
  color: #c6dcff;
  background: linear-gradient(145deg, #244b83, #172e50);
  box-shadow: 0 5px 20px rgba(39, 91, 164, 0.2);
}

.mark svg {
  width: 23px;
  height: 23px;
}

.brand h1 {
  margin: 0;
  font-size: 19px;
  line-height: 1.3;
  font-weight: 720;
  letter-spacing: -0.035em;
}

.brand p {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.environment {
  display: flex;
  align-items: center;
  gap: 9px;
  flex: none;
  padding: 9px 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
}

.environment-dot,
.live-dot,
.refresh-indicator {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: var(--accent);
}

.environment-label {
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.09em;
}

.environment strong {
  font-size: 11px;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}

.environment--development .environment-dot,
.environment--dev .environment-dot {
  background: #f4b544;
  box-shadow: 0 0 12px rgba(244, 181, 68, 0.4);
}

.environment--staging .environment-dot {
  background: #78a9ff;
  box-shadow: 0 0 12px rgba(120, 169, 255, 0.4);
}

.environment--production .environment-dot,
.environment--prod .environment-dot {
  background: var(--ok);
  box-shadow: 0 0 12px rgba(34, 200, 121, 0.4);
}

.environment--test .environment-dot,
.environment--testing .environment-dot {
  background: #b58aff;
}

.intro {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 20px;
}

.eyebrow {
  display: block;
  color: var(--accent);
  font-size: 10px;
  line-height: 1.4;
  font-weight: 750;
  letter-spacing: 0.13em;
}

.intro h2 {
  margin: 6px 0 3px;
  font-size: clamp(25px, 4vw, 31px);
  line-height: 1.2;
  letter-spacing: -0.045em;
}

.intro p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.refresh-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 5px;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.refresh-indicator,
.live-dot {
  background: var(--ok);
  box-shadow: 0 0 10px rgba(34, 200, 121, 0.35);
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  position: relative;
  overflow: hidden;
  padding: 23px 25px;
  margin-bottom: 34px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background:
    linear-gradient(105deg, color-mix(in srgb, var(--state) 9%, var(--surface)), var(--surface) 72%);
  box-shadow: var(--shadow);
}

.hero::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--state);
}

.hero--operational { --state: var(--ok); }
.hero--degraded { --state: var(--warn); }
.hero--down { --state: var(--bad); }

.hero-main {
  display: flex;
  align-items: center;
  gap: 15px;
  min-width: 0;
}

.hero-icon {
  width: 42px;
  height: 42px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--state) 32%, transparent);
  border-radius: 12px;
  color: var(--state);
  background: color-mix(in srgb, var(--state) 12%, transparent);
  font-size: 23px;
  font-weight: 750;
}

.hero-eyebrow {
  color: var(--muted);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.12em;
}

.hero h3 {
  margin: 3px 0 1px;
  font-size: clamp(18px, 3vw, 22px);
  line-height: 1.3;
  letter-spacing: -0.035em;
}

.hero p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.hero-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: none;
  text-align: right;
}

.hero-meta span {
  color: var(--subtle);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.1em;
}

.hero-meta strong {
  font-size: 11px;
  font-weight: 550;
  font-variant-numeric: tabular-nums;
}

.metrics-section {
  margin-bottom: 34px;
}

.section-heading,
.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 13px;
}

.section-heading h3,
.panel-heading h3 {
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 680;
  letter-spacing: -0.025em;
}

.live-label,
.service-count {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.09em;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 13px;
  margin: 0;
}

.stat {
  min-width: 0;
  padding: 17px 18px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: linear-gradient(145deg, var(--surface-raised), var(--surface));
  box-shadow: var(--shadow);
}

.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.stat dt {
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.075em;
  text-transform: uppercase;
}

.stat-icon {
  color: var(--subtle);
  font-size: 17px;
}

.stat dd {
  margin: 9px 0 0;
}

.stat .value {
  display: block;
  overflow-wrap: anywhere;
  font-size: clamp(22px, 3vw, 27px);
  line-height: 1.2;
  font-weight: 730;
  letter-spacing: -0.045em;
  font-variant-numeric: tabular-nums;
}

.stat .hint {
  display: block;
  margin-top: 5px;
  color: var(--muted);
  font-size: 11px;
}

.panel {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.panel-heading {
  padding: 19px 21px;
  margin: 0;
  border-bottom: 1px solid var(--line);
}

.service-count {
  white-space: nowrap;
}

.services {
  list-style: none;
  margin: 0;
  padding: 0;
}

.service {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 16px 21px;
  border-bottom: 1px solid var(--line);
  transition: background 160ms ease;
}

.service:last-child {
  border-bottom: 0;
}

.service:hover {
  background: rgba(255, 255, 255, 0.018);
}

.service-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.service-indicator {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: var(--state);
}

.service-indicator--operational { --state: var(--ok); }
.service-indicator--degraded { --state: var(--warn); }
.service-indicator--down { --state: var(--bad); }

.service-copy {
  min-width: 0;
}

.service strong {
  display: block;
  font-size: 13px;
  font-weight: 650;
}

.service .detail {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  flex: none;
  padding: 5px 10px;
  border: 1px solid color-mix(in srgb, var(--state) 25%, transparent);
  border-radius: 7px;
  color: var(--state);
  background: color-mix(in srgb, var(--state) 9%, transparent);
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.pill--operational { --state: var(--ok); }
.pill--degraded { --state: var(--warn); }
.pill--down { --state: var(--bad); }

.pill-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.panel-note {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 21px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  background: rgba(255, 255, 255, 0.015);
  font-size: 10px;
}

.note-icon {
  width: 15px;
  height: 15px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid var(--subtle);
  border-radius: 50%;
  font-size: 9px;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 15px;
  padding: 23px 2px 0;
  margin-top: 26px;
  border-top: 1px solid var(--line);
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.footer-brand span:first-child {
  color: var(--text);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.1em;
}

.footer-brand span:last-child {
  color: var(--subtle);
  font-size: 10px;
}

.footer-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 17px;
  color: var(--muted);
  font-size: 11px;
}

.footer-meta a {
  color: var(--accent);
  text-decoration: none;
  transition: color 150ms ease;
}

.footer-meta a:hover {
  color: #b5d0ff;
  text-decoration: underline;
}

.footer-meta code {
  color: var(--text);
  font: 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
  border-radius: 4px;
}

@media (max-width: 760px) {
  .wrap {
    width: min(100% - 32px, 600px);
    padding-top: 25px;
  }

  .topbar {
    margin-bottom: 36px;
  }

  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .wrap {
    width: calc(100% - 28px);
    padding-top: 19px;
  }

  .topbar {
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 34px;
  }

  .brand {
    gap: 9px;
  }

  .mark {
    width: 38px;
    height: 38px;
    border-radius: 11px;
  }

  .brand h1 {
    font-size: 15px;
  }

  .brand p {
    font-size: 10px;
  }

  .environment {
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    padding: 7px 9px;
  }

  .environment-dot {
    display: none;
  }

  .environment-label {
    font-size: 8px;
  }

  .environment strong {
    font-size: 10px;
  }

  .intro {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .intro h2 {
    font-size: 25px;
  }

  .refresh-info {
    padding: 0;
  }

  .hero {
    align-items: flex-start;
    flex-direction: column;
    gap: 17px;
    padding: 18px 16px;
    margin-bottom: 27px;
  }

  .hero-main {
    gap: 11px;
  }

  .hero-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .hero-meta {
    padding-left: 47px;
    text-align: left;
  }

  .section-heading h3,
  .panel-heading h3 {
    font-size: 15px;
  }

  .stats {
    gap: 9px;
  }

  .stat {
    padding: 13px;
  }

  .stat dt {
    font-size: 9px;
  }

  .stat .value {
    font-size: 22px;
  }

  .stat .hint {
    font-size: 10px;
  }

  .panel-heading {
    padding: 15px;
  }

  .service {
    padding: 14px 15px;
  }

  .service .detail {
    max-width: 220px;
  }

  .panel-note {
    align-items: flex-start;
    padding: 11px 15px;
  }

  .footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .footer-meta {
    gap: 12px 16px;
  }
}

@media (max-width: 350px) {
  .brand h1 {
    font-size: 13px;
  }

  .environment {
    padding: 6px;
  }

  .environment-label {
    font-size: 7px;
  }

  .environment strong {
    font-size: 9px;
  }

  .stats {
    grid-template-columns: 1fr;
  }

  .service {
    align-items: flex-start;
  }

  .pill {
    padding: 4px 7px;
    font-size: 9px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;
