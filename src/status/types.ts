export type HealthState = "operational" | "degraded" | "down";

export interface ServiceStatus {
  readonly id: string;
  readonly name: string;
  readonly state: HealthState;
  readonly detail: string;
}

export interface OutboxStatus {
  readonly pending: number;
  readonly deadLetter: number;
  readonly oldestPendingMs: number;
}

export interface StatusSnapshot {
  readonly overall: HealthState;
  readonly checkedAt: Date;
  readonly uptimeSeconds: number;
  readonly environment: string;
  readonly commit: string | null;
  readonly dbLatencyMs: number | null;
  readonly outbox: OutboxStatus | null;
  readonly services: readonly ServiceStatus[];
}