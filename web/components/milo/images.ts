/**
 * Milo's art (web/public/milo). Every frame is a 512×512 transparent WebP on the same canvas, so frames swap
 * without the body jumping. Effects (?, z, waves) are separate full-canvas layers so they can move on their own;
 * thinking dots and confetti are drawn from the positions/colours measured in the original art.
 * Positions are in % of the canvas.
 */
export const FRAMES = {
  idle: "/milo/idle.webp",
  blink: "/milo/blink.webp",
  talk: "/milo/talk.webp",
  waiting: "/milo/waiting.webp",
  happy: "/milo/happy.webp",
  celebrate: "/milo/celebrate.webp",
  confused: "/milo/confused.webp",
  listening: "/milo/listening.webp",
  sleep: "/milo/sleep.webp",
  thinking: "/milo/thinking.webp",
} as const;
export type Frame = keyof typeof FRAMES;

export const FX = {
  question: "/milo/fx-confused.webp",
  z: "/milo/fx-sleep.webp",
  wavesLeft: "/milo/fx-waves-left.webp",
  wavesRight: "/milo/fx-waves-right.webp",
} as const;

/** Body box inside the canvas (%): the frames all share it. */
export const BODY = { left: 13.7, top: 25.8, width: 70.7, bottom: 88 };

export const THINK_DOTS = [
  { x: 64.94, y: 22.76, d: 2.44, color: "#543c2c" },
  { x: 68.94, y: 20.27, d: 2.54, color: "#51392b" },
  { x: 73.19, y: 18.1, d: 2.54, color: "#50392a" },
];

export const CONFETTI = [
  { x: 49.23, y: 15.4, s: 5.2, color: "#f7c336", r: 28 },
  { x: 66.56, y: 20.09, s: 4.3, color: "#22723b", r: -24 },
  { x: 31.91, y: 20.46, s: 4.6, color: "#bf4c13", r: 32 },
  { x: 80.24, y: 29.34, s: 4.4, color: "#c04c12", r: -30 },
  { x: 18.73, y: 29.7, s: 4.3, color: "#f8c538", r: 26 },
  { x: 85.79, y: 38.81, s: 4.0, color: "#f7c437", r: -22 },
  { x: 13.61, y: 38.74, s: 3.8, color: "#24753c", r: 30 },
];
