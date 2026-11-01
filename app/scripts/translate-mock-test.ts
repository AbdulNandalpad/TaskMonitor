/* Offline check of the English-translation helper with a stubbed model: npx tsx scripts/translate-mock-test.ts */
let calls = 0;
(globalThis as any).fetch = async (url: string, init: any) => {
  calls++;
  const text = JSON.parse(JSON.parse(init.body).messages[0].content).text as string;
  const kn = /[\u0C80-\u0CFF]/.test(text), hinglish = /kaam/.test(text);
  return new Response(JSON.stringify({ usage: {}, content: [{ type: "tool_use", name: "give_english", input: kn ? { english: "The belt joint is finished, six people were on site.", language: "kn" } : hinglish ? { english: "The work is half done.", language: "mixed" } : { english: text, language: "en" } }] }), { status: 200 });
};
(async () => {
  process.env.ANTHROPIC_API_KEY = "stub";
  const { ensureEnglish } = await import("../src/lib/ai/translate");
  const kn = await ensureEnglish("ಬೆಲ್ಟ್ ಜಾಯಿಂಟ್ ಮುಗಿದಿದೆ, ಆರು ಜನ ಇದ್ದರು", { always: true });
  const hi = await ensureEnglish("kaam aadha ho gaya", { always: true });
  const en = await ensureEnglish("Scaffold ready on level 2", { always: true });
  const c = calls;
  const skip = await ensureEnglish("Already English from the voice path");   // not always: no non-Latin letters, no call
  delete process.env.ANTHROPIC_API_KEY;
  const noKey = await ensureEnglish("ಬೆಲ್ಟ್ ಜಾಯಿಂಟ್ ಮುಗಿದಿದೆ", { always: true });
  const noKeyEn = await ensureEnglish("plain english", { always: true });
  const ok = kn.text.startsWith("The belt joint") && kn.original?.startsWith("ಬೆಲ್ಟ್") && kn.language === "kn"
    && hi.text === "The work is half done." && hi.language === "mixed"
    && en.text === "Scaffold ready on level 2" && en.original === null && c === 3
    && skip.text === "Already English from the voice path" && calls === 3
    && noKey.pending === true && noKey.text.startsWith("ಬೆಲ್ಟ್") && noKeyEn.pending === false;
  console.log(ok ? "PASS translate helper (mocked)" : "FAIL", JSON.stringify({ kn, hi, en, skip, noKey, noKeyEn, calls }));
  process.exit(ok ? 0 : 1);
})();
