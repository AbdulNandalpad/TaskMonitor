/* CR-2 regression test, needs real keys in app/.env.local: npx tsx scripts/ai-live-test.ts
   Synthesises spoken updates (OpenAI TTS), runs them through transcribe() and extractUpdate(), and checks that the
   transcript and remarks come back in English with the expected status, progress and manpower. Prints no keys. */
import fs from "node:fs";
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { transcribe } from "../src/lib/ai/openai";
import { extractUpdate, transcriptionPrompt } from "../src/lib/ai/voice";

if (!process.env.OPENAI_API_KEY || !process.env.ANTHROPIC_API_KEY) {
  console.log("SKIPPED: set OPENAI_API_KEY and ANTHROPIC_API_KEY in app/.env.local to run the live AI test.");
  process.exit(0);
}

const TASK = { title: "Stave hose changing", status: "in_progress" as const, progress: 35, manpower: 10 };
type Case = { name: string; lang?: string; say: string; status: string; progress?: number; manpower: number; attention?: boolean; language: string[] };
const CASES: Case[] = [
  { name: "English", lang: "en", say: "Stave hose changing is completed. Six people on site, trial taken, no abnormality.", status: "completed", progress: 100, manpower: 6, language: ["en"] },
  { name: "Hinglish", say: "Stave hose changing complete ho gaya hai, chhe log the, trial le liya, koi problem nahi.", status: "completed", progress: 100, manpower: 6, language: ["mixed", "hi", "en"] },
  { name: "Hindi", lang: "hi", say: "स्टेव होज बदलने का काम साठ प्रतिशत हो गया है, आठ लोग लगे हैं, कल सुबह तक पूरा होगा।", status: "in_progress", progress: 60, manpower: 8, language: ["hi", "mixed"] },
  { name: "Kannada", lang: "kn", say: "ಸ್ಟೇವ್ ಹೋಸ್ ಬದಲಾವಣೆ ಕೆಲಸ ಮುಗಿದಿದೆ, ಆರು ಜನ ಇದ್ದರು, ಯಾವುದೇ ತೊಂದರೆ ಇಲ್ಲ.", status: "completed", progress: 100, manpower: 6, language: ["kn", "mixed"] },
  { name: "Blocked", lang: "en", say: "Work is stopped, waiting for the scaffolding permit. Four people standing by.", status: "in_progress", manpower: 4, attention: true, language: ["en"] },
];
// English means Latin text: no Devanagari or Kannada letters anywhere
const isEnglish = (s: string) => !/[ऀ-ॿಀ-೿]/.test(s);

async function tts(text: string) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "alloy", input: text, response_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return new Blob([await res.arrayBuffer()], { type: "audio/mpeg" });
}

(async () => {
  let failed = 0;
  for (const c of CASES) {
    try {
      const audio = await tts(c.say);
      const tr = await transcribe({ audio, filename: "update.mp3", language: c.lang, prompt: transcriptionPrompt(TASK.title) });
      const ex = await extractUpdate({ transcript: tr.text, task: TASK, language: c.lang });
      const checks: [string, boolean][] = [
        ["transcript_en is English", isEnglish(ex.transcriptEn) && ex.transcriptEn.length > 5],
        ["remarks are English", isEnglish(ex.remarks)],
        [`status ${c.status}`, ex.status === c.status],
        ...(c.progress !== undefined ? ([[`progress ${c.progress}`, ex.progress === c.progress]] as [string, boolean][]) : []),
        [`manpower ${c.manpower}`, ex.manpower === c.manpower],
        ...(c.attention ? ([["needs attention", ex.needsAttention]] as [string, boolean][]) : []),
        [`language in ${c.language.join("/")}`, c.language.includes(ex.language)],
      ];
      const bad = checks.filter((x) => !x[1]).map((x) => x[0]);
      if (bad.length) failed++;
      console.log(`\n${bad.length ? "FAIL" : "PASS"}  ${c.name}${bad.length ? "  <- " + bad.join("; ") : ""}`);
      console.log(`  heard:      ${tr.text}`);
      console.log(`  english:    ${ex.transcriptEn}`);
      console.log(`  extracted:  ${ex.status}/${ex.progress} manpower ${ex.manpower} attention ${ex.needsAttention} language ${ex.language}  remarks "${ex.remarks}"`);
    } catch (e) {
      failed++;
      console.log(`\nFAIL  ${c.name}: ${(e as Error).message}`);
    }
  }
  console.log(failed ? `\n${failed} case(s) failed` : "\nAll cases passed");
  process.exit(failed ? 1 : 0);
})();
