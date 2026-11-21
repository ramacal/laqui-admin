"use client";

// Fiados: the agency's customers with a search box (alias, name, phone) and "Deben / Todos".
// Made for the counter: type a few letters and tap the customer.
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CustomerRow = {
  id: string;
  alias: string;
  name: string;
  phone: string | null;
  balance: string; // formatted
  owes: boolean;
  lastDate: string | null; // dd/mm
};

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function CustomerList({ rows, base }: { rows: CustomerRow[]; base: string }) {
  const [query, setQuery] = useState("");
  const [onlyOwing, setOnlyOwing] = useState(rows.some((r) => r.owes));
  const needle = fold(query.trim());
  const shown = rows.filter(
    (r) =>
      (!onlyOwing || r.owes) &&
      (!needle || fold(`${r.alias} ${r.name} ${r.phone ?? ""}`).includes(needle)),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-60">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Buscar cliente</span>
          <input
            type="search"
            className="input w-full pl-9"
            placeholder="Buscar por alias, nombre o celular"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div role="group" aria-label="Mostrar" className="inline-flex rounded-lg border border-solid border-input bg-card p-0.5">
          {[
            { value: true, label: "Deben" },
            { value: false, label: "Todos" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={onlyOwing === o.value}
              onClick={() => setOnlyOwing(o.value)}
              className={cn(
                "cursor-pointer rounded-md border-0 px-3 py-1.5 text-sm font-semibold [font-family:inherit]",
                onlyOwing === o.value ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-solid border-border bg-card shadow-[0_1px_2px_rgba(19,20,43,0.05)]">
        {shown.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            {rows.length === 0 ? "Todavía no hay clientes." : needle ? "Ningún cliente coincide con la búsqueda." : "Nadie debe: están todos al día."}
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0 [&>li+li]:border-0 [&>li+li]:border-t [&>li+li]:border-solid [&>li+li]:border-border">
            {shown.map((r) => (
              <li key={r.id}>
                <Link href={`${base}/${r.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted sm:px-5">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-semibold">{r.alias}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {[r.name !== r.alias ? r.name : null, r.lastDate ? `último movimiento ${r.lastDate}` : "sin fiados"]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {r.owes ? <strong className="text-destructive">{r.balance}</strong> : <Badge tone="success">Al día</Badge>}
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
