"use client";

// Picture preview in three sizes with an editable headline, and the caption to copy
// (or a prompt to iterate it in the user's own AI chat). Edits stay in the browser.
import { useEffect, useMemo, useState, useTransition } from "react";
import { aiPrompt, type AgencyText, type PresentedIdeaText } from "@/lib/content/text";
import type { DriveActionState } from "@/app/panel/agencias/[agencyId]/drive-actions";

const FORMATS = [
  { id: "story", label: "Historia / reel", ratio: "9 / 16" },
  { id: "feed", label: "Feed 4:5", ratio: "4 / 5" },
  { id: "cuadrado", label: "Cuadrado", ratio: "1 / 1" },
] as const;

type Props = {
  imageBase: string;
  date: string;
  headline: string;
  caption: string;
  idea: PresentedIdeaText;
  agency: AgencyText;
  /** Agency Google Drive: null = not connected (spec agency-google-drive "Save Picture to Drive"). */
  drive: { status: "ACTIVE" | "NEEDS_RECONNECT" | null; agencyHref: string };
  saveToDrive: (input: { format: string; date: string; title: string | null }) => Promise<DriveActionState>;
};

export function PostEditor({ imageBase, date, headline: suggested, caption: suggestedCaption, idea, agency, drive, saveToDrive }: Props) {
  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("story");
  const [headline, setHeadline] = useState(suggested);
  const [rendered, setRendered] = useState(suggested); // debounced: one render per pause, not per key
  const [caption, setCaption] = useState(suggestedCaption);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [saved, setSaved] = useState<DriveActionState>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => setRendered(headline.trim() || suggested), 600);
    return () => clearTimeout(t);
  }, [headline, suggested]);

  const src = useMemo(() => {
    const q = new URLSearchParams({ formato: format, fecha: date });
    if (rendered !== suggested) q.set("titulo", rendered);
    return `${imageBase}?${q}`;
  }, [imageBase, format, date, rendered, suggested]);

  const loading = loadedSrc !== src;

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied("error");
    }
  }

  const ratio = FORMATS.find((f) => f.id === format)!.ratio;

  function save() {
    setSaved(null);
    startSaving(async () => {
      try {
        setSaved(await saveToDrive({ format, date, title: rendered !== suggested ? rendered : null }));
      } catch {
        setSaved({ ok: false, message: "No se pudo guardar en Drive. Probá de nuevo." });
      }
    });
  }

  return (
    <div className="post-editor">
      <section className="card stack-sm">
        <div className="row">
          <h2>Imagen</h2>
          <div className="row-start">
            {drive.status === "ACTIVE" && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={save} disabled={saving}>
                {saving ? "Guardando…" : "Guardar en Drive"}
              </button>
            )}
            <a href={`${src}&descargar=1`} className="btn btn-primary btn-sm" download>
              Descargar PNG
            </a>
          </div>
        </div>
        {saved ? (
          <p className={`small ${saved.ok ? "ok-text" : "error"}`} role="status">
            {saved.message}
            {saved.link && (
              <>
                {" · "}
                <a href={saved.link} target="_blank" rel="noreferrer" className="link">
                  Abrir en Drive
                </a>
              </>
            )}
          </p>
        ) : drive.status !== "ACTIVE" ? (
          <p className="small muted">
            {drive.status === "NEEDS_RECONNECT"
              ? "Hay que reconectar el Google Drive de la agencia para guardar imágenes ahí. "
              : "Conectá el Google Drive de la agencia para guardar las imágenes ahí. "}
            <a href={drive.agencyHref} className="link">
              Ir a los datos de la agencia
            </a>
          </p>
        ) : null}
        <div className="tabs" role="tablist" aria-label="Tamaño">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={format === f.id}
              className={`tab ${format === f.id ? "is-active" : ""}`}
              onClick={() => setFormat(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="post-preview" style={{ aspectRatio: ratio }} aria-busy={loading}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Vista previa: ${rendered}`} onLoad={() => setLoadedSrc(src)} onError={() => setLoadedSrc(src)} />
          {loading && <span className="post-loading small">Generando…</span>}
        </div>
        <label className="field">
          <span className="label">Título de la imagen</span>
          <input className="input" value={headline} maxLength={160} onChange={(e) => setHeadline(e.target.value)} />
        </label>
        {headline !== suggested && (
          <button type="button" className="link-btn small" onClick={() => setHeadline(suggested)}>
            Volver al título sugerido
          </button>
        )}
      </section>

      <section className="card stack-sm">
        <h2>Texto del posteo</h2>
        <textarea className="input textarea caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={12} />
        <div className="row-start">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => copy(caption, "caption")}>
            {copied === "caption" ? "¡Copiado!" : "Copiar texto"}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(aiPrompt(idea, agency, caption), "prompt")}>
            {copied === "prompt" ? "¡Copiado!" : "Copiar pedido para la IA"}
          </button>
          {caption !== suggestedCaption && (
            <button type="button" className="link-btn small" onClick={() => setCaption(suggestedCaption)}>
              Volver al sugerido
            </button>
          )}
        </div>
        <p className="small muted">
          {copied === "error"
            ? "No se pudo copiar: seleccioná el texto y copialo a mano."
            : "El pedido para la IA lleva la idea, los números y tu borrador: pegalo en tu chat de IA para mejorarlo."}
        </p>
      </section>
    </div>
  );
}
