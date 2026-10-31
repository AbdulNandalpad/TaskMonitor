import type { ReactNode } from "react";

const Svg = ({ children, size }: { children: ReactNode; size?: number }) => (
  <svg className="i" viewBox="0 0 24 24" aria-hidden="true" style={size ? { width: size, height: size } : undefined}>{children}</svg>
);

export const Mic = () => (<Svg><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Svg>);
export const Cam = () => (<Svg><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></Svg>);
export const Chk = ({ size }: { size?: number }) => (<Svg size={size}><path d="M20 6 9 17l-5-5" /></Svg>);
export const Chev = () => (<Svg><path d="m9 18 6-6-6-6" /></Svg>);
export const Back = () => (<Svg><path d="m15 18-6-6 6-6" /></Svg>);
export const Pen = () => (<Svg><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg>);
export const Plus = () => (<Svg><path d="M12 5v14M5 12h14" /></Svg>);
export const Xl = () => (<Svg><path d="M4 4h16v16H4z" /><path d="M4 10h16M4 15h16M10 4v16" /></Svg>);
export const People = () => (<Svg><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></Svg>);
export const Assign = () => (<Svg><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></Svg>);
export const Pdf = () => (<Svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" /></Svg>);
export const FormIcon = () => (<Svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></Svg>);
export const SignOut = () => (<Svg><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Svg>);
export const Bell = () => (<Svg><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></Svg>);
export const Close = ({ size }: { size?: number }) => (<Svg size={size}><path d="M18 6 6 18M6 6l12 12" /></Svg>);
export const Arrow = () => (<Svg><path d="M5 12h14M13 6l6 6-6 6" /></Svg>);
export const WarnIcon = () => (<Svg><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></Svg>);
export const AlertCircle = () => (<Svg><path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="10" /></Svg>);
export const UnitIcon = () => (<Svg><path d="M3 21V8l6 4V8l6 4V4l6 3v14z" /><path d="M8 17h2M13 17h2" /></Svg>);
export const Logo = () => (<Svg size={28}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></Svg>);
