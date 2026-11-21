// Dashboard card (Estado de la agencia): a white card with its title, an optional "Ver …" link
// to the section it summarizes, and its content (usually a RowList).
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function DashCard({
  title,
  link,
  children,
}: {
  title: string;
  link?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-solid border-border bg-card p-4 shadow-[0_1px_2px_rgba(19,20,43,0.05)] sm:p-5">
      <header className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-base font-bold">{title}</h2>
        {link && (
          <Link href={link.href} className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary hover:underline">
            {link.label}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}
