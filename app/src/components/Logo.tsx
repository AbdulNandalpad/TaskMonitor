import { useId } from "react";

/**
 * Task Monitor logo. The mark is a rounded tile with a "pulse that settles into a check": the monitoring line
 * (a heartbeat) ends in a tick, with a small orange live-dot. Two tones: `color` (gradient tile, white line) for
 * light surfaces and `white` (white tile, gradient line) for use on the brand gradient.
 */
export function LogoMark({ size = 32, tone = "color", className }: { size?: number; tone?: "color" | "white"; className?: string }) {
  const id = useId().replace(/:/g, "");
  const grad = `tm-grad-${id}`;
  const tile = tone === "white" ? "#ffffff" : `url(#${grad})`;
  const line = tone === "white" ? `url(#${grad})` : "#ffffff";
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset=".55" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="17" fill={tile} />
      {tone === "color" && <rect x="2" y="2" width="60" height="30" rx="17" fill="#ffffff" opacity=".12" />}
      <path d="M12 36h6l5-12 6 22 5-10h5l5 6 9-12" fill="none" stroke={line} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="14" r="5" fill="#f97316" stroke={tone === "white" ? "#ffffff" : "#ffffff"} strokeWidth="2.5" />
    </svg>
  );
}

/** Mark plus the "Task Monitor" wordmark. `onGrad` sets white text for use on the gradient. */
export function Logo({ size = 32, onGrad = false, className }: { size?: number; onGrad?: boolean; className?: string }) {
  return (
    <span className={`logo${onGrad ? " on-grad" : ""}${className ? ` ${className}` : ""}`} style={{ fontSize: Math.round(size * 0.62) }}>
      <LogoMark size={size} tone={onGrad ? "white" : "color"} />
      <span className="word">Task <b>Monitor</b></span>
    </span>
  );
}
