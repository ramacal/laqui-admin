// Dense list inside a panel (many short items: games, products): one row per item, split by
// thin lines. Name and one detail line on the left, a single control (usually a Switch) right.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function RowList({ children }: { children: ReactNode }) {
  return <ul className="-my-2 m-0 flex list-none flex-col p-0 [&>li+li]:border-0 [&>li+li]:border-t [&>li+li]:border-solid [&>li+li]:border-border">{children}</ul>;
}

export function Row({
  title,
  detail,
  badge,
  trailing,
  muted = false,
}: {
  title: ReactNode;
  detail?: ReactNode;
  badge?: ReactNode;
  trailing?: ReactNode;
  muted?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("flex flex-wrap items-center gap-2 font-semibold", muted && "text-muted-foreground")}>
          {title}
          {badge}
        </span>
        {detail && <span className="text-sm text-muted-foreground">{detail}</span>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </li>
  );
}
