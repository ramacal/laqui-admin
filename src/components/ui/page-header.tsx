import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

// Top of every panel page: back link, title, one subtitle line and, on the right, the page's
// main action ("Agregar …"), if any.
export function PageHeader({
  back,
  title,
  subtitle,
  actions,
}: {
  back?: { href: string; label: string };
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1 pt-1">
      {back && (
        <Link
          href={back.href}
          className="-ml-1 inline-flex w-fit items-center gap-0.5 rounded-md px-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[1.7rem] font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}
