import { notFound } from "next/navigation";
import { BoardShell } from "@/components/BoardShell";
import { ThemeScope } from "@/components/ThemeScope";
import { getBoardData } from "@/lib/board";
import { resolveTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

const SCREEN_IDS = ["1", "2", "3"];

export default async function ScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!SCREEN_IDS.includes(id)) notFound();

  const query = await searchParams;
  const previewTakeover = query.takeover === "1";
  const { theme, accent } = resolveTheme(query);

  const keysParam = Array.isArray(query.keys) ? query.keys[0] : query.keys;
  const keyLimit = keysParam !== undefined ? Number(keysParam) : undefined;

  const data = await getBoardData({
    previewTakeover,
    keyLimit: Number.isFinite(keyLimit) ? keyLimit : undefined,
  });

  return (
    <ThemeScope theme={theme} accent={accent}>
      <BoardShell
        initial={data}
        screenId={id}
        // ?keyslide=1 pins the key slide on, rather than waiting out its cycle.
        forceKeySlide={query.keyslide === "1"}
      />
    </ThemeScope>
  );
}
