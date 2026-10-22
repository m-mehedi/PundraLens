"""Question Answering over Stored University Notices.

Strictly answers questions using ONLY published notices in the database.
Cites the source notice ID, title, and exact matching passages.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from storage.db import list_notices
from pipeline import llm
from pipeline.models import NoticeRecord

logger = logging.getLogger(__name__)


class Citation(BaseModel):
    """Citation of a notice and its supporting passage."""
    notice_id: int = Field(description="Database ID of the cited notice")
    notice_title: str = Field(description="Title of the cited notice")
    matching_passage: str = Field(description="Exact quote or passage from the notice supporting the answer")


class QAResponse(BaseModel):
    """Grounded question answering response."""
    answer: str = Field(description="Direct, helpful answer to the student question in the same language as the question")
    citations: List[Citation] = Field(default_factory=list, description="Citations supporting the answer")
    found_answer: bool = Field(description="True if the answer was found in the stored notices, False otherwise")


def _rank_candidate_notices(query: str, notices: List[NoticeRecord], top_k: int = 5) -> List[NoticeRecord]:
    """Rank notices by relevance to the query using TF-IDF."""
    if not notices:
        return []
    if len(notices) <= top_k:
        return notices

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity

        docs = [
            f"{n.title or ''} {n.category or ''} {n.issuing_office or ''} {n.required_action or ''} {n.summary_english or ''} {n.summary_bengali or ''} {n.raw_text or ''}"
            for n in notices
        ]

        vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=10000)
        tfidf_matrix = vectorizer.fit_transform(docs)
        query_vec = vectorizer.transform([query])
        scores = cosine_similarity(query_vec, tfidf_matrix).flatten()

        ranked_indices = scores.argsort()[::-1][:top_k]
        return [notices[i] for i in ranked_indices]
    except Exception as e:
        logger.warning(f"TF-IDF ranking error: {e}. Returning most recent notices.")
        return notices[:top_k]


def answer_question(
    query: str,
    department: Optional[str] = None,
    batch: Optional[str] = None,
    model: Optional[str] = None,
) -> QAResponse:
    """Answer a student's question strictly grounded on published notices."""
    # Fetch only published notices
    published = list_notices(status="published")
    if not published:
        return QAResponse(
            answer="There are currently no published notices in the database. Please check back once notices have been uploaded and approved by staff.",
            citations=[],
            found_answer=False,
        )

    # Rank most relevant notices
    candidates = _rank_candidate_notices(query, published, top_k=6)

    # Construct context from candidate notices
    context_blocks = []
    for n in candidates:
        deadlines_str = ", ".join([f"{d.date}: {d.description}" for d in (n.deadlines or [])]) or "None"
        fees_str = f"{n.fees.amount} {n.fees.currency}" if n.fees else "None"
        target_str = ""
        if n.target_students:
            target_str = f"Dept: {n.target_students.department or 'All'}, Batch: {n.target_students.batch or 'All'}"

        block = f"""[NOTICE ID: {n.id}]
Title: {n.title}
Issuing Office: {n.issuing_office}
Date of Issue: {n.date_of_issue}
Category: {n.category}
Target: {target_str}
Deadlines: {deadlines_str}
Fees: {fees_str}
Venue: {n.venue or 'N/A'}
Required Action: {n.required_action or 'N/A'}
Summary (Bangla): {n.summary_bengali}
Summary (English): {n.summary_english}
Notice Content / Text:
{n.raw_text or ''}
----------------------------------------"""
        context_blocks.append(block)

    full_context = "\n\n".join(context_blocks)

    system_prompt = """You are PUB NoticeLens, an official university notice intelligence assistant.

CRITICAL INSTRUCTIONS:
1. You must answer the user's question STRICTLY based on the provided university notices.
2. If the answer cannot be determined from the notices, respond:
   "I cannot answer this question based on the published university notices." and set found_answer to false.
3. For every answer you give, you MUST cite the source notice (notice_id and notice_title) and provide the exact matching_passage from the notice that proves your answer.
4. Answer in the same language as the user query (Bengali or English).
"""

    user_prompt = f"""STORED UNIVERSITY NOTICES:
{full_context}

USER QUESTION:
{query}

Extract the accurate answer with citations from the notices above."""

    spec = llm.get_model(model)
    client = llm.get_chat_client(spec)

    data = llm.invoke_structured(
        client,
        spec,
        QAResponse,
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    return QAResponse(**data)
