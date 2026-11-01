/* Central AI configuration. Keys are server-only environment variables (never NEXT_PUBLIC_). This folder is the starting
   point for AI features across the app: add new capabilities as functions next to voice.ts, reuse anthropic.ts / openai.ts. */

export const AI = {
  /** Extraction / reasoning model. */
  claudeModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
  /** Speech-to-text model. */
  transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe",
};

export const hasAnthropic = () => !!process.env.ANTHROPIC_API_KEY;
export const hasOpenAI = () => !!process.env.OPENAI_API_KEY;

export class AiUnavailable extends Error {
  constructor(what: string) {
    super(`${what} is not configured`);
  }
}
