/**
 * Which build this code came from — `"a3f19c · 07-08 21:40"`.
 *
 * The value is inlined at build time (see next.config.mjs), which is the whole
 * point: the copy compiled into the server and the copy compiled into the
 * client bundle are only equal while a screen is running current code.
 *
 * A display Pi loads the board once and then never reloads — it polls
 * /api/board for data, not for markup — so after an update on the host the
 * screens keep running whatever bundle they booted with. Comparing the server's
 * stamp against its own is how a screen notices that and reloads itself.
 */
export const BUILD = process.env.NEXT_PUBLIC_BUILD ?? "onbekend";

// Staff type what they type; a school open day is no time to discover that
// "nee" wasn't one of the accepted spellings.
const OFF = new Set(["0", "off", "false", "no", "nee", "uit", "verborgen"]);
const ON = new Set(["1", "on", "true", "yes", "ja", "aan"]);

/**
 * Whether the corner stamp is drawn on this screen.
 *
 * Off in production and on in development, because that's where the question
 * gets asked: on a normal school day nobody needs a commit hash on the wall,
 * and while you're building or chasing a deploy it should be there without
 * being switched on first. `BUILD_STAMP=on|off` in the host's environment
 * changes the standing answer, and `?build=1` / `?build=0` overrides it for one
 * screen — the same env-default-plus-query shape as theme and accent.
 *
 * Only the stamp is hidden. The screens still compare builds and still reload
 * themselves onto a new deploy, since that half is invisible either way.
 */
export function showBuildStamp(override?: string): boolean {
  const value = override?.trim().toLowerCase();
  if (value) {
    if (ON.has(value)) return true;
    if (OFF.has(value)) return false;
  }
  const env = (process.env.BUILD_STAMP ?? "").trim().toLowerCase();
  if (ON.has(env)) return true;
  if (OFF.has(env)) return false;
  return process.env.NODE_ENV !== "production";
}
