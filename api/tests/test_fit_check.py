import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import state  # noqa: E402
from tools import fit_check  # noqa: E402

EXPECTED_FAILS = {
    "basic-manual": {"Seat width", "Propulsion"},
    "aero-m1": {"Propulsion"},
    "glide-p2": set(),
    "nimbus-p3": {"Seat width"},
    "terra-hd": {"Doorway", "Turning"},
    "urban-fold": {"Transfer height"},
    "comet-mw": set(),
    "strider-rw": {"Turning"},
}


def test_exact_pass_fail_per_chair():
    profile = state.load_json("profile.json")
    catalog = state.load_json("catalog.json")
    results = {r["id"]: r for r in fit_check.check_all(catalog, profile)}
    assert set(results) == set(EXPECTED_FAILS)
    for cid, fails in EXPECTED_FAILS.items():
        assert set(results[cid]["failed"]) == fails, cid
        assert results[cid]["fits"] == (not fails), cid


def test_exactly_two_fit_and_ranked_first():
    profile = state.load_json("profile.json")
    catalog = state.load_json("catalog.json")
    results = fit_check.check_all(catalog, profile)
    passing = [r["id"] for r in results if r["fits"]]
    assert passing == ["glide-p2", "comet-mw"]  # all-pass first, price ascending
    assert [r["id"] for r in results[:2]] == passing


def test_comet_doorway_numbers():
    profile = state.load_json("profile.json")
    comet = next(c for c in state.load_json("catalog.json") if c["id"] == "comet-mw")
    r = fit_check.check_chair(comet, profile)
    door = next(c for c in r["checks"] if c["rule"] == "Doorway")
    assert door["pass"] and door["numbers"]["requiredIn"] == 27.5
