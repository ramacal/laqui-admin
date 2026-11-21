import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { lotteryFormOptions } from "@/lib/lottery-options";
import { LotteryForm } from "@/components/lotteries/lottery-form";
import { createLottery } from "../actions";

export const metadata = { title: "Nueva lotería · Laqui" };

export default async function NewLotteryPage() {
  const access = await requireAccess();
  if (!access.isPlatformAdmin) notFound();
  const { countries, provinces } = await lotteryFormOptions(null);

  return (
    <main className="screen">
      <Link href="/panel/loterias" className="back">
        ← Loterías
      </Link>
      <h1>Nueva lotería</h1>
      <section className="card">
        <LotteryForm
          action={createLottery}
          countries={countries}
          provinces={provinces}
          submitLabel="Crear lotería"
          hasLogo={false}
          values={{
            code: "",
            name: "",
            fullName: null,
            countryId: countries.find((c) => c.name === "Argentina")?.id ?? countries[0]?.id ?? "",
            provinceId: null,
            website: null,
            brandPrimaryColor: null,
            brandSecondaryColor: null,
            quinielaDraws: false,
            active: true,
          }}
        />
      </section>
    </main>
  );
}
