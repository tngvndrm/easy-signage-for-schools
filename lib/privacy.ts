import type { BoardData, BoardMessage } from "./types";

/**
 * How much of the sheet's pupil data this deployment may show.
 *
 * A property of the deployment, never of the request: it describes the audience
 * a whole instance serves, not who happens to be looking. The corridor board on
 * the school LAN runs `full`; an instance published outside the building runs
 * `reduced`. Because it can't be set per request, no URL can talk a reduced
 * instance into handing the names over.
 *
 * Deliberately independent of *where* the instance runs. A school with no
 * corridor screens, reading only from home, may well want `full` — "who may
 * look" and "what they may see" are separate questions, and conflating them is
 * what makes privacy settings quietly wrong.
 */
export type PupilData = "full" | "reduced";

export const PUPIL_DATA: PupilData =
  process.env.PUPIL_DATA === "reduced" ? "reduced" : "full";

/**
 * Strip identifying pupil data out of an assembled payload.
 *
 * This runs on the server, on the way out — a zone that merely hid the names
 * client-side would still have shipped them to the browser, where anyone can
 * open the network tab. What leaves here is what a reduced deployment knows.
 *
 * Stronger still is not fetching the names at all: the sheet ranges are set per
 * deployment, so a reduced instance can read `Verjaardagen!C1:F1000` and never
 * receive a name column in the first place. This function is the layer that
 * holds when someone forgets that. See docs/deploy-cloud.md.
 */
export function redact(data: BoardData): BoardData {
  if (data.pupilData === "full") return data;

  // A notice is free text, so no filter can tell whether it names a pupil.
  // Staff mark the ones that shouldn't travel, in the sheet.
  const shown = (messages: BoardMessage[]) =>
    messages.filter((message) => !message.boardOnly);

  return {
    ...data,
    // The class stays: it carries the zone (and the count), and it is what the
    // reduced birthday card renders.
    birthdays: data.birthdays.map((birthday) => ({ ...birthday, name: "" })),
    keys: data.keys.map((duty) => ({ ...duty, student: "" })),
    messages: shown(data.messages),
    permanentSlides: shown(data.permanentSlides),
    periodicSlides: shown(data.periodicSlides),
  };
}
