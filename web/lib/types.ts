export type InputMode = "text" | "voice" | "head" | "sign";
export type ToolName = "fit_check" | "coverage" | "appeal" | "shop" | "caregiver" | "status" | "speak";

export interface InputEvent {
  id: string;
  ts: string;
  mode: InputMode;
  raw: string;
  partial: boolean;
  meta?: { dwellMs?: number; moves?: number; signConfidence?: number; rank?: number };
}

export interface Suggestion {
  text: string;
  kind: "say" | "task";
  tool?: ToolName | null;
  confidence: number;
}

export interface Evidence {
  label: string;
  value: string;
  source: string;
  sourceType: string;
  live: boolean;
}

export interface ModelCall {
  name: string;
  latencyMs: number;
  tokens?: number | null;
  tier?: string | null;
}

export interface SponsorCall {
  sponsor: string;
  op: string;
  live: boolean;
  latencyMs: number;
}

export interface Receipt {
  id: string;
  ts: string;
  input: InputEvent;
  interpretedAs?: string;
  alternatives?: Suggestion[] | null;
  confidence?: number | null;
  confirmed: boolean | null;
  confirmMode?: InputMode | null;
  tool?: ToolName;
  toolArgs?: Record<string, unknown>;
  result?: any;
  summary?: string;
  evidence: Evidence[];
  model?: ModelCall | null;
  models?: ModelCall[];
  sponsorCalls: SponsorCall[];
  source: "live" | "mock" | "local";
  latencyMs?: number;
}

export interface Profile {
  name: string;
  city: string;
  hipWidthIn: number;
  seatWidthRangeIn: [number, number];
  transferHeightRangeIn: [number, number];
  canSelfPropelFt: number;
  home: { narrowestDoorwayIn: number; narrowestDoorwayName: string; hallwayTurnSpaceIn: number };
  insurer: string;
  memberId: string;
  caregiver: { name: string; relation: string; approvalOverUsd: number };
  inputModes: InputMode[];
}

export interface Chair {
  id: string;
  name: string;
  type: "manual" | "power";
  overallWidthIn: number;
  seatWidthIn: number;
  seatToFloorIn: number;
  turningRadiusIn: number | null;
  priceUsd: number;
  insurerDefault?: boolean;
  emoji: string;
}

export interface FitCheck {
  rule: string;
  pass: boolean;
  detail: string;
  numbers: Record<string, unknown>;
}

export interface FitResult {
  id: string;
  name: string;
  chair: Chair;
  fits: boolean;
  score: number;
  checks: FitCheck[];
  failed: string[];
  one_liner: string;
}

export interface RouteResult {
  kind: "say" | "task" | "chat";
  tool: ToolName;
  args: Record<string, any>;
  confirm_text: string;
  needs_confirm: boolean;
  model?: ModelCall | null;
  source: string;
}
