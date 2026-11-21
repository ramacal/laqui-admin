// Settings page layout (configuration screens): each topic is a row with its title and
// explanation on the left and one panel on the right. Rows are split by a line instead of
// stacking cards. On phones the title goes on top of the panel.
//
// The panel: data on the left, its actions in a column on the right (Editar first, then the
// rest, one under the other, same width). On narrow screens that column becomes a strip under
// the data with the buttons side by side. A status (e.g. "Conectado") goes at the top of the data.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsPage({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

type PanelProps = {
  status?: ReactNode;
  actions?: ReactNode; // <Button>s / button-styled links, in order of importance
  children: ReactNode;
  tone?: "danger";
  active?: boolean; // being edited: no actions column, the form takes the panel
  muted?: boolean; // paused / inactive item
  heading?: { title: string; subtitle?: ReactNode }; // list items carry their name inside the panel
  id?: string;
};

/** The white panel: data (and its status) on the left, the actions column on the right. */
export function Panel({ status, actions, children, tone, active = false, muted = false, heading, id }: PanelProps) {
  return (
    <div
      id={id}
      className={cn(
        "flex min-w-0 scroll-mt-20 flex-col overflow-hidden rounded-xl border border-solid border-border bg-card shadow-[0_1px_2px_rgba(19,20,43,0.05)] transition-shadow lg:flex-row",
        tone === "danger" && "border-destructive/25",
        muted && !active && "bg-muted",
        active && (tone === "danger" ? "border-destructive ring-4 ring-destructive-soft" : "border-primary ring-4 ring-accent"),
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
        {(heading || status) && (
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            {heading && (
              <div className="flex min-w-0 flex-col">
                <h3 className={cn("m-0 text-base font-bold", muted && "text-muted-foreground")}>{heading.title}</h3>
                {heading.subtitle && <p className="text-sm text-muted-foreground">{heading.subtitle}</p>}
              </div>
            )}
            {status && <div className="flex flex-wrap gap-1.5">{status}</div>}
          </div>
        )}
        {children}
      </div>
      {actions && !active && (
        <div
          className={cn(
            "flex flex-wrap gap-2 border-0 border-t border-solid border-border bg-muted/60 p-3",
            "lg:w-48 lg:shrink-0 lg:flex-col lg:flex-nowrap lg:border-t-0 lg:border-l lg:p-4",
            // Same width for every action: side by side on phones, full width in the column.
            "[&>*]:flex-1 [&>*]:basis-36 lg:[&>*]:w-full lg:[&>*]:flex-none lg:[&>*]:basis-auto lg:[&>*]:justify-start",
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

export function SettingsSection({
  title,
  description,
  id,
  ...panel
}: Omit<PanelProps, "heading" | "muted"> & { title: string; description?: ReactNode }) {
  return (
    <section
      id={id}
      className="grid scroll-mt-20 gap-3 border-0 border-t border-solid border-border py-7 first:border-t-0 first:pt-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-10"
    >
      <div className="flex flex-col gap-1 md:pt-1">
        <h2 className={cn("text-base font-bold", panel.tone === "danger" && "text-destructive")}>{title}</h2>
        {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <Panel {...panel} />
    </section>
  );
}

/** A list of panels (payment methods, staff…). */
export function PanelList({ children }: { children: ReactNode }) {
  return <ul className="m-0 flex list-none flex-col gap-3 p-0">{children}</ul>;
}

/** Read-only data inside a section: label above value, columns when there is room. */
export function DataList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl className={cn("m-0 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-8 gap-y-4", className)}>
      {children}
    </dl>
  );
}

export function DataItem({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "col-span-full")}>
      <dt className="mb-0.5 text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="m-0 text-[0.95rem] leading-snug [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** "Sin cargar" (neutral) or a warning when the missing data blocks something. */
export function Missing({ children = "Sin cargar", warn = false }: { children?: ReactNode; warn?: boolean }) {
  return <span className={warn ? "text-warning" : "text-subtle-foreground"}>{children}</span>;
}
