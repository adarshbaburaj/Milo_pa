// The measurements Milo needs, how to get each one without being an expert, and where it came from.
import type { Profile } from "./types";

export type Source = "self" | "helper" | "photo" | "current_chair" | "clinician" | "estimated" | "demo";

export const SOURCE_LABEL: Record<Source, string> = {
  self: "entered by you",
  helper: "measured by a helper",
  photo: "photo estimate",
  current_chair: "from your current chair",
  clinician: "from your clinician",
  estimated: "estimate — please confirm",
  demo: "demo data",
};

export const TRUSTED: Source[] = ["helper", "clinician", "self", "demo"];

export type MeasureDef = {
  key: string;
  label: string;
  unit: "in" | "ft";
  min: number;
  max: number;
  step: number;
  typical: number;
  photo?: "doorway" | "hallway" | "hip" | "seat" | "seat_height";
  why: string;
  how: string[]; // plain steps for a helper with a tape measure
  get: (p: Profile) => number;
  set: (p: Profile, v: number) => Profile;
};

export const MEASURES: MeasureDef[] = [
  {
    key: "hipWidthIn", label: "Hip width (sitting)", unit: "in", min: 10, max: 30, step: 0.5, typical: 16, photo: "hip",
    why: "Your seat should be 1–3 inches wider than your hips.",
    how: ["Sit on a firm chair.", "Hold two books against the outside of each hip.", "Measure straight across between the books."],
    get: (p) => p.hipWidthIn,
    set: (p, v) => ({ ...p, hipWidthIn: v, seatWidthRangeIn: [v + 1, v + 3] }),
  },
  {
    key: "narrowestDoorwayIn", label: "Narrowest doorway", unit: "in", min: 20, max: 48, step: 0.5, typical: 30, photo: "doorway",
    why: "A chair needs its width plus about 2 inches for your hands.",
    how: ["Find the narrowest door you use every day (often the bathroom).", "Open the door fully.", "Measure the clear opening, from the door edge to the frame."],
    get: (p) => p.home.narrowestDoorwayIn,
    set: (p, v) => ({ ...p, home: { ...p.home, narrowestDoorwayIn: v } }),
  },
  {
    key: "hallwayTurnSpaceIn", label: "Hallway turning space", unit: "in", min: 18, max: 72, step: 0.5, typical: 36, photo: "hallway",
    why: "Power chairs need room to turn around.",
    how: ["Find the tightest spot where you need to turn.", "Measure wall to wall at that spot."],
    get: (p) => p.home.hallwayTurnSpaceIn,
    set: (p, v) => ({ ...p, home: { ...p.home, hallwayTurnSpaceIn: v } }),
  },
  {
    key: "transferHeightIn", label: "Comfortable seat height", unit: "in", min: 14, max: 26, step: 0.5, typical: 20, photo: "seat_height",
    why: "Moving in and out of the chair is safer at the right height.",
    how: ["Measure from the floor to the top of the bed or chair you move to most.", "Milo uses ±1 inch around this."],
    get: (p) => (p.transferHeightRangeIn[0] + p.transferHeightRangeIn[1]) / 2,
    set: (p, v) => ({ ...p, transferHeightRangeIn: [v - 1, v + 1] }),
  },
  {
    key: "canSelfPropelFt", label: "How far you can push a manual chair", unit: "ft", min: 0, max: 300, step: 5, typical: 50,
    why: "Insurers ask whether a manual chair works for daily life at home.",
    how: ["Roughly how far can you push yourself before you need to stop?", "A room is about 12 feet; a hallway about 20–30."],
    get: (p) => p.canSelfPropelFt,
    set: (p, v) => ({ ...p, canSelfPropelFt: v }),
  },
];

/** Typical seat widths of common chairs, for "use my current chair". */
export const CURRENT_CHAIRS = [
  { label: "Narrow (16″ seat)", seat: 16 },
  { label: "Standard (18″ seat)", seat: 18 },
  { label: "Wide (20″ seat)", seat: 20 },
  { label: "Extra wide (22″ seat)", seat: 22 },
];
