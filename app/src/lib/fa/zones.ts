/* Furnace Analysis: zone names as printed in the vendor report and the sections they belong to. */

export const SECTIONS = ["Tapside", "Trunnion", "Charge Pad", "Slag line"] as const;
export type Section = (typeof SECTIONS)[number];

/** Section of a zone from its name: "Tapside Area-1" > Tapside, "Left Trunion-3" > Trunnion, "ChargePad-1A" > Charge Pad, "SL-Drive" > Slag line. */
export function sectionOf(zone: string): Section | "Other" {
  const z = zone.toLowerCase();
  if (z.startsWith("tapside")) return "Tapside";
  if (z.includes("trunion") || z.includes("trunnion")) return "Trunnion";
  if (z.startsWith("chargepad") || z.startsWith("charge pad")) return "Charge Pad";
  if (z.startsWith("sl-") || z.startsWith("sl ")) return "Slag line";
  return "Other";
}

/** The vendor report lists these 23 zones; a read with another count is shown to the user as something to check. */
export const EXPECTED_ZONES = 23;

export const sectionOrder = (s: string) => {
  const i = (SECTIONS as readonly string[]).indexOf(s);
  return i < 0 ? 99 : i;
};
