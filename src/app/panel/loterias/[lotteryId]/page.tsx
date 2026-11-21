import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/storage";
import { lotteryUsage } from "@/lib/lotteries";
import { lotteryFormOptions } from "@/lib/lottery-options";
import { LotteryForm } from "@/components/lotteries/lottery-form";
import { DeleteLotteryButton } from "@/components/lotteries/delete-lottery-button";
import { deleteLottery, removeLotteryLogo, updateLottery } from "../actions";

export const metadata = { title: "Lotería · Laqui" };

export default async function LotteryPage({ params }: { params: Promise<{ lotteryId: string }> }) {
  const { lotteryId } = await params;
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();

  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: {
      country: { select: { name: true } },
      province: { select: { name: true, _count: { select: { agencies: true } } } },
    },
  });
  if (!lottery) notFound();
  const [{ countries, provinces }, usage] = await Promise.all([lotteryFormOptions(lotteryId), lotteryUsage(lotteryId)]);

  return (
    <main className="screen">
      <Link href="/panel/loterias" className="back">
        ← Loterías
      </Link>
      <header className="row-start">
        {lottery.logoKey && (
          <span className="lottery-logo lg">
            <Image src={publicUrl(lottery.logoKey)} alt="" width={160} height={96} />
          </span>
        )}
        <div className="stack-xs">
          <h1>{lottery.province?.name ?? lottery.name}</h1>
          <span className="muted small">
            {lottery.country.name}
            {lottery.province ? ` · ${lottery.province._count.agencies} agencias en la plataforma` : " · Nacional"}
            {lottery.website && (
              <>
                {" · "}
                <a href={lottery.website} target="_blank" rel="noreferrer" className="link">
                  Web oficial
                </a>
              </>
            )}
          </span>
        </div>
      </header>

      <section className="card">
        <LotteryForm
          action={updateLottery.bind(null, lottery.id)}
          countries={countries}
          provinces={provinces}
          submitLabel="Guardar"
          hasLogo={!!lottery.logoKey}
          values={lottery}
        />
      </section>

      {lottery.logoKey && (
        <form action={removeLotteryLogo.bind(null, lottery.id)}>
          <button type="submit" className="link-btn small">
            Quitar el logo
          </button>
        </form>
      )}

      <section className="card stack-sm">
        <h2>Eliminar</h2>
        {usage > 0 ? (
          <p className="small muted">
            Tiene sorteos, resultados o provincias que ofrecen su Quiniela, así que no se puede eliminar. Para darla de baja, destildá
            &quot;Activa&quot;.
          </p>
        ) : (
          <DeleteLotteryButton action={deleteLottery.bind(null, lottery.id)} name={lottery.province?.name ?? lottery.name} />
        )}
      </section>
    </main>
  );
}
