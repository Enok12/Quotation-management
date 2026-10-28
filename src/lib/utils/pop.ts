import type { CSSProperties } from "react";

/**
 * Inline style that sets how long a `pop-in` element waits before appearing
 * (see `.pop-in` in globals.css). Stagger a page's blocks with it:
 *
 *   <div className="card pop-in" style={popDelay(120)}>
 */
export const popDelay = (ms: number): CSSProperties => ({ "--pop-delay": `${ms}ms` }) as CSSProperties;
