"""PUB NoticeLens — Multi-Role University Notice and Document Intelligence.

Roles:
1. 🎓 Student: Personalised feed, deadline reminders, .ics calendar export, archive search, TTS audio reading, and grounded QA.
2. 🏢 Office Staff / Publisher: Multi-modal notice ingestion (PDF/Images/Text), AI extraction inspector, review/edit before publish, and duplicate notice detection.
3. ⚙️ Administrator: Manage departments, categories, published notices, and run evaluation benchmark (CER & Field Accuracy).
"""

from __future__ import annotations

import io
import json
import logging
from datetime import datetime, date
from typing import Any, Dict, List, Optional

import streamlit as st
from PIL import Image

import pipeline  # Loads .env
from pipeline.align import align_image
from pipeline.calendar import generate_ics_calendar
from pipeline.diff_and_duplicates import compute_notice_diff, detect_duplicates
from pipeline.extract import extract_notice
from pipeline.ingestion import process_document
from pipeline.logging_config import configure_logging
from pipeline.models import Deadline, EventDateTime, Fees, NoticeRecord, TargetStudents
from pipeline.ocr import run_ocr_on_image
from pipeline.qa import answer_question
from pipeline.tts import generate_speech
from storage.db import (
    add_category,
    add_department,
    delete_notice,
    get_all_categories,
    get_all_departments,
    get_notice_by_id,
    init_db,
    list_notices,
    publish_notice,
    save_notice,
    update_notice,
)

# Initialize database
init_db()

configure_logging()
logger = logging.getLogger(__name__)

# App configuration
st.set_page_config(
    page_title="PUB NoticeLens",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom Styling
st.markdown(
    """
    <style>
    .metric-card {
        background-color: #f8f9fa;
        border-radius: 8px;
        padding: 15px;
        border-left: 5px solid #1E88E5;
        margin-bottom: 10px;
    }
    .urgent-deadline {
        color: #d32f2f;
        font-weight: bold;
    }
    .notice-card {
        border: 1px solid #e0e0e0;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 15px;
        background-color: #ffffff;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .citation-box {
        background-color: #e8f5e9;
        border-left: 4px solid #2e7d32;
        padding: 10px 14px;
        border-radius: 4px;
        margin-top: 8px;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


def _category_badge(category: str) -> str:
    """Return badge icon for category."""
    icons = {
        "exam": "📝 Exam",
        "registration": "📋 Registration",
        "fee": "💰 Fee",
        "holiday": "🏖️ Holiday",
        "event": "🎉 Event",
        "scholarship": "🎓 Scholarship",
        "result": "📊 Result",
        "general": "📢 General",
    }
    return icons.get(category.lower(), f"📢 {category.capitalize()}")


# ---------------------------------------------------------------------------
# Sidebar Navigation & Role Switcher
# ---------------------------------------------------------------------------

with st.sidebar:
    st.title("🎓 PUB NoticeLens")
    st.caption("AI-Powered Bengali/English Notice Intelligence")

    st.markdown("---")
    role = st.selectbox(
        "👤 Select Your Role:",
        ["🎓 Student Portal", "🏢 Office Staff / Publisher", "⚙️ Administrator"],
        index=0,
    )

    st.markdown("---")
    if role == "🎓 Student Portal":
        st.subheader("🎒 Student Profile")
        depts = get_all_departments()
        dept_codes = ["ALL"] + [d["code"] for d in depts if d["code"] != "ALL"]
        student_dept = st.selectbox("My Department:", dept_codes, index=dept_codes.index("CSE") if "CSE" in dept_codes else 0)
        student_batch = st.text_input("My Batch / Year:", value="ALL")
        student_sem = st.selectbox("Semester:", ["All", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"], index=0)

        st.session_state.student_dept = student_dept
        st.session_state.student_batch = student_batch
        st.session_state.student_sem = student_sem
        st.info(f"Viewing notices for **{student_dept}** (Batch {student_batch})")

    st.markdown("---")
    st.caption("PUB NoticeLens • Pundra University of Science & Technology")


# ===========================================================================
# 1. STUDENT PORTAL
# ===========================================================================

if role == "🎓 Student Portal":
    st.header("🎓 Student Intelligence Portal")

    dept_filter = st.session_state.get("student_dept", "ALL")
    batch_filter = st.session_state.get("student_batch", "")

    tab_feed, tab_deadlines, tab_search, tab_qa = st.tabs([
        "📰 Personalised Feed",
        "⏰ Deadline Radar & Calendar",
        "🔍 Searchable Archive",
        "🤖 AI Notice Assistant (QA)",
    ])

    # -----------------------------------------------------------------------
    # TAB 1: Personalised Feed
    # -----------------------------------------------------------------------
    with tab_feed:
        st.subheader(f"Personalised Notice Feed for {dept_filter} Students")

        notices = list_notices(
            status="published",
            department=dept_filter,
            batch=batch_filter if batch_filter != "ALL" else None,
        )

        col_top_left, col_top_right = st.columns([3, 1])
        with col_top_left:
            st.markdown(f"Found **{len(notices)}** notices tailored to your profile.")
        with col_top_right:
            if notices:
                ics_data = generate_ics_calendar(notices, calendar_name=f"PUB NoticeLens - {dept_filter}")
                st.download_button(
                    label="📥 Export Feed to .ics",
                    data=ics_data,
                    file_name=f"pub_notices_{dept_filter.lower()}.ics",
                    mime="text/calendar",
                    help="Add all upcoming deadlines and events to Google Calendar, Apple Calendar, or Outlook.",
                )

        if not notices:
            st.info("No notices found matching your department and batch.")
        else:
            for n in notices:
                with st.expander(f"{_category_badge(n.category)} | **{n.title}** ({n.date_of_issue})", expanded=False):
                    c1, c2 = st.columns([3, 1])
                    with c1:
                        st.markdown(f"**Issuing Office:** {n.issuing_office or 'University'}")
                        if n.required_action:
                            st.markdown(f"**⚡ Required Action:** {n.required_action}")
                        if n.venue:
                            st.markdown(f"**📍 Venue:** {n.venue}")
                        if n.fees:
                            st.markdown(f"**💰 Fee:** {n.fees.amount} {n.fees.currency}")

                        if n.deadlines:
                            st.markdown("**⏰ Deadlines:**")
                            for dl in n.deadlines:
                                st.markdown(f"- 🔴 **{dl.date}**: {dl.description}")

                        if n.event_date_time:
                            st.markdown(f"**📅 Event Date:** {n.event_date_time.date} ({n.event_date_time.time or 'Time TBA'})")

                    with c2:
                        target_str = "All Students"
                        if n.target_students and (n.target_students.department or n.target_students.batch):
                            target_str = f"{n.target_students.department or 'All'} (Batch {n.target_students.batch or 'All'})"
                        st.caption(f"**Target:** {target_str}")
                        st.caption(f"**Published:** {n.published_at[:10] if n.published_at else n.date_of_issue}")

                        # Single Notice .ics download
                        notice_ics = generate_ics_calendar([n], calendar_name=n.title or "Notice")
                        st.download_button(
                            "📅 Add to Calendar",
                            data=notice_ics,
                            file_name=f"notice_{n.id}.ics",
                            mime="text/calendar",
                            key=f"ics_{n.id}",
                        )

                    st.markdown("---")
                    # Bilingual Summaries & TTS
                    col_bn, col_en = st.columns(2)
                    with col_bn:
                        st.markdown("**🇧🇩 সারাংশ (Bengali Summary):**")
                        st.write(n.summary_bengali or "সারাংশ উপলব্ধ নেই।")
                        if st.button("🔊 শুনুন (Bangla TTS)", key=f"tts_bn_{n.id}"):
                            audio_bytes = generate_speech(n.summary_bengali or n.title, lang="bn")
                            if audio_bytes:
                                st.audio(audio_bytes, format="audio/mp3")

                    with col_en:
                        st.markdown("**🇬🇧 English Summary:**")
                        st.write(n.summary_english or "No summary available.")
                        if st.button("🔊 Listen (English TTS)", key=f"tts_en_{n.id}"):
                            audio_bytes = generate_speech(n.summary_english or n.title, lang="en")
                            if audio_bytes:
                                st.audio(audio_bytes, format="audio/mp3")

                    with st.expander("📄 View Full Document Text", expanded=False):
                        st.text(n.raw_text or "No text available.")

    # -----------------------------------------------------------------------
    # TAB 2: Deadline Radar & Calendar Export
    # -----------------------------------------------------------------------
    with tab_deadlines:
        st.subheader("⏰ Upcoming Deadlines & Event Radar")
        st.caption("Stay on top of form submissions, payments, exams, and registrations.")

        all_pub = list_notices(status="published", department=dept_filter)
        deadline_items = []
        now_dt = datetime.now().date()

        for n in all_pub:
            if n.deadlines:
                for dl in n.deadlines:
                    if dl.date:
                        try:
                            dl_dt = datetime.strptime(dl.date, "%Y-%m-%d").date()
                            days_left = (dl_dt - now_dt).days
                            deadline_items.append({
                                "notice_id": n.id,
                                "notice_title": n.title,
                                "category": n.category,
                                "deadline_date": dl.date,
                                "days_left": days_left,
                                "description": dl.description,
                                "action": n.required_action,
                            })
                        except Exception:
                            continue

        if not deadline_items:
            st.info("No upcoming deadlines recorded for your department.")
        else:
            deadline_items.sort(key=lambda x: x["deadline_date"])

            # Highlight count
            col_m1, col_m2, col_m3 = st.columns(3)
            urgent_7 = sum(1 for d in deadline_items if 0 <= d["days_left"] <= 7)
            urgent_14 = sum(1 for d in deadline_items if 0 <= d["days_left"] <= 14)
            col_m1.metric("Total Active Deadlines", len(deadline_items))
            col_m2.metric("Due in Next 7 Days", urgent_7, delta=f"{urgent_7} urgent" if urgent_7 > 0 else "None", delta_color="inverse")
            col_m3.metric("Due in Next 14 Days", urgent_14)

            # Export button
            all_ics = generate_ics_calendar(all_pub, calendar_name=f"PUB NoticeLens Deadlines - {dept_filter}")
            st.download_button(
                "📥 Download Full .ics Calendar for My Deadlines",
                data=all_ics,
                file_name=f"pub_deadlines_{dept_filter.lower()}.ics",
                mime="text/calendar",
            )

            st.markdown("### 📋 Deadline Timeline")
            for item in deadline_items:
                days = item["days_left"]
                if days < 0:
                    status_badge = f"⌛ Expired ({abs(days)} days ago)"
                    border_color = "#9e9e9e"
                elif days <= 3:
                    status_badge = f"🚨 URGENT: {days} day(s) left"
                    border_color = "#d32f2f"
                elif days <= 7:
                    status_badge = f"⚠️ {days} days left"
                    border_color = "#f57c00"
                else:
                    status_badge = f"📅 {days} days left"
                    border_color = "#388e3c"

                st.markdown(
                    f"""
                    <div style="border-left: 6px solid {border_color}; padding: 12px; margin-bottom: 10px; background: #fafafa; border-radius: 4px;">
                        <span style="float: right; font-weight: bold;">{status_badge}</span>
                        <h4 style="margin: 0;">{item['deadline_date']} — {item['description']}</h4>
                        <p style="margin: 4px 0 0 0; color: #555;">Notice: <strong>{item['notice_title']}</strong> ({_category_badge(item['category'])})</p>
                        {f'<p style="margin: 2px 0 0 0; color: #0277bd;">Action: {item["action"]}</p>' if item['action'] else ''}
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

    # -----------------------------------------------------------------------
    # TAB 3: Searchable Notice Archive
    # -----------------------------------------------------------------------
    with tab_search:
        st.subheader("🔍 Searchable Notice Archive")

        c_s1, c_s2, c_s3 = st.columns([2, 1, 1])
        with c_s1:
            search_text = st.text_input("🔎 Search by keywords (Bangla or English):", placeholder="e.g. পরীক্ষা, admit card, fee, registration, holiday")
        with c_s2:
            cats = ["all"] + [c["name"] for c in get_all_categories()]
            cat_filter = st.selectbox("Filter Category:", cats, format_func=lambda x: "All Categories" if x == "all" else _category_badge(x))
        with c_s3:
            all_depts_list = ["ALL"] + [d["code"] for d in get_all_departments() if d["code"] != "ALL"]
            dept_search = st.selectbox("Department:", all_depts_list, index=0)

        results = list_notices(
            status="published",
            category=cat_filter if cat_filter != "all" else None,
            department=dept_search if dept_search != "ALL" else None,
            search_query=search_text,
        )

        st.caption(f"Showing {len(results)} matching notice(s)")

        for n in results:
            with st.expander(f"{_category_badge(n.category)} | **{n.title}** ({n.date_of_issue})"):
                st.markdown(f"**Issuing Office:** {n.issuing_office or 'University'}")
                if n.required_action:
                    st.markdown(f"**Required Action:** {n.required_action}")
                if n.deadlines:
                    st.markdown("**Deadlines:** " + ", ".join([f"{d.date} ({d.description})" for d in n.deadlines]))
                if n.fees:
                    st.markdown(f"**Fee:** {n.fees.amount} {n.fees.currency}")

                st.markdown(f"**Summary (BN):** {n.summary_bengali or 'N/A'}")
                st.markdown(f"**Summary (EN):** {n.summary_english or 'N/A'}")

    # -----------------------------------------------------------------------
    # TAB 4: Grounded AI Notice Assistant (QA)
    # -----------------------------------------------------------------------
    with tab_qa:
        st.subheader("🤖 Grounded AI Notice Assistant")
        st.markdown(
            """
Ask questions about university notices in **Bengali** or **English**.
*Answers are generated strictly from verified published notices with direct source and passage citations.*
"""
        )

        sample_queries = [
            "What is the deadline for admit card collection for CSE Batch 54?",
            "ফল ২০২৬ সেমিস্টার ফাইনাল পরীক্ষার ফি কত এবং জমা দেওয়ার শেষ তারিখ কবে?",
            "When will the Fall 2026 Semester Final Exam begin?",
            "Are there any scholarship or financial aid opportunities available?",
        ]

        st.caption("Quick sample questions:")
        col_q1, col_q2 = st.columns(2)
        for i, sq in enumerate(sample_queries):
            target_col = col_q1 if i % 2 == 0 else col_q2
            if target_col.button(f"💬 {sq}", key=f"sq_{i}"):
                st.session_state.qa_query = sq

        user_query = st.text_input(
            "Your Question:",
            value=st.session_state.get("qa_query", ""),
            placeholder="Type your question in Bangla or English...",
        )

        if st.button("🚀 Ask Assistant", type="primary"):
            if not user_query.strip():
                st.warning("Please enter a question.")
            else:
                with st.spinner("Searching verified notices and formulating cited answer..."):
                    try:
                        qa_res = answer_question(user_query)
                        st.markdown("### 💡 Answer")
                        st.write(qa_res.answer)

                        if qa_res.citations:
                            st.markdown("### 📚 Source Citations & Quoted Passages")
                            for cit in qa_res.citations:
                                st.markdown(
                                    f"""
                                    <div class="citation-box">
                                        <strong>📌 Notice #{cit.notice_id}: {cit.notice_title}</strong>
                                        <p style="margin: 5px 0 0 0; font-style: italic; color: #1b5e20;">
                                            "{cit.matching_passage}"
                                        </p>
                                    </div>
                                    """,
                                    unsafe_allow_html=True,
                                )
                        elif not qa_res.found_answer:
                            st.info("No matching information was found in the published notices.")
                    except Exception as e:
                        st.error(f"Error answering question: {e}")


# ===========================================================================
# 2. OFFICE STAFF / PUBLISHER PORTAL
# ===========================================================================

elif role == "🏢 Office Staff / Publisher":
    st.header("🏢 Office Staff & Publisher Portal")
    st.caption("Upload notices, run OCR & AI extraction, review & verify fields, and publish.")

    sub_tabs = st.tabs(["📤 Upload & Extract", "📋 Review & Publish Drafts", "🗂️ Staged Draft Queue"])

    # -----------------------------------------------------------------------
    # SUBTAB 1: Upload & Extraction
    # -----------------------------------------------------------------------
    with sub_tabs[0]:
        st.subheader("1. Notice Ingestion Center")

        input_mode = st.radio(
            "Choose Input Format:",
            ["📷 Upload Photo / Scanned PDF / Digital PDF", "✍️ Plain Text Input"],
            horizontal=True,
        )

        uploaded_doc = None
        plain_input = ""
        is_handwritten = False

        if input_mode.startswith("📷"):
            uploaded_doc = st.file_uploader(
                "Upload Notice Document (PDF, PNG, JPG, JPEG)",
                type=["pdf", "png", "jpg", "jpeg"],
                help="Supports scanned PDFs, camera photos, digital PDFs, and printouts.",
            )
            is_handwritten = st.checkbox("✍️ Check if notice contains handwritten text", value=False)
        else:
            plain_input = st.text_area(
                "Paste Notice Plain Text:",
                height=200,
                placeholder="Paste notice text in Bengali or English here...",
            )

        if st.button("⚡ Run Extraction Pipeline", type="primary"):
            if not uploaded_doc and not plain_input.strip():
                st.error("Please provide a document file or plain text.")
            else:
                progress = st.progress(0, text="Starting document ingestion...")
                try:
                    # Ingest
                    progress.progress(25, text="Ingesting & preprocessing document...")
                    file_bytes = uploaded_doc.read() if uploaded_doc else None
                    fname = uploaded_doc.name if uploaded_doc else "pasted_text.txt"

                    ingestion = process_document(
                        file_bytes=file_bytes,
                        filename=fname,
                        plain_text=plain_input,
                        is_handwritten=is_handwritten,
                    )

                    progress.progress(60, text="Running Bengali/English OCR...")
                    st.session_state.staff_raw_text = ingestion.raw_text
                    st.session_state.staff_source_type = ingestion.source_type
                    st.session_state.staff_file_name = fname

                    # Preview images
                    if ingestion.preview_images:
                        st.session_state.staff_preview_img = ingestion.preview_images[0]

                    # AI Extraction
                    progress.progress(85, text="Extracting structured fields via Gemini...")
                    extract_res = extract_notice(ingestion.raw_text)
                    st.session_state.staff_extracted_data = extract_res.model_dump()

                    # Duplicate check
                    existing_notices = list_notices(status="all")
                    duplicates = detect_duplicates(ingestion.raw_text, existing_notices)
                    st.session_state.staff_duplicates = duplicates

                    progress.progress(100, text="Extraction complete! Proceed to Review tab.")
                    st.success("✅ Extraction complete! Please review and verify the extracted fields below.")
                except Exception as e:
                    progress.empty()
                    st.error(f"Pipeline error: {e}")

        # If extraction is in session, show quick preview
        if "staff_extracted_data" in st.session_state:
            data = st.session_state.staff_extracted_data
            st.markdown("---")
            st.markdown("### 📋 Quick Preview of Extracted Information")

            c_p1, c_p2 = st.columns([1, 2])
            with c_p1:
                if "staff_preview_img" in st.session_state:
                    st.image(st.session_state.staff_preview_img, caption="Preprocessed Preview", use_container_width=True)
            with c_p2:
                st.markdown(f"**Title:** {data.get('title')}")
                st.markdown(f"**Category:** {_category_badge(data.get('category', 'general'))}")
                st.markdown(f"**Office:** {data.get('issuing_office')}")
                st.markdown(f"**Date:** {data.get('date_of_issue')}")
                st.markdown(f"**Action:** {data.get('required_action')}")

            # Duplicate notice alert
            duplicates = st.session_state.get("staff_duplicates", [])
            if duplicates:
                st.warning(f"⚠️ Potential Duplicate Detected! Found {len(duplicates)} similar notice(s) in system:")
                for d in duplicates[:3]:
                    st.write(f"- Notice #{d.notice_id}: **{d.title}** (Similarity: {d.similarity_score * 100:.1f}%, Status: {d.status})")

    # -----------------------------------------------------------------------
    # SUBTAB 2: Staff Review & Publish
    # -----------------------------------------------------------------------
    with sub_tabs[1]:
        st.subheader("2. Human-in-the-Loop Review & Field Correction")
        st.info("⚠️ Required Policy: Extracted fields must be reviewed and verified by staff before publication.")

        if "staff_extracted_data" not in st.session_state:
            st.warning("No notice currently staged for review. Please upload a notice in the 'Upload & Extract' tab first.")
        else:
            data = st.session_state.staff_extracted_data

            with st.form("staff_review_form"):
                st.markdown("#### Primary Information")
                col_f1, col_f2 = st.columns([3, 1])
                with col_f1:
                    edit_title = st.text_input("Notice Title:", value=data.get("title") or "")
                with col_f2:
                    categories_list = [c["name"] for c in get_all_categories()]
                    current_cat = data.get("category", "general")
                    cat_idx = categories_list.index(current_cat) if current_cat in categories_list else 0
                    edit_category = st.selectbox("Category:", categories_list, index=cat_idx)

                col_f3, col_f4 = st.columns(2)
                with col_f3:
                    edit_office = st.text_input("Issuing Office:", value=data.get("issuing_office") or "")
                with col_f4:
                    edit_date = st.text_input("Date of Issue (YYYY-MM-DD):", value=data.get("date_of_issue") or "")

                st.markdown("#### Deadlines & Event Schedule")
                # Format deadlines as text for easy editing
                default_deadlines_str = ""
                if data.get("deadlines"):
                    default_deadlines_str = "\n".join([f"{d.get('date')}|{d.get('description')}" for d in data["deadlines"]])
                edit_deadlines_text = st.text_area(
                    "Deadlines (Format: YYYY-MM-DD|Description, one per line):",
                    value=default_deadlines_str,
                    height=80,
                )

                col_e1, col_e2 = st.columns(2)
                evt = data.get("event_date_time") or {}
                with col_e1:
                    edit_event_date = st.text_input("Event Date (YYYY-MM-DD):", value=evt.get("date") or "")
                with col_e2:
                    edit_event_time = st.text_input("Event Time (HH:MM):", value=evt.get("time") or "")

                st.markdown("#### Target Students & Actions")
                target = data.get("target_students") or {}
                col_t1, col_t2, col_t3 = st.columns(3)
                with col_t1:
                    edit_dept = st.text_input("Target Department (e.g. CSE, EEE, ALL):", value=target.get("department") or "ALL")
                with col_t2:
                    edit_batch = st.text_input("Target Batch (e.g. 54, ALL):", value=target.get("batch") or "ALL")
                with col_t3:
                    edit_sem = st.text_input("Target Semester:", value=target.get("semester") or "")

                edit_venue = st.text_input("Venue / Location:", value=data.get("venue") or "")
                edit_action = st.text_area("Required Student Action:", value=data.get("required_action") or "", height=70)

                col_fee1, col_fee2, col_fee3 = st.columns([2, 1, 3])
                fees = data.get("fees") or {}
                with col_fee1:
                    edit_fee_amt = st.number_input("Fee Amount:", value=float(fees.get("amount") or 0.0), step=100.0)
                with col_fee2:
                    edit_fee_curr = st.text_input("Currency:", value=fees.get("currency") or "BDT")
                with col_fee3:
                    edit_contact = st.text_input("Contact Info:", value=data.get("contact") or "")

                st.markdown("#### Bilingual Summaries")
                edit_summary_bn = st.text_area("Summary in Bengali:", value=data.get("summary_bengali") or "", height=80)
                edit_summary_en = st.text_area("Summary in English:", value=data.get("summary_english") or "", height=80)

                staff_reviewer_name = st.text_input("Reviewer Name / Signature:", value="Academic Staff Member")

                col_btn1, col_btn2 = st.columns(2)
                with col_btn1:
                    save_as_draft_btn = st.form_submit_button("💾 Save as Draft")
                with col_btn2:
                    publish_now_btn = st.form_submit_button("✅ Approve & Publish Notice", type="primary")

            if save_as_draft_btn or publish_now_btn:
                # Parse deadlines
                parsed_deadlines = []
                for line in edit_deadlines_text.strip().splitlines():
                    if "|" in line:
                        d_parts = line.split("|", 1)
                        parsed_deadlines.append(Deadline(date=d_parts[0].strip(), description=d_parts[1].strip()))
                    elif line.strip():
                        parsed_deadlines.append(Deadline(date=line.strip(), description="General Deadline"))

                # Event
                evt_obj = EventDateTime(date=edit_event_date, time=edit_event_time) if edit_event_date else None
                # Fees
                fees_obj = Fees(amount=edit_fee_amt, currency=edit_fee_curr) if edit_fee_amt > 0 else None
                # Target
                target_obj = TargetStudents(department=edit_dept, batch=edit_batch, semester=edit_sem)

                record = NoticeRecord(
                    title=edit_title,
                    issuing_office=edit_office,
                    date_of_issue=edit_date,
                    category=edit_category,
                    venue=edit_venue,
                    required_action=edit_action,
                    contact=edit_contact,
                    deadlines=parsed_deadlines if parsed_deadlines else None,
                    event_date_time=evt_obj,
                    fees=fees_obj,
                    target_students=target_obj,
                    summary_bengali=edit_summary_bn,
                    summary_english=edit_summary_en,
                    raw_text=st.session_state.get("staff_raw_text", ""),
                    source_type=st.session_state.get("staff_source_type", "photo"),
                    file_name=st.session_state.get("staff_file_name", "notice.pdf"),
                    status="published" if publish_now_btn else "draft",
                    published_by=staff_reviewer_name if publish_now_btn else None,
                    published_at=datetime.now().isoformat() if publish_now_btn else None,
                    review_notes=f"Reviewed and verified by {staff_reviewer_name}",
                )

                nid = save_notice(record)
                if publish_now_btn:
                    st.success(f"🎉 Notice #{nid} has been approved and published to the Student Portal!")
                else:
                    st.success(f"💾 Notice #{nid} saved as Draft in staging queue.")

                # Clean all staff-related session state
                for key in [
                    "staff_extracted_data",
                    "staff_raw_text",
                    "staff_source_type",
                    "staff_file_name",
                    "staff_preview_img",
                    "staff_duplicates",
                ]:
                    st.session_state.pop(key, None)

    # -----------------------------------------------------------------------
    # SUBTAB 3: Staged Draft Queue
    # -----------------------------------------------------------------------
    with sub_tabs[2]:
        st.subheader("3. Staged Draft Notices Queue")
        drafts = list_notices(status="draft")

        if not drafts:
            st.info("No draft notices awaiting review. All notices are up to date.")
        else:
            for d in drafts:
                with st.expander(f"Draft #{d.id}: {d.title} (Source: {d.source_type})"):
                    st.write(f"Office: {d.issuing_office} | Date: {d.date_of_issue}")
                    st.write(f"Summary: {d.summary_english}")
                    if st.button(f"✅ Approve & Publish #{d.id}", key=f"pub_{d.id}"):
                        publish_notice(d.id, published_by="Staff Quick Approver")
                        st.success(f"Notice #{d.id} is now published!")
                        st.rerun()


# ===========================================================================
# 3. ADMINISTRATOR PORTAL
# ===========================================================================

elif role == "⚙️ Administrator":
    st.header("⚙️ System Administrator Portal")

    adm_tabs = st.tabs([
        "🏛️ Departments & Categories",
        "🗃️ Manage Published Notices",
        "📊 Evaluation Benchmark Suite (CER & Accuracy)",
    ])

    # -----------------------------------------------------------------------
    # TAB 1: Departments & Categories
    # -----------------------------------------------------------------------
    with adm_tabs[0]:
        col_d1, col_d2 = st.columns(2)
        with col_d1:
            st.subheader("🏛️ Academic Departments")
            all_depts = get_all_departments()
            st.dataframe(all_depts, use_container_width=True)

            with st.form("add_dept_form"):
                st.markdown("**Add New Department**")
                new_dcode = st.text_input("Department Code (e.g. ME):")
                new_dname = st.text_input("Department Full Name (e.g. Mechanical Engineering):")
                if st.form_submit_button("➕ Add Department"):
                    if new_dcode and new_dname:
                        if add_department(new_dcode, new_dname):
                            st.success(f"Department {new_dcode} added!")
                            st.rerun()
                        else:
                            st.error("Department code already exists.")

        with col_d2:
            st.subheader("🏷️ Notice Categories")
            all_cats = get_all_categories()
            st.dataframe(all_cats, use_container_width=True)

            with st.form("add_cat_form"):
                st.markdown("**Add New Category**")
                new_cname = st.text_input("Category Identifier (e.g. workshop):")
                new_cdisp = st.text_input("Display Name (e.g. Workshops & Training):")
                new_cicon = st.text_input("Icon Emoji:", value="💡")
                if st.form_submit_button("➕ Add Category"):
                    if new_cname and new_cdisp:
                        if add_category(new_cname, new_cdisp, new_cicon):
                            st.success(f"Category {new_cname} added!")
                            st.rerun()
                        else:
                            st.error("Category already exists.")

    # -----------------------------------------------------------------------
    # TAB 2: Manage Published Notices
    # -----------------------------------------------------------------------
    with adm_tabs[1]:
        st.subheader("🗃️ Published Notices Archive Management")
        all_notices = list_notices(status="all")
        st.write(f"Total notices in database: **{len(all_notices)}**")

        for n in all_notices:
            with st.expander(f"[{n.status.upper()}] #{n.id}: {n.title} ({n.category})"):
                st.write(f"Issuing Office: {n.issuing_office} | Date: {n.date_of_issue} | Target: {n.target_students.department if n.target_students else 'ALL'}")
                c_act1, c_act2 = st.columns(2)
                with c_act1:
                    if n.status == "draft":
                        if st.button(f"Publish #{n.id}", key=f"adm_pub_{n.id}"):
                            publish_notice(n.id, published_by="Admin")
                            st.rerun()
                with c_act2:
                    if st.button(f"🗑️ Delete #{n.id}", key=f"adm_del_{n.id}"):
                        delete_notice(n.id)
                        st.success(f"Notice #{n.id} deleted.")
                        st.rerun()

    # -----------------------------------------------------------------------
    # TAB 3: Evaluation Benchmark Suite
    # -----------------------------------------------------------------------
    with adm_tabs[2]:
        st.subheader("📊 System Evaluation Suite (CER & Extraction Accuracy)")
        st.markdown(
            """
Requirement 10: *Evaluation on at least 30 notices: report OCR character error rate and extraction accuracy for each field.*
"""
        )

        col_ev1, col_ev2 = st.columns(2)
        with col_ev1:
            if st.button("🚀 Run Evaluation Benchmark on 32 Notices", type="primary"):
                with st.spinner("Running CER and field extraction accuracy benchmark..."):
                    from evaluation.evaluate import evaluate_benchmark
                    eval_results = evaluate_benchmark()
                    st.session_state.eval_results = eval_results
                    st.success("Evaluation complete!")

        with col_ev2:
            if st.button("🌱 Seed Database with 32 Benchmark Notices"):
                from evaluation.evaluate import seed_database_with_benchmark
                count = seed_database_with_benchmark()
                st.success(f"Database seeded with benchmark notices (Total: {count})")
                st.rerun()

        if "eval_results" in st.session_state:
            res = st.session_state.eval_results

            st.markdown("### 🏆 Benchmark Summary Scorecard")
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Total Notices Evaluated", res.total_notices)
            m2.metric("Mean OCR CER", f"{res.mean_character_error_rate:.4f}", help="Character Error Rate across Bengali and English text")
            m3.metric("OCR Character Accuracy", f"{res.ocr_accuracy_percentage:.1f}%")
            m4.metric("Overall Field Extraction", f"{res.overall_extraction_accuracy:.1f}%")

            st.markdown("### 📋 Field-by-Field Extraction Accuracy")
            st.dataframe(res.detailed_field_reports, use_container_width=True)
