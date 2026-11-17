// Fields of an agency customer (used to add and to edit).
type Values = { firstName?: string; lastName?: string | null; alias?: string; phone?: string | null; dni?: string | null; notes?: string | null };

export function CustomerFields({ values }: { values?: Values }) {
  return (
    <>
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Nombre</span>
          <input name="firstName" className="input" required maxLength={60} defaultValue={values?.firstName} placeholder="Juan" />
        </label>
        <label className="field">
          <span className="small muted">Apellido</span>
          <input name="lastName" className="input" maxLength={60} defaultValue={values?.lastName ?? ""} placeholder="Pérez" />
        </label>
      </div>
      <label className="field">
        <span className="small muted">Alias: cómo lo conocen en la agencia (si no, el nombre)</span>
        <input name="alias" className="input" maxLength={60} defaultValue={values?.alias} placeholder="Juan del kiosco" />
      </label>
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Celular, con código de área</span>
          <input name="phone" className="input" inputMode="tel" defaultValue={values?.phone ?? ""} placeholder="11 5555-0000" />
        </label>
        <label className="field">
          <span className="small muted">DNI (opcional)</span>
          <input name="dni" className="input" inputMode="numeric" defaultValue={values?.dni ?? ""} placeholder="30.123.456" />
        </label>
      </div>
      <label className="field">
        <span className="small muted">Nota (opcional)</span>
        <input name="notes" className="input" maxLength={200} defaultValue={values?.notes ?? ""} />
      </label>
    </>
  );
}
