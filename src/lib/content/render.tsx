// Branded picture for an idea (spec social-content "Branded Picture"), rendered with next/og
// (satori + resvg, bundled with Next). Typographic on purpose: no photos of real people.
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { publicUrl } from "@/lib/storage";
import type { IdeaNumber } from "./numbers";

export const FORMATS = {
  story: { width: 1080, height: 1920, label: "Historia / reel" },
  feed: { width: 1080, height: 1350, label: "Feed 4:5" },
  cuadrado: { width: 1080, height: 1080, label: "Cuadrado" },
} as const;
export type Format = keyof typeof FORMATS;
export const isFormat = (s: unknown): s is Format => typeof s === "string" && s in FORMATS;

export type PictureInput = {
  format: Format;
  headline: string;
  dateLabel: string;
  main: IdeaNumber | undefined;
  others: IdeaNumber[];
  agency: { name: string; instagram: string | null; logoKey: string | null };
  lottery: { logoKey: string | null };
  colors: { primary: string; secondary: string };
  footer: string;
};

// ─── Fonts: Source Sans 3 (style guide), fetched once; default font if offline ───

let fontsPromise: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700 | 900 }[]> | null = null;

async function loadFonts() {
  const weights = [400, 700, 900] as const;
  const fonts = await Promise.all(
    weights.map(async (weight) => {
      const css = await fetch(`https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@${weight}`).then((r) => r.text());
      const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
      if (!url) throw new Error("Source Sans 3: no TTF in the CSS");
      return { name: "Source Sans 3", data: await fetch(url).then((r) => r.arrayBuffer()), weight };
    }),
  );
  return fonts;
}

function fonts() {
  fontsPromise ??= loadFonts().catch((err) => {
    console.warn("Picture fonts unavailable, using the default font:", err);
    fontsPromise = null; // retry next time
    return [];
  });
  return fontsPromise;
}

/** A stored logo as a PNG data URI (satori does not read WebP), or null. */
// Logos as data URIs, kept in memory so each picture does not download and convert them again.
// Lottery logo keys change on every upload; agency logo keys do not, hence the expiry.
const LOGO_TTL_MS = 10 * 60 * 1000;
const logoCache = new Map<string, { at: number; data: Promise<string | null> }>();

function logoData(key: string | null) {
  if (!key) return Promise.resolve(null);
  const hit = logoCache.get(key);
  if (hit && Date.now() - hit.at < LOGO_TTL_MS) return hit.data;
  const data = loadLogo(key);
  logoCache.set(key, { at: Date.now(), data });
  if (logoCache.size > 200) logoCache.delete(logoCache.keys().next().value!);
  return data;
}

async function loadLogo(key: string) {
  try {
    const res = await fetch(publicUrl(key));
    if (!res.ok) return null;
    const png = await sharp(Buffer.from(await res.arrayBuffer())).resize(400, 400, { fit: "inside" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Readable text on a background color. */
function inkOn(hex: string) {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return "#ffffff";
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? "#13142b" : "#ffffff";
}

export async function renderPicture(input: PictureInput) {
  const { width, height } = FORMATS[input.format];
  const [font, agencyLogo, lotteryLogo] = await Promise.all([fonts(), logoData(input.agency.logoKey), logoData(input.lottery.logoKey)]);
  const tall = input.format === "story";
  const square = input.format === "cuadrado";
  const ink = inkOn(input.colors.primary);
  const accentInk = inkOn(input.colors.secondary);
  const headlineSize = input.headline.length > 70 ? (square ? 52 : 62) : square ? 62 : 76;
  const numberSize = tall ? 380 : square ? 220 : 280;

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: tall ? "110px 80px 90px" : "64px 72px 56px",
          background: `linear-gradient(160deg, ${input.colors.primary} 0%, ${input.colors.primary} 55%, ${shade(input.colors.primary)} 100%)`,
          color: ink,
          fontFamily: font.length ? "Source Sans 3" : undefined,
        }}
      >
        {/* Top: official lottery logo and date */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {lotteryLogo ? (
            // White pill: most official logos are JPGs on white.
            <div style={{ display: "flex", padding: "12px 22px", borderRadius: 24, background: "#ffffff" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lotteryLogo}
                alt=""
                width={tall ? 300 : 240}
                height={tall ? 100 : 76}
                style={{ objectFit: "contain" }}
              />
            </div>
          ) : (
            <div style={{ display: "flex" }} />
          )}
          <div
            style={{
              display: "flex",
              fontSize: tall ? 40 : 34,
              fontWeight: 700,
              padding: "12px 28px",
              borderRadius: 999,
              background: input.colors.secondary,
              color: accentInk,
            }}
          >
            {input.dateLabel}
          </div>
        </div>

        {/* Middle: headline, big number, meaning */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: tall ? 36 : 18 }}>
          <div style={{ display: "flex", fontSize: headlineSize, fontWeight: 900, lineHeight: 1.08, justifyContent: "center" }}>
            {input.headline}
          </div>
          {input.main && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", fontSize: tall ? 40 : 32, fontWeight: 700, opacity: 0.85 }}>Jugale al</div>
              <div style={{ display: "flex", fontSize: numberSize, fontWeight: 900, lineHeight: 1, color: input.colors.secondary }}>
                {input.main.value}
              </div>
              {input.main.meaning && (
                <div style={{ display: "flex", fontSize: tall ? 52 : 40, fontWeight: 700 }}>{input.main.meaning}</div>
              )}
            </div>
          )}
          {input.others.length > 0 && (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
              {input.others.map((n) => (
                <div
                  key={n.value}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "10px 26px",
                    borderRadius: 20,
                    border: `3px solid ${ink === "#ffffff" ? "rgba(255,255,255,0.5)" : "rgba(19,20,43,0.4)"}`,
                  }}
                >
                  <div style={{ display: "flex", fontSize: tall ? 56 : 44, fontWeight: 900 }}>{n.value}</div>
                  <div style={{ display: "flex", fontSize: 24, opacity: 0.85 }}>{n.meaning ?? n.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom: agency card and responsible-gaming line */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
              padding: "24px 32px",
              borderRadius: 32,
              background: "#ffffff",
              color: "#13142b",
            }}
          >
            {agencyLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agencyLogo} alt="" width={tall ? 130 : 104} height={tall ? 130 : 104} style={{ objectFit: "contain" }} />
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: tall ? 48 : 40, fontWeight: 900 }}>{input.agency.name}</div>
              {input.agency.instagram && (
                <div style={{ display: "flex", fontSize: tall ? 36 : 30, color: "#5b5e74" }}>@{input.agency.instagram}</div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", fontSize: 24, opacity: 0.8 }}>{input.footer}</div>
        </div>
      </div>
    ),
    { width, height, fonts: font },
  );
}

/** A darker version of a color for the gradient. */
function shade(hex: string) {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return hex;
  return `#${m
    .slice(1)
    .map((h) => Math.round(parseInt(h, 16) * 0.55).toString(16).padStart(2, "0"))
    .join("")}`;
}
