import { getBoardData } from "@/lib/board";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const keys = params.get("keys");
  const keyLimit = keys !== null ? Number(keys) : undefined;

  const date = params.get("date");
  const data = await getBoardData({
    previewTakeover: params.get("takeover") === "1",
    previewEvent: params.get("event") === "1",
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    keyLimit: Number.isFinite(keyLimit) ? keyLimit : undefined,
  });

  return Response.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
