// Fields of an agency staff member (used to add and to edit).
import type { EmployeeRole, EmployeeShift } from "@/generated/prisma/enums";
import { formatCellphone } from "@/lib/phone";

type Values = {
  firstName: string;
  lastName: string;
  role: EmployeeRole;
  email: string | null;
  cuil: string | null;
  phone: string | null;
  hiredAt: Date | null;
  jobTitle: string | null;
  shift: EmployeeShift | null;
  notes: string | null;
  socialMediaConsent: boolean;
  publicName: string | null;
  consentAt: Date | null;
};

const SHIFT_OPTIONS: { value: EmployeeShift; label: string }[] = [
  { value: "MORNING", label: "Turno mañana" },
  { value: "AFTERNOON", label: "Turno tarde" },
  { value: "FULL_DAY", label: "Jornada completa" },
  { value: "ROTATING", label: "Rotativo" },
];

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export function EmployeeFields({
  values,
  roles,
  isOwnerRow = false,
}: {
  values?: Values;
  /** Roles the signed-in user can give. */
  roles: { value: EmployeeRole; label: string }[];
  /** The titular: no role or email here. */
  isOwnerRow?: boolean;
}) {
  return (
    <>
      <div className="grid-2">
        <label className="field">
          <span className="small muted">Nombre</span>
          <input name="firstName" className="input" required maxLength={60} defaultValue={values?.firstName} />
        </label>
        <label className="field">
          <span className="small muted">Apellido</span>
          <input name="lastName" className="input" required maxLength={60} defaultValue={values?.lastName} />
        </label>
      </div>

      {!isOwnerRow && (
        <div className="grid-2">
          <label className="field">
            <span className="small muted">Rol en el panel</span>
            <select name="role" className="input" defaultValue={values?.role ?? "EMPLOYEE"}>
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="small muted">Email de Google (para entrar al panel)</span>
            <input name="email" type="email" className="input" defaultValue={values?.email ?? ""} placeholder="nombre@gmail.com" />
          </label>
        </div>
      )}

      <div className="grid-2">
        <label className="field">
          <span className="small muted">Puesto</span>
          <input name="jobTitle" className="input" maxLength={60} defaultValue={values?.jobTitle ?? ""} placeholder="Cajera" />
        </label>
        <label className="field">
          <span className="small muted">Turno</span>
          <select name="shift" className="input" defaultValue={values?.shift ?? ""}>
            <option value="">Sin definir</option>
            {SHIFT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid-2">
        <label className="field">
          <span className="small muted">Fecha de ingreso</span>
          <input name="hiredAt" type="date" className="input" defaultValue={day(values?.hiredAt)} />
        </label>
        <label className="field">
          <span className="small muted">CUIL (opcional)</span>
          <input name="cuil" className="input" inputMode="numeric" defaultValue={values?.cuil ?? ""} placeholder="20-30123456-3" />
        </label>
      </div>

      <label className="field">
        <span className="small muted">Celular, con código de área (opcional)</span>
        <input
          name="phone"
          className="input"
          inputMode="tel"
          defaultValue={formatCellphone(values?.phone) ?? ""}
          placeholder="11 5555-0000"
        />
      </label>

      {!isOwnerRow && (
        <fieldset className="stack-xs">
          <label className="check">
            <input name="socialMediaConsent" type="checkbox" defaultChecked={values?.socialMediaConsent} />
            <span className="small">Firmó el permiso para salir en redes</span>
          </label>
          <div className="grid-2">
            <label className="field">
              <span className="small muted">Nombre para redes</span>
              <input name="publicName" className="input" maxLength={40} defaultValue={values?.publicName ?? ""} placeholder="Marisa" />
            </label>
            <label className="field">
              <span className="small muted">Fecha del permiso</span>
              <input name="consentAt" type="date" className="input" defaultValue={day(values?.consentAt)} />
            </label>
          </div>
        </fieldset>
      )}

      <label className="field">
        <span className="small muted">Nota (opcional)</span>
        <input name="notes" className="input" maxLength={300} defaultValue={values?.notes ?? ""} />
      </label>
    </>
  );
}
