"""Pydantic mirrors of the TypeScript data models (WRITEUP §10)."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

InputMode = Literal["text", "voice", "head", "sign"]
ToolName = Literal["fit_check", "coverage", "appeal", "shop", "caregiver", "status", "speak"]
SourceType = Literal["profile", "catalog", "policy", "denial", "model", "user", "case"]


class InputEvent(BaseModel):
    id: str
    ts: str
    mode: InputMode = "text"
    raw: str
    partial: bool = False
    meta: Optional[dict[str, Any]] = None


class Suggestion(BaseModel):
    text: str
    kind: Literal["say", "task"]
    tool: Optional[str] = None
    confidence: float


class Evidence(BaseModel):
    label: str
    value: str
    source: str
    sourceType: SourceType
    live: bool = False


class ModelCall(BaseModel):
    name: str
    latencyMs: int
    tokens: Optional[int] = None
    tier: Optional[str] = None


class SponsorCall(BaseModel):
    sponsor: str
    op: str
    live: bool
    latencyMs: int


class Receipt(BaseModel):
    id: str
    ts: str
    input: InputEvent
    interpretedAs: Optional[str] = None
    alternatives: Optional[list[Suggestion]] = None
    confidence: Optional[float] = None
    confirmed: Optional[bool] = None
    confirmMode: Optional[InputMode] = None
    tool: Optional[str] = None
    toolArgs: Optional[dict[str, Any]] = None
    result: Any = None
    summary: Optional[str] = None
    evidence: list[Evidence] = Field(default_factory=list)
    model: Optional[ModelCall] = None
    models: list[ModelCall] = Field(default_factory=list)
    sponsorCalls: list[SponsorCall] = Field(default_factory=list)
    source: Literal["live", "mock", "local"] = "local"


# ---- request bodies ---------------------------------------------------------


class PredictRequest(BaseModel):
    letters: str
    mode: InputMode = "head"
    context: Optional[dict[str, Any]] = None


class RouteRequest(BaseModel):
    utterance: str
    mode: InputMode = "text"


class ActRequest(BaseModel):
    tool: str
    args: dict[str, Any] = Field(default_factory=dict)
    confirmed: Optional[bool] = None
    input_event: InputEvent
    interpreted_as: Optional[str] = None
    alternatives: Optional[list[Suggestion]] = None
    confidence: Optional[float] = None
    confirm_mode: Optional[InputMode] = None
    predict_model: Optional[ModelCall] = None
    route_model: Optional[ModelCall] = None


class PhraseRequest(BaseModel):
    text: str
    kind: Optional[str] = None
    tool: Optional[str] = None
    mode: Optional[str] = None


class VerifyStartRequest(BaseModel):
    user: str = "Maria Alvarez"
    purpose: str = "appeal.file"


class CaregiverRequest(BaseModel):
    item_id: Optional[str] = None
    amount_usd: float = 0
    note: str = ""


class CaregiverDecision(BaseModel):
    approve: bool
