"use client";

import { useActionState } from "react";
import { ArrowLeftRight, ExternalLink, RefreshCw } from "lucide-react";
import type { DriveActionState } from "@/app/panel/agencias/[agencyId]/drive-actions";
import { Button, buttonVariants } from "@/components/ui/button";

type Action = (prev: DriveActionState) => Promise<DriveActionState>;

// Drive actions, as the items of a settings panel's actions column (see SettingsSection).
export function DriveButtons({
  sync,
  disconnect,
  connectHref,
  folderHref,
}: {
  sync?: Action;
  disconnect: Action;
  connectHref: string;
  folderHref?: string;
}) {
  const [syncState, syncAction, syncing] = useActionState(sync ?? (async () => null), null);
  const [offState, offAction, leaving] = useActionState(disconnect, null);
  const state = offState ?? syncState;

  return (
    <>
      {folderHref && (
        <a href={folderHref} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ExternalLink /> Abrir carpeta
        </a>
      )}
      {sync && (
        <form action={syncAction} className="flex">
          <Button type="submit" variant="outline" size="sm" disabled={syncing} className="flex-1 lg:justify-start">
            <RefreshCw /> {syncing ? "Sincronizando…" : "Sincronizar"}
          </Button>
        </form>
      )}
      <a href={connectHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <ArrowLeftRight /> {sync ? "Cambiar de cuenta" : "Reconectar"}
      </a>
      <form
        action={offAction}
        className="flex"
        onSubmit={(e) => {
          if (!confirm("¿Desconectar Google Drive? La carpeta y las imágenes quedan en ese Drive.")) e.preventDefault();
        }}
      >
        <Button type="submit" variant="destructive-outline" size="sm" disabled={leaving} className="flex-1 lg:justify-start">
          {leaving ? "Desconectando…" : "Desconectar"}
        </Button>
      </form>
      {state && (
        <p className={`!basis-full text-sm ${state.ok ? "text-success" : "text-destructive"}`} role="status">
          {state.message}
        </p>
      )}
    </>
  );
}
