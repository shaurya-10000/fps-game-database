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

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
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
      <div>
        <strong>{service.name}</strong>
        <span className="detail">{service.detail}</span>
      </div>
      <span className={`pill pill--${service.state}`}>{STATE_LABEL[service.state]}</span>
    </li>
  );
}

export function StatusPage({ snapshot }: { snapshot: StatusSnapshot }) {
  const { overall, outbox } = snapshot;
  const latency = snapshot.dbLatencyMs === null ? "n/a" : `${snapshot.dbLatencyMs} ms`;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="refresh" content={String(REFRESH_SECONDS)} />
        <meta name="robots" content="noindex" />
        <title>FPS Game Database | API status</title>
        <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      </head>
      <body>
        <main className="wrap">
          <header className="brand">
            <span className="mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="2" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
            </span>
            <div>
              <h1>FPS Game Database</h1>
              <p>API status</p>
            </div>
          </header>

          <section className={`hero hero--${overall}`} aria-live="polite">
            <span className="dot" aria-hidden="true" />
            <div>
              <h2>{HEADLINE[overall]}</h2>
              <p>
                Checked {formatTimestamp(snapshot.checkedAt)} &middot; refreshes every {REFRESH_SECONDS} seconds
              </p>
            </div>
          </section>

          <dl className="stats">
            <Stat label="Uptime" value={formatUptime(snapshot.uptimeSeconds)} hint="since last restart" />
            <Stat label="DB latency" value={latency} hint="MongoDB ping" />
            <Stat label="Outbox queue" value={outbox ? String(outbox.pending) : "n/a"} hint="pending deliveries" />
            <Stat label="Dead letters" value={outbox ? String(outbox.deadLetter) : "n/a"} hint={outbox && outbox.deadLetter > 0 ? "needs replay" : "none waiting"} />
          </dl>

          <section className="panel" aria-labelledby="services-title">
            <h3 id="services-title">Services</h3>
            <ul className="services">
              {snapshot.services.map((service) => (
                <ServiceRow key={service.id} service={service} />
              ))}
            </ul>
          </section>

          <footer>
            <span>
              Environment: <code>{snapshot.environment}</code>
            </span>
            {snapshot.commit ? (
              <span>
                Build: <code>{snapshot.commit.slice(0, 7)}</code>
              </span>
            ) : null}
            <a href={LINKS.web} rel="noopener noreferrer">Web app</a>
            <a href={LINKS.source} rel="noopener noreferrer">Source on GitHub</a>
            <a href="/health">Raw health JSON</a>
          </footer>
        </main>
      </body>
    </html>
  );
}

export function renderStatusPage(snapshot: StatusSnapshot): string {
  return `<!doctype html>${renderToStaticMarkup(<StatusPage snapshot={snapshot} />)}`;
}