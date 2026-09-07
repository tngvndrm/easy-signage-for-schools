/**
 * Whether this deployment ever puts its screens into standby.
 *
 * Standby (the board's black night screen, set per screen from the Settings
 * tab's `Turn Off`/`Turn On`) stands in for cutting a TV's power after hours —
 * see lib/blackout.ts and the SPEC. That only makes sense where the board is a
 * TV on a wall. A deployment published outside the building serves browsers, on
 * phones and laptops, that nobody switches off at six; a night screen there
 * just hides the board from someone who deliberately opened it in the evening.
 *
 * So standby is a property of the deployment, never of the request — the same
 * shape as PUPIL_DATA (see lib/privacy.ts). The LAN host leaves it on and its
 * corridor screens sleep as before; the cloud instance sets `STANDBY=off` and
 * never blacks out, whatever hours the shared sheet carries for the wall.
 *
 * On rather than off by default: a deployment that says nothing is the corridor
 * host, and a hall left lit all night is the failure the feature exists to
 * prevent. Opting out is the deliberate act.
 */
export const STANDBY_ENABLED: boolean = process.env.STANDBY !== "off";
