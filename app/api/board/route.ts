import { getBoardData } from "@/lib/board";
import { ACCENTS, THEMES, type Accent } from "@/lib/theme";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const keys = params.get("keys");
  const keyLimit = keys !== null ? Number(keys) : undefined;

  const date = params.get("date");
  const theme = params.get("theme");
  const accent = params.get("accent");
  const screen = params.get("screen");

  const data = await getBoardData({
    previewTakeover: params.get("takeover") === "1",
    previewEvent: params.get("event") === "1",
    previewOccasion: params.get("occasion") === "1",
    previewPiket: params.get("piket") === "1",
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    keyLimit: Number.isFinite(keyLimit) ? keyLimit : undefined,
    screenId: screen ?? undefined,
    buildStampOverride: params.get("build") ?? undefined,
    themeOverride: THEMES.includes(theme as "light" | "dark")
      ? (theme as "light" | "dark")
      : undefined,
    accentOverride: ACCENTS.includes(accent as Accent)
      ? (accent as Accent)
      : undefined,
  });

  return Response.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
