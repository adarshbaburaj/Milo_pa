import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine import route_local  # noqa: E402


def test_glide_fits():
    r = route_local("check if the glide fits")
    assert r["tool"] == "fit_check" and r["args"]["item"] == "glide-p2" and not r["needs_confirm"]


def test_cold_is_speak():
    r = route_local("I'm cold")
    assert r["kind"] == "say" and r["tool"] == "speak" and r["args"]["text"] == "I'm cold"


def test_file_appeal_requires_confirmation():
    r = route_local("file the appeal")
    assert r["tool"] == "appeal" and r["args"]["action"] == "file" and r["needs_confirm"]


def test_where_is_appeal_is_status():
    assert route_local("Where's my wheelchair appeal?")["tool"] == "status"


def test_which_chairs_fit():
    r = route_local("Which chairs fit my home?")
    assert r["tool"] == "fit_check" and "item" not in r["args"]


def test_acme_is_coverage():
    assert route_local("What did Acme say?")["tool"] == "coverage"


def test_order_is_shop():
    r = route_local("Order the Glide P2")
    assert r["tool"] == "shop" and r["args"]["item"] == "glide-p2"
