"use client";

// The panel's one way to edit something on a configuration screen: a settings section that
// shows its data read-only, with "Editar" first in the panel's actions column. Editing swaps the
// data for the form in the same place; the form ends with <FormActions> (Cancelar + Guardar).
// Saving closes it and shows the result for a moment. Sections always start closed: missing data
// shows as a warning in the view. The button says "Cargar" only when the section is entirely
// empty; with anything loaded it says "Editar". Dangerous actions say what they do, in red.
import { Fragment, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import type { FormState } from "@/app/panel/horarios/actions";
import { Button } from "@/components/ui/button";
import { Panel, SettingsSection } from "@/components/ui/settings-section";

type EditableContext = { close: (message?: string) => void };
const Ctx = createContext<EditableContext | null>(null);

/** Open/close state shared by sections and list items; the saved message shows for 4 seconds. */
function useEditing(initial: string | null = null) {
  // null: showing the data; "edit": the main form; any other key: one of the extra forms.
  const [editing, setEditing] = useState<string | null>(initial);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);
  return {
    editing,
    flash,
    open: (key = "edit") => {
      setFlash(null);
      setEditing(key);
    },
    ctx: {
      close: (message?: string) => {
        setEditing(null);
        setFlash(message ?? null);
      },
    } satisfies EditableContext,
  };
}

function Flash({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="flex items-center gap-1.5 text-sm text-success">
      <Check className="size-4" /> {message}
    </p>
  );
}

/** Another action of the panel that needs a few fields first (e.g. "Dar de baja" asks the date). */
export type PanelForm = { key: string; label: string; icon?: ReactNode; tone?: "danger"; form: ReactNode };

export function EditableSection({
  title,
  description,
  subtitle,
  status,
  view,
  actions,
  forms = [],
  children,
  item = false,
  muted = false,
  empty = false,
  canEdit = true,
  tone,
  actionLabel,
  addLabel,
  defaultOpen = false,
  id,
}: {
  title: string;
  description?: ReactNode; // settings section: stays visible while editing
  subtitle?: ReactNode; // list item: one line under the name
  status?: ReactNode; // badges at the top of the data
  view?: ReactNode; // read-only data (usually a <DataList>)
  actions?: ReactNode; // more actions for the column, after Editar (e.g. "Pausar")
  forms?: PanelForm[]; // actions that open their own form in the panel, after `actions`
  children?: ReactNode; // the Editar form, ending with <FormActions>
  item?: boolean; // a list item (its name inside the panel) instead of a settings section
  muted?: boolean; // list item paused / inactive
  empty?: boolean; // nothing loaded yet: the button says "Cargar"
  canEdit?: boolean;
  tone?: "danger"; // irreversible or heavy actions (zona de cuidado)
  actionLabel?: string; // danger sections: what the button does ("Pasar a otro grupo")
  addLabel?: string; // the form adds an item to the list shown ("Agregar excepción"): "+" button with this label
  defaultOpen?: boolean; // arrive with the form open (e.g. a link that prefills it)
  id?: string;
}) {
  const { editing, flash, open, ctx } = useEditing(defaultOpen ? "edit" : null);
  const extra = forms.find((f) => f.key === editing);

  const edit = !canEdit || !children ? null : tone === "danger" ? (
    <Button variant="destructive-outline" size="sm" onClick={() => open()}>
      {actionLabel ?? "Continuar"}
    </Button>
  ) : addLabel ? (
    <Button variant="outline" size="sm" onClick={() => open()}>
      <Plus /> {addLabel}
    </Button>
  ) : (
    <Button variant="outline" size="sm" onClick={() => open()} aria-label={`${empty ? "Cargar" : "Editar"} ${title.toLowerCase()}`}>
      {empty ? <Plus /> : <Pencil />} {empty ? "Cargar" : "Editar"}
    </Button>
  );
  const formButtons = forms.map((f) => (
    <Button key={f.key} variant={f.tone === "danger" ? "destructive-outline" : "outline"} size="sm" onClick={() => open(f.key)}>
      <Fragment key="icon">{f.icon}</Fragment> {f.label}
    </Button>
  ));
  const hasActions = Boolean(edit || actions || forms.length);

  const panel = {
    id,
    tone: extra ? extra.tone : tone,
    status,
    active: editing !== null,
    actions: hasActions ? (
      <>
        <Fragment key="edit">{edit}</Fragment>
        <Fragment key="actions">{actions}</Fragment>
        {formButtons}
      </>
    ) : undefined,
    children:
      editing !== null ? (
        <Ctx.Provider value={ctx}><Fragment key={editing}>{extra ? extra.form : children}</Fragment></Ctx.Provider>
      ) : (
        <>
          {view}
          <Flash message={flash} />
        </>
      ),
  };

  return item ? (
    <Panel {...panel} muted={muted} heading={{ title, subtitle }} />
  ) : (
    <SettingsSection {...panel} title={title} description={description} />
  );
}
/**
 * A list with its "Agregar …" button: a bar with the count on the left and the button on the
 * right; the form opens right under it, in a panel, and closes when saved.
 */
export function AddableList({
  count,
  addLabel,
  formTitle,
  form,
  children,
  defaultOpen = false,
  id,
}: {
  count: string; // "4 medios de cobro"
  addLabel: string; // "Agregar medio de cobro"
  formTitle: string; // "Nuevo medio de cobro"
  form: ReactNode; // ends with <FormActions>
  children: ReactNode; // the items (<PanelList>)
  defaultOpen?: boolean; // arrive with the form open (e.g. a link that prefills it)
  id?: string; // anchor for such links
}) {
  const { editing, flash, open, ctx } = useEditing(defaultOpen ? "edit" : null);
  return (
    <div id={id} className="flex scroll-mt-20 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{count}</span>
        {!editing && (
          <Button size="sm" onClick={() => open()}>
            <Plus /> {addLabel}
          </Button>
        )}
      </div>
      <Flash message={flash} />
      {editing && (
        <Panel active heading={{ title: formTitle }}>
          <Ctx.Provider value={ctx}>{form}</Ctx.Provider>
        </Panel>
      )}
      {children}
    </div>
  );
}

/**
 * One value edited right where it is shown (a line of the Caja diaria sheet): the row gets a
 * pencil at the end (a 2.25rem slot, so rows without one can keep the same space); editing swaps
 * the row for the form (ending with <FormActions>), framed like a panel being edited.
 */
export function InlineEdit({ view, label, children }: { view: ReactNode; label: string; children: ReactNode }) {
  const { editing, flash, open, ctx } = useEditing();
  if (editing)
    return (
      <div className="my-1 rounded-lg border border-solid border-primary p-3 ring-4 ring-accent">
        <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
      </div>
    );
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{view}</div>
        <span className="flex w-9 shrink-0 justify-end">
          <Button variant="quiet" size="icon" onClick={() => open()} aria-label={label} title={label}>
            <Pencil />
          </Button>
        </span>
      </div>
      <Flash message={flash} />
    </>
  );
}

/**
 * Footer of every panel form: result message, then Cancelar (inside an EditableSection) and the
 * submit button, right-aligned and sized to their text. A successful save closes the section.
 */
export function FormActions({
  state,
  pending,
  submitLabel = "Guardar",
  danger = false,
}: {
  state: FormState;
  pending: boolean;
  submitLabel?: string;
  danger?: boolean;
}) {
  const section = useContext(Ctx);
  useEffect(() => {
    if (state?.ok && section) section.close(state.message);
  }, [state, section]);

  return (
    <div className="mt-1 flex flex-wrap items-center justify-end gap-2 border-0 border-t border-solid border-border pt-4">
      {state && !(state.ok && section) && (
        <p role="status" className={`mr-auto text-sm ${state.ok ? "text-success" : "text-destructive"}`}>
          {state.message}
        </p>
      )}
      {section && (
        <Button variant="ghost" size="sm" onClick={() => section.close()} disabled={pending}>
          Cancelar
        </Button>
      )}
      <Button type="submit" variant={danger ? "destructive" : "default"} size="sm" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </div>
  );
}
