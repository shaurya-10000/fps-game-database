import { renderToStaticMarkup } from "react-dom/server";
import { PAGE_CSS } from "./styles";
import type { HealthState, ServiceStatus, StatusSnapshot } from "./types";

const LINKS = {
  web: "https://fps-game-database-web.vercel.app",
  source: "https://github.com/shaurya-10000/fps-game-database",
} as const;

const REFRESH_SECONDS = 30;

const HEADLINE: Record<HealthState, string> = {
  operational: "All systems operational",
  degraded: "Partial degradation",
  down: "Major outage",
};

const STATE_LABEL: Record<HealthState, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
};

function environmentInfo(value: string) {
  const environment = value.trim() || "unknown";
  const key = environment.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

  const known: Record<string, string> = {
    development: "Development",
    dev: "Development",
    staging: "Staging",
    production: "Production",
    prod: "Production",
    test: "Test",
    testing: "Test",
  };

  return {
    label: known[key] ?? environment,
    key: known[key] ? key : "other",
  };
}

export function formatUptime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3_600);
  const minutes = Math.floor((s % 3_600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${s}s`;
}

export function formatTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: string;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <dt>{label}</dt>
        <span className="stat-icon" aria-hidden="true">{icon}</span>
      </div>
      <dd>
        <span className="value">{value}</span>
        <span className="hint">{hint}</span>
      </dd>
    </div>
  );
}

function ServiceRow({ service }: { service: ServiceStatus }) {
  return (
    <li className="service">
      <div className="service-main">
        <span className={`service-indicator service-indicator--${service.state}`} aria-hidden="true" />
        <div className="service-copy">
          <strong>{service.name}</strong>
          <span className="detail">{service.detail}</span>
        </div>
      </div>
      <span className={`pill pill--${service.state}`}>
        <span className="pill-dot" aria-hidden="true" />
        {STATE_LABEL[service.state]}
      </span>
    </li>
  );
}

export function StatusPage({ snapshot }: { snapshot: StatusSnapshot }) {
  const { overall, outbox } = snapshot;
  const latency =
    snapshot.dbLatencyMs === null ? "n/a" : `${snapshot.dbLatencyMs} ms`;

  const environment = environmentInfo(snapshot.environment);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="refresh" content={String(REFRESH_SECONDS)} />
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#0b1018" />
        <title>FPS Game Database | System Status</title>
        <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      </head>

      <body>
        <main className="wrap">
          <header className="topbar">
            <div className="brand">
              <span className="mark" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="8" />
                  <circle cx="12" cy="12" r="2" />
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </svg>
              </span>
              <div>
                <h1>FPS Game Database</h1>
                <p>Infrastructure & API status</p>
              </div>
            </div>

            <div className={`environment environment--${environment.key}`}>
              <span className="environment-dot" aria-hidden="true" />
              <span className="environment-label">ENVIRONMENT</span>
              <strong>{environment.label}</strong>
            </div>
          </header>

          <section className="intro">
            <div>
              <span className="eyebrow">SYSTEM OVERVIEW</span>
              <h2>Service health</h2>
              <p>Live operational status of the FPS Game Database infrastructure.</p>
            </div>
            <div className="refresh-info">
              <span className="refresh-indicator" aria-hidden="true" />
              <span>Auto-refresh · {REFRESH_SECONDS}s</span>
            </div>
          </section>

          <section
            className={`hero hero--${overall}`}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="hero-main">
              <span className="hero-icon" aria-hidden="true">
                {overall === "operational" ? "✓" : overall === "degraded" ? "!" : "×"}
              </span>
              <div>
                <span className="hero-eyebrow">CURRENT SYSTEM STATUS</span>
                <h3>{HEADLINE[overall]}</h3>
                <p>
                  {overall === "operational"
                    ? "All monitored services are responding normally."
                    : overall === "degraded"
                      ? "Some services require attention."
                      : "One or more critical services are unavailable."}
                </p>
              </div>
            </div>

            <div className="hero-meta">
              <span>LAST CHECKED</span>
              <strong>{formatTimestamp(snapshot.checkedAt)}</strong>
            </div>
          </section>

          <section className="metrics-section" aria-label="System metrics">
            <div className="section-heading">
              <div>
                <span className="eyebrow">PERFORMANCE</span>
                <h3>System metrics</h3>
              </div>
              <span className="live-label">
                <span className="live-dot" />
                LIVE DATA
              </span>
            </div>

            <dl className="stats">
              <Stat
                label="Uptime"
                value={formatUptime(snapshot.uptimeSeconds)}
                hint="Since last restart"
                icon="◷"
              />
              <Stat
                label="Database latency"
                value={latency}
                hint="MongoDB ping"
                icon="▤"
              />
              <Stat
                label="Outbox queue"
                value={outbox ? String(outbox.pending) : "n/a"}
                hint="Pending deliveries"
                icon="⇄"
              />
              <Stat
                label="Dead letters"
                value={outbox ? String(outbox.deadLetter) : "n/a"}
                hint={
                  outbox && outbox.deadLetter > 0
                    ? "Requires attention"
                    : "No failed deliveries"
                }
                icon="!"
              />
            </dl>
          </section>

          <section className="panel" aria-labelledby="services-title">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">INFRASTRUCTURE</span>
                <h3 id="services-title">Monitored services</h3>
              </div>
              <span className="service-count">
                {snapshot.services.length} COMPONENTS
              </span>
            </div>

            <ul className="services">
              {snapshot.services.map((service) => (
                <ServiceRow key={service.id} service={service} />
              ))}
            </ul>

            <div className="panel-note">
              <span className="note-icon" aria-hidden="true">i</span>
              Service states are based on the latest health-check snapshot.
            </div>
          </section>

          <footer className="footer">
            <div className="footer-brand">
              <span>FPS GAME DATABASE</span>
              <span>System monitoring</span>
            </div>

            <div className="footer-meta">
              {snapshot.commit ? (
                <span>
                  Build <code>{snapshot.commit.slice(0, 7)}</code>
                </span>
              ) : null}
              <a href={LINKS.web} rel="noopener noreferrer">Web app ↗</a>
              <a href={LINKS.source} rel="noopener noreferrer">GitHub ↗</a>
              <a href="/health">Health JSON ↗</a>
            </div>
          </footer>
        </main>
      </body>
    </html>
  );
}

export function renderStatusPage(snapshot: StatusSnapshot): string {
  return `<!doctype html>${renderToStaticMarkup(
    <StatusPage snapshot={snapshot} />,
  )}`;
}
