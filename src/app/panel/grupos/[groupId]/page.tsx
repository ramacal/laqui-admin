import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { groupDetail } from "@/lib/groups";
import { prisma } from "@/lib/prisma";
import { SimpleForm } from "@/components/schedule/simple-form";
import { addAgencyAction, addOwnerAction } from "@/app/panel/grupo/actions";

export const metadata = { title: "Grupo · Laqui" };

// Platform admin: one group. Add agencies (legajo, provincia, titular, WhatsApp) and owners.
export default async function GroupAdminPage({ params }: { params: Promise<{ groupId: string }> }) {
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();
  const { groupId } = await params;
  const group = await groupDetail(groupId);
  if (!group) notFound();
  const provinces = await prisma.province.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <main className="screen">
      <Link href="/panel/grupos" className="back">
        ← Grupos y agencias
      </Link>
      <h1>{group.name}</h1>

      <section className="card stack-sm">
        <h2>Dueños</h2>
        <ul className="list plain">
          {group.owners.map((o) => (
            <li key={o.id} className="row exception-row">
              <span>{o.user?.name ?? o.email}</span>
              <span className="muted small">{o.user ? o.email : "pendiente: todavía no ingresó"}</span>
            </li>
          ))}
        </ul>
        <details>
          <summary>Agregar dueño</summary>
          <div className="spaced">
            <SimpleForm action={addOwnerAction.bind(null, group.id)} submitLabel="Agregar dueño">
              <label className="field">
                <span className="small muted">Email de Google</span>
                <input name="email" type="email" className="input" required autoComplete="off" />
              </label>
            </SimpleForm>
          </div>
        </details>
      </section>

      <section className="card stack-sm">
        <h2>Agencias</h2>
        {group.agencies.length === 0 ? (
          <p className="muted small">Todavía no tiene agencias.</p>
        ) : (
          <ul className="list plain">
            {group.agencies.map((a) => {
              const titular = [a.titularFirstName, a.titularLastName].filter(Boolean).join(" ");
              return (
                <li key={a.id} className="row exception-row">
                  <Link href={`/panel/agencias/${a.id}`} className="link">
                    {a.name}
                  </Link>
                  <span className="muted small">
                    {/^pend/i.test(a.licenseNumber) ? "Legajo pendiente" : `Legajo ${a.province.code}-${a.licenseNumber}`}
                    {titular ? ` · ${titular}` : " · titular pendiente"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <details open={group.agencies.length === 0}>
          <summary>Agregar agencia</summary>
          <div className="spaced">
            <SimpleForm action={addAgencyAction.bind(null, group.id)} submitLabel="Crear agencia">
              <div className="grid-2">
                <label className="field">
                  <span className="small muted">Nombre</span>
                  <input name="name" className="input" placeholder="La Suerte" required />
                </label>
                <label className="field">
                  <span className="small muted">Provincia</span>
                  <select name="provinceId" className="input" required defaultValue="">
                    <option value="" disabled>
                      Elegí la provincia
                    </option>
                    {provinces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="small muted">Número de legajo</span>
                  <input name="licenseNumber" className="input" placeholder="Vacío si está pendiente" />
                </label>
                <label className="field">
                  <span className="small muted">Localidad</span>
                  <input name="city" className="input" />
                </label>
                <label className="field">
                  <span className="small muted">Nombres del titular</span>
                  <input name="titularFirstName" className="input" />
                </label>
                <label className="field">
                  <span className="small muted">Apellido del titular</span>
                  <input name="titularLastName" className="input" />
                </label>
                <label className="field">
                  <span className="small muted">WhatsApp para jugadas</span>
                  <input name="cellphone" className="input" inputMode="tel" placeholder="11 5555-0000" />
                </label>
              </div>
              <p className="small muted">
                Usa el horario general del grupo y los juegos de su provincia. El logo, la dirección, el mail del titular y
                el personal se completan en la ficha de la agencia.
              </p>
            </SimpleForm>
          </div>
        </details>
      </section>
    </main>
  );
}
