import Link from "next/link";

export default function HomePage() {
  return (
    <main className="screen center">
      <section className="card stack-sm">
        <h1>Laqui</h1>
        <p className="muted">Captura guiada de jugadas por agencia, con envío por WhatsApp.</p>
        <Link href="/login" className="btn btn-google">
          Ingresar al panel
        </Link>
      </section>
    </main>
  );
}
