// Results of a day: draws (with their time) down the left, lotteries across, and in each cell
// the first prize ("la cabeza") with how sure it is: confirmed, pending (one source) or in
// conflict (sources disagree). Each cell opens the draw with its 20 prizes and every source.
// On narrow screens the same data goes as one card per draw.
import Link from "next/link";
import type { QuinielaResultStatus } from "@/generated/prisma/enums";
import {
  type HeldDraw,
  LOTTERY_SHORT,
  SLOT_LABEL,
  SLOT_ORDER,
  type Slot,
  byLottery,
} from "@/lib/quiniela/calendar";

export type GridResult = {
  id: string;
  slot: Slot;
  lottery: string;
  status: QuinielaResultStatus;
  head: string | null;
  sources: number;
};

export const RESULT_STATUS: Record<
  QuinielaResultStatus,
  { label: string; tone: string }
> = {
  CONFIRMED: { label: "Confirmado", tone: "ok" },
  PENDING: { label: "Pendiente", tone: "" },
  CONFLICT: { label: "En conflicto", tone: "error" },
};

export function ResultsGrid({
  held,
  results,
  isPast,
}: {
  held: HeldDraw[];
  results: GridResult[];
  isPast: (slotTime: string) => boolean;
}) {
  const lotteries = [
    ...new Set([
      ...held.flatMap((h) => h.lotteries),
      ...results.map((r) => r.lottery),
    ]),
  ].sort(byLottery);
  const slots = SLOT_ORDER.filter(
    (s) => held.some((h) => h.slot === s) || results.some((r) => r.slot === s),
  );
  if (!slots.length)
    return <p className="small muted">Ese día no hubo sorteos.</p>;
  const find = (slot: Slot, lottery: string) =>
    results.find((r) => r.slot === slot && r.lottery === lottery);
  const timeOf = (slot: Slot) =>
    held.find((h) => h.slot === slot)?.time ?? null;
  const plays = (slot: Slot, lottery: string) =>
    held.some((h) => h.slot === slot && h.lotteries.includes(lottery));

  const cell = (slot: Slot, lottery: string) => {
    const r = find(slot, lottery);
    if (r) {
      const s = RESULT_STATUS[r.status];
      return (
        <Link
          href={`/panel/quiniela/resultados/${r.id}`}
          className={`result-cell ${s.tone}`}
          title={`${s.label} · ${r.sources} fuente(s)`}
        >
          <span className="result-head">{r.head ?? "????"}</span>
          <span className={`status-chip ${s.tone}`}>
            {r.status === "CONFIRMED" ? "✓" : s.label}
          </span>
        </Link>
      );
    }
    if (!plays(slot, lottery)) return <span className="muted">—</span>;
    const time = timeOf(slot);
    return (
      <span className="small muted">
        {time && !isPast(time) ? `a las ${time}` : "sin datos"}
      </span>
    );
  };

  return (
    <>
      <div className="week-days">
        {slots.map((slot) => (
          <div key={slot} className="week-day">
            <div className="row">
              <strong>{SLOT_LABEL[slot]}</strong>
              <span className="small muted">{timeOf(slot)}</span>
            </div>
            {lotteries
              .filter((l) => plays(slot, l) || find(slot, l))
              .map((l) => (
                <div key={l} className="row result-line">
                  <span className="small">{LOTTERY_SHORT[l] ?? l}</span>
                  {cell(slot, l)}
                </div>
              ))}
          </div>
        ))}
      </div>
      <div className="table-scroll week-grid-wrap">
        <table className="week-grid small results-table">
          <thead>
            <tr>
              <th />
              {lotteries.map((l) => (
                <th key={l}>{LOTTERY_SHORT[l] ?? l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot}>
                <th scope="row">
                  {SLOT_LABEL[slot]}
                  <span className="time">{timeOf(slot)}</span>
                </th>
                {lotteries.map((l) => (
                  <td key={l}>{cell(slot, l)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
