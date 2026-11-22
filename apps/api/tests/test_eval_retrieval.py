from atlas_api.scripts.eval_retrieval import mean, norm, score


def test_norm_ignores_formatting() -> None:
    assert norm("L4 ₹18–28 lakh") in norm("| L4 | ₹18-28   lakh |")
    assert norm("from overnight to < 15 min") in norm("from overnight to &lt; 15 min")
    assert norm("ﬁle **Bold**") == "file bold"
    assert norm("91.2–106.1") in norm("| 98.4 | 91.2- 106.1  |")


def test_score() -> None:
    q = {"doc": "B", "evidence": "18 days"}
    m = score(["A", "B", "B"], ["x", "Staff get **18** days", "y"], q)
    assert m == {
        "hit_at_1": 0.0,
        "hit_at_3": 1.0,
        "hit_at_5": 1.0,
        "mrr": 0.5,
        "context_recall": 1.0,
    }
    assert score(["A"], ["x"], q)["mrr"] == 0.0


def test_mean() -> None:
    assert mean([{"mrr": 1.0}, {"mrr": 0.5}, {"mrr": 0.0}]) == {"mrr": 0.5}
    assert mean([]) == {}
