import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import state  # noqa: E402
from engine import predict_local, parse_letters  # noqa: E402

PHRASES = state.load_json("phrases.json")
MORNING = datetime(2026, 11, 20, 9, 12)


def texts(letters, now=MORNING):
    return [s["text"] for s in predict_local(letters, PHRASES, now=now)]


def test_parse_letters():
    assert parse_letters("W W A") == ["w", "w", "a"]
    assert parse_letters("IWW") == ["i", "w", "w"]
    assert parse_letters("WA_T") == ["wa", "t"]


def test_iww_top1_water():
    assert texts("I W W")[0] == "I want water"


def test_wwa_top1_appeal():
    assert texts("W W A")[0] == "Where's my wheelchair appeal?"


def test_ca_contains_call_alex():
    assert "Call Alex" in texts("C A")


def test_ctcf_comet():
    assert texts("C T C F")[0] == "Check the Comet fits"


def test_prefix_style_water():
    assert "Water" in texts("W A T")


def test_four_suggestions_after_one_letter():
    out = predict_local("I", PHRASES, now=MORNING)
    assert len(out) == 4 and all(s["text"].startswith("I") for s in out)


def test_suggestion_shape():
    s = predict_local("W W A", PHRASES, now=MORNING)[0]
    assert s["kind"] == "task" and s["tool"] == "status" and 0 < s["confidence"] <= 1
