"""Duplicate notice detection and revision diffing module."""

from __future__ import annotations

import difflib
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from pipeline.models import NoticeRecord

logger = logging.getLogger(__name__)


@dataclass
class DuplicateMatch:
    """Duplicate detection result."""
    notice_id: int
    title: str
    similarity_score: float
    status: str


def detect_duplicates(
    new_text: str,
    existing_notices: List[NoticeRecord],
    threshold: float = 0.60,
) -> List[DuplicateMatch]:
    """Check if a newly ingested notice text is a duplicate of any existing notice.

    Uses TF-IDF character and word n-grams with cosine similarity.

    Args:
        new_text: Raw or extracted text of the new notice.
        existing_notices: List of notices from database.
        threshold: Minimum cosine similarity score to flag as duplicate.

    Returns:
        List of DuplicateMatch objects exceeding the threshold, ranked by score.
    """
    if not new_text or not existing_notices:
        return []

    corpus = [n.raw_text or f"{n.title} {n.summary_english}" for n in existing_notices]
    corpus.append(new_text)

    try:
        vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=15000)
        tfidf = vectorizer.fit_transform(corpus)

        new_vec = tfidf[-1]
        existing_vecs = tfidf[:-1]

        sim_scores = cosine_similarity(new_vec, existing_vecs).flatten()

        matches = []
        for i, score in enumerate(sim_scores):
            if score >= threshold:
                n = existing_notices[i]
                matches.append(
                    DuplicateMatch(
                        notice_id=n.id or 0,
                        title=n.title or "Untitled Notice",
                        similarity_score=round(float(score), 4),
                        status=n.status,
                    )
                )

        matches.sort(key=lambda m: m.similarity_score, reverse=True)
        return matches
    except Exception as e:
        logger.warning(f"Duplicate detection failed: {e}")
        return []


def compute_notice_diff(old: NoticeRecord, new: NoticeRecord) -> Dict[str, Any]:
    """Compute structured differences between two versions of a notice.

    Returns:
        Dictionary with changed fields and HTML-highlighted text diff.
    """
    field_changes: Dict[str, Tuple[Any, Any]] = {}

    check_fields = [
        ("title", old.title, new.title),
        ("issuing_office", old.issuing_office, new.issuing_office),
        ("date_of_issue", old.date_of_issue, new.date_of_issue),
        ("category", old.category, new.category),
        ("venue", old.venue, new.venue),
        ("required_action", old.required_action, new.required_action),
        ("contact", old.contact, new.contact),
    ]

    for name, v_old, v_new in check_fields:
        if (v_old or "") != (v_new or ""):
            field_changes[name] = (v_old, v_new)

    # Check deadlines
    old_dl = [f"{d.date}: {d.description}" for d in (old.deadlines or [])]
    new_dl = [f"{d.date}: {d.description}" for d in (new.deadlines or [])]
    if old_dl != new_dl:
        field_changes["deadlines"] = (old_dl, new_dl)

    # Check fees
    old_f = f"{old.fees.amount} {old.fees.currency}" if old.fees else "None"
    new_f = f"{new.fees.amount} {new.fees.currency}" if new.fees else "None"
    if old_f != new_f:
        field_changes["fees"] = (old_f, new_f)

    # Text diff
    old_lines = (old.raw_text or "").splitlines()
    new_lines = (new.raw_text or "").splitlines()
    diff = list(difflib.unified_diff(old_lines, new_lines, fromfile="Previous Version", tofile="Revised Version", lineterm=""))

    return {
        "field_changes": field_changes,
        "unified_diff": diff,
    }
