// GET …/redes/{ideaId}/imagen?formato=story|feed|cuadrado&fecha=YYYY-MM-DD&titulo=…&descargar=1
// Branded picture of an idea for one agency (spec social-content "Branded Picture").
import { agencyRole, getAccess } from "@/lib/access";
import { ideaPicture, pictureFileName } from "@/lib/content/picture";

export async function GET(req: Request, { params }: { params: Promise<{ agencyId: string; ideaId: string }> }) {
  const { agencyId, ideaId } = await params;
  const access = await getAccess();
  if (!access || !agencyRole(access, agencyId)) return new Response("No encontrado", { status: 404 });

  const q = new URL(req.url).searchParams;
  const result = await ideaPicture(agencyId, ideaId, { format: q.get("formato"), date: q.get("fecha"), title: q.get("titulo") });
  if (!result) return new Response("No encontrado", { status: 404 });
  const { picture, date, format, idea } = result;

  const headers = new Headers(picture.headers);
  // Same URL = same picture (format, date and title are in it): the browser may reuse it for 5 minutes.
  headers.set("Cache-Control", "private, max-age=300");
  if (q.get("descargar")) headers.set("Content-Disposition", `attachment; filename="${pictureFileName(date, idea.title, format)}"`);
  return new Response(picture.body, { status: picture.status, headers });
}
