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

/** The vendor report lists 22 zones (Tapside 4, Left and Right Trunion 4 each, ChargePad 4 and 4A, SL-Drive, SL-NON Drive); a read with another count is shown to the user as something to check. */
export const EXPECTED_ZONES = 22;

export const sectionOrder = (s: string) => {
  const i = (SECTIONS as readonly string[]).indexOf(s);
  return i < 0 ? 99 : i;
};

/** Finer grouping used by the heat comparison (the report summary table): Charge Pad and its A side are separate. */
export function compareGroup(zone: string): string {
  const z = zone.toLowerCase();
  if (z.startsWith("tapside")) return "Tapside";
  if (z.startsWith("left trun")) return "Left Trunnion";
  if (z.startsWith("right trun")) return "Right Trunnion";
  if (z.startsWith("chargepad")) return /\d+a$/i.test(zone.trim()) ? "Charge Pad (A)" : "Charge Pad";
  if (z.startsWith("sl")) return "Slag Line";
  return "Other";
}
export const COMPARE_GROUP_ORDER = ["Tapside", "Left Trunnion", "Right Trunnion", "Charge Pad", "Charge Pad (A)", "Slag Line", "Other"];
