import type { MiloState } from "./useMilo";

/**
 * Optional raster art for Milo. Put transparent PNGs in web/public/milo/ and list them here.
 * Any state without an image falls back to `idle`'s image; if `idle` is missing too,
 * the built-in pixel SVG is used. Effects (waves, dots, ?, z, confetti, jumps) work either way.
 * e.g. { idle: "/milo/idle.png", happy: "/milo/happy.png", speakingOpen: "/milo/speaking-open.png" }
 */
export const MILO_IMAGES: Partial<Record<MiloState | "speakingOpen", string>> = {};
