import { notFound } from "next/navigation";
import { BoardShell } from "@/components/BoardShell";
import { getBoardData } from "@/lib/board";
import { styleOverridesCss } from "@/lib/style";
import { ACCENTS, THEMES, type Accent } from "@/lib/theme";

export const dynamic = "force-dynamic";

const SCREEN_IDS = ["1", "2", "3"];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

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
  const keyLimit = Number(one(query.keys));
  const dateParam = one(query.date);
  const themeParam = one(query.theme);
  const accentParam = one(query.accent);

  // Appearance (theme/accent) is resolved in getBoardData now, from the sheet's
  // Settings tab, with these query params as overrides for previewing.
  const data = await getBoardData({
    screenId: id,
    previewTakeover: query.takeover === "1",
    previewEvent: query.event === "1",
    date:
      dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined,
    keyLimit: Number.isFinite(keyLimit) ? keyLimit : undefined,
    themeOverride: THEMES.includes(themeParam as "light" | "dark")
      ? (themeParam as "light" | "dark")
      : undefined,
    accentOverride: ACCENTS.includes(accentParam as Accent)
      ? (accentParam as Accent)
      : undefined,
  });

  // Brand overrides from the Style tab, rendered server-side so there's no flash
  // of the default palette before the school's colours apply.
  const overrides = styleOverridesCss(data.style);

  return (
    <>
      {overrides && <style dangerouslySetInnerHTML={{ __html: overrides }} />}
      <BoardShell
        initial={data}
        screenId={id}
        // ?keypanel=1 pins the key panel on, rather than waiting out its cycle.
        forceKeyPanel={query.keypanel === "1"}
        forceEvent={query.event === "1"}
      />
    </>
  );
}
