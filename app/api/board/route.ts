import { getBoardData } from "@/lib/board";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const previewTakeover =
    new URL(request.url).searchParams.get("takeover") === "1";
  const data = await getBoardData({ previewTakeover });

  return Response.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
