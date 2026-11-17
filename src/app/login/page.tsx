import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { getAccess } from "@/lib/access";

export const metadata = { title: "Ingresar · Laqui" };

export default async function LoginPage() {
  if (await getAccess()) redirect("/panel");

  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <main className="screen center">
      <section className="card stack">
        <div className="stack-sm">
          <h1>Laqui</h1>
          <p className="muted">Ingresá con tu cuenta de Google para acceder al panel de tu agencia.</p>
        </div>
        {googleConfigured ? (
          <GoogleSignInButton />
        ) : (
          <p className="notice">
            Falta configurar Google: completá <code>GOOGLE_CLIENT_ID</code> y <code>GOOGLE_CLIENT_SECRET</code> en{" "}
            <code>.env</code> y reiniciá el servidor.
          </p>
        )}
      </section>
    </main>
  );
}
