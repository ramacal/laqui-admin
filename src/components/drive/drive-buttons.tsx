"use client";

import { useActionState } from "react";
import type { DriveActionState } from "@/app/panel/agencias/[agencyId]/drive-actions";

type Action = (prev: DriveActionState) => Promise<DriveActionState>;

export function DriveButtons({ sync, disconnect, connectHref }: { sync?: Action; disconnect: Action; connectHref: string }) {
  const [syncState, syncAction, syncing] = useActionState(sync ?? (async () => null), null);
  const [offState, offAction, leaving] = useActionState(disconnect, null);
  const state = offState ?? syncState;

  return (
    <div className="stack-xs">
      <div className="row-start">
        {sync && (
          <form action={syncAction}>
            <button type="submit" className="btn btn-secondary btn-sm" disabled={syncing}>
              {syncing ? "Sincronizando…" : "Sincronizar accesos"}
            </button>
          </form>
        )}
        <a href={connectHref} className="btn btn-secondary btn-sm">
          {sync ? "Cambiar de cuenta" : "Reconectar"}
        </a>
        <form
          action={offAction}
          onSubmit={(e) => {
            if (!confirm("¿Desconectar Google Drive? La carpeta y las imágenes quedan en ese Drive.")) e.preventDefault();
          }}
        >
          <button type="submit" className="link-btn small" disabled={leaving}>
            {leaving ? "Desconectando…" : "Desconectar"}
          </button>
        </form>
      </div>
      {state && (
        <p className={`small ${state.ok ? "ok-text" : "error"}`} role="status">
          {state.message}
        </p>
      )}
    </div>
  );
}
