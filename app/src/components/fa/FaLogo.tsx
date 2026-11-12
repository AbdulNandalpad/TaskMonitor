import { useId } from "react";

/**
 * Furnace Analysis logo. A flame-coloured hexagon (Task Monitor is an indigo rounded square) holding a converter vessel in
 * white: neck, shoulders, body and round bottom, two lining lines on the wall and a glowing bath inside. Two tones like
 * the Task Monitor mark: `color` for light surfaces, `white` (white hexagon, flame vessel) for use on the brand gradient.
 */
export function FaLogoMark({ size = 32, tone = "color", className }: { size?: number; tone?: "color" | "white"; className?: string }) {
  const id = useId().replace(/:/g, "");
  const grad = `fa-grad-${id}`, bath = `fa-bath-${id}`;
  const tile = tone === "white" ? "#ffffff" : `url(#${grad})`;
  const vessel = tone === "white" ? `url(#${grad})` : "#ffffff";
  const line = tone === "white" ? "#ffffff" : "#c2410c";
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset=".45" stopColor="#f97316" />
          <stop offset="1" stopColor="#dc2626" />
        </linearGradient>
        <linearGradient id={bath} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde047" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <path d="M32 3 58 18v28L32 61 6 46V18Z" fill={tile} stroke={tile} strokeWidth="4" strokeLinejoin="round" />
      {tone === "color" && <path d="M32 3 58 18v8L6 26v-8Z" fill="#ffffff" opacity=".14" />}
      <path d="M26 10h12l10 15v18c0 7-7 12-16 12s-16-5-16-12V25Z" fill={vessel} />
      <rect x="9" y="31" width="9" height="5.5" rx="1.6" fill={vessel} />
      <rect x="46" y="31" width="9" height="5.5" rx="1.6" fill={vessel} />
      <path d="M20.5 29v12M24 29v12" stroke={line} strokeWidth="1.6" strokeLinecap="round" opacity=".75" />
      <path d="M17 43c4-2 7 1 15-.5s11 1.5 15-.5c-.5 7-7 11-15 11s-14.5-4-15-10Z" fill={`url(#${bath})`} />
      <circle cx="47" cy="12.5" r="3.2" fill={tone === "white" ? "#f97316" : "#ffffff"} />
    </svg>
  );
}

/** Mark plus the "Furnace Analysis" wordmark. */
export function FaLogo({ size = 32, onGrad = false }: { size?: number; onGrad?: boolean }) {
  return (
    <span className="fa-logo" style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.3), color: onGrad ? "#fff" : "#101828" }}>
      <FaLogoMark size={size} tone={onGrad ? "white" : "color"} />
      <span style={{ fontWeight: 700, fontSize: Math.round(size * 0.56), letterSpacing: "-.01em", lineHeight: 1 }}>
        Furnace <span style={{ color: onGrad ? "#fff" : "#c2410c" }}>Analysis</span>
      </span>
    </span>
  );
}
