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

  const dateParam = Array.isArray(query.date) ? query.date[0] : query.date;
  const data = await getBoardData({
    previewTakeover,
    date:
      dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dateParam
        : undefined,
    keyLimit: Number.isFinite(keyLimit) ? keyLimit : undefined,
  });

  return (
    <ThemeScope theme={theme} accent={accent}>
      <BoardShell
        initial={data}
        screenId={id}
        // ?keypanel=1 pins the key panel on, rather than waiting out its cycle.
        forceKeyPanel={query.keypanel === "1"}
      />
    </ThemeScope>
  );
}
