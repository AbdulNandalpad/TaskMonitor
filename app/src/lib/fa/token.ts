/* Furnace Analysis: the readings of a report are read-only. The server signs what it read from the PDF and refuses to save
   anything that does not match the signature, so changing a number in the browser (or in a hand-made request) fails. */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Draft } from "./extract";

const secret = () => process.env.FA_SIGNING_SECRET || process.env.ANTHROPIC_API_KEY || "";

const canon = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(canon).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(",")}}`
  : JSON.stringify(v ?? null);

/** What is signed: the values read from the PDF, bound to the stored file. Warnings and blockers are not part of it. */
const payload = (key: string, d: Draft) => canon({ key, ...d, warnings: undefined, blockers: undefined });

export function signDraft(key: string, d: Draft): string {
  return createHmac("sha256", secret()).update(payload(key, d)).digest("hex");
}

export function verifyDraft(key: string, d: Draft, token: unknown): boolean {
  if (!secret() || typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return false;
  const a = Buffer.from(signDraft(key, d), "hex"), b = Buffer.from(token, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
