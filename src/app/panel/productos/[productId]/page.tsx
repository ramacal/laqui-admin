import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { agenciesOwnedBy, todayIn } from "@/lib/schedule";
import { SimpleForm } from "@/components/schedule/simple-form";
import { PriceForm, PriceHistory } from "@/components/products/price-parts";
import {
  addOwnerProductPrice,
  deleteOwnerProductPrice,
  setOwnerProductActive,
  setOwnerProductAgencies,
  updateOwnerProduct,
} from "../actions";

export const metadata = { title: "Producto · Laqui" };
const TZ = "America/Argentina/Buenos_Aires";
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function OwnerProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const access = await requireAccess();
  const product = await prisma.ownerProduct.findUnique({
    where: { id: productId },
    include: { prices: true, agencies: { select: { agencyId: true } } },
  });
  if (!product || (!access.isPlatformAdmin && product.ownerUserId !== access.user.id)) notFound();

  const today = todayIn(TZ);
  const agencies = await agenciesOwnedBy(product.ownerUserId);
  const offered = new Set(product.agencies.map((a) => a.agencyId));
  const rows = product.prices.map((p) => ({
    id: p.id,
    amount: p.amount.toString(),
    validFrom: iso(p.validFrom),
    note: p.note,
  }));

  return (
    <main className="screen">
      <Link href="/panel/productos" className="back">
        ← Productos
      </Link>
      <div className="row">
        <h1>{product.name}</h1>
        <form action={setOwnerProductActive.bind(null, product.id, !product.active)}>
          <button type="submit" className={`btn btn-sm ${product.active ? "btn-secondary" : "btn-primary"}`}>
            {product.active ? "Pausar" : "Activar"}
          </button>
        </form>
      </div>
      {!product.active && <p className="warn small">Pausado: no se ofrece en ninguna agencia.</p>}

      <section className="card stack-sm">
        <h2>Precio por unidad</h2>
        <PriceHistory rows={rows} today={today} deleteAction={deleteOwnerProductPrice} />
        <details>
          <summary>Cambiar precio</summary>
          <div className="spaced">
            <PriceForm action={addOwnerProductPrice.bind(null, product.id)} today={today} />
            <p className="muted small">Con una fecha futura, el cambio queda programado y el precio actual sigue hasta ese día.</p>
          </div>
        </details>
      </section>

      <section className="card stack-sm">
        <h2>Se ofrece en</h2>
        <SimpleForm action={setOwnerProductAgencies.bind(null, product.id)} submitLabel="Guardar agencias">
          <ul className="list plain">
            {agencies.map((a) => (
              <li key={a.id}>
                <label className="check">
                  <input type="checkbox" name="agencyId" value={a.id} defaultChecked={offered.has(a.id)} aria-label={a.name} />
                  <span>{a.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </SimpleForm>
      </section>

      <section className="card stack-sm">
        <h2>Datos</h2>
        <SimpleForm action={updateOwnerProduct.bind(null, product.id)} submitLabel="Guardar datos">
          <label className="field">
            <span className="small muted">Nombre</span>
            <input name="name" className="input" defaultValue={product.name} required maxLength={120} />
          </label>

          <fieldset className="segmented">
            <legend className="small muted">Cómo se vende</legend>
            <label>
              <input type="radio" name="saleMode" value="PHYSICAL" defaultChecked={product.saleMode === "PHYSICAL"} />
              <span>Físico (se cuenta en la caja)</span>
            </label>
            <label>
              <input type="radio" name="saleMode" value="MACHINE" defaultChecked={product.saleMode !== "PHYSICAL"} />
              <span>No se cuenta en la caja</span>
            </label>
          </fieldset>
          <label className="field">
            <span className="small muted">Descripción</span>
            <textarea name="description" className="input textarea" rows={2} maxLength={500} defaultValue={product.description ?? ""} />
          </label>
          <div className="grid-2">
            <label className="field">
              <span className="small muted">Se vende desde</span>
              <input type="date" name="availableFrom" className="input" defaultValue={iso(product.availableFrom)} />
            </label>
            <label className="field">
              <span className="small muted">Se vende hasta</span>
              <input type="date" name="availableUntil" className="input" defaultValue={iso(product.availableUntil)} />
            </label>
          </div>
        </SimpleForm>
      </section>
    </main>
  );
}
