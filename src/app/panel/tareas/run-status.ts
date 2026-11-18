// Shared labels for job run states (tasks list and job detail).
import type { JobRunStatus } from "@/generated/prisma/enums";

export const RUN_STATUS: Record<
  JobRunStatus,
  { label: string; tone: "" | "ok" | "warn" | "error" }
> = {
  RUNNING: { label: "Corriendo", tone: "" },
  OK: { label: "OK", tone: "ok" },
  WARNING: { label: "Revisar", tone: "warn" },
  ERROR: { label: "Error", tone: "error" },
};

export const fmtDateTime = (d: Date | null) =>
  d
    ? d.toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
