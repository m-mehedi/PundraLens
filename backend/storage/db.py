"""SQLite database and repository layer for NoticeLens.

Stores notices, departments, categories, users, and audit revisions.
Provides filtering by category, department, date range, and full-text search.
"""

from __future__ import annotations

import json
import logging
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from pipeline.models import Deadline, EventDateTime, Fees, NoticeRecord, TargetStudents

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "notices.db"


def get_connection() -> sqlite3.Connection:
    """Create and return a database connection with dictionary row access."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def db_connection():
    """Context manager that guarantees the database connection is closed."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    """Initialize database tables and seed default categories & departments."""
    with db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS notices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                issuing_office TEXT,
                date_of_issue TEXT,
                category TEXT DEFAULT 'general',
                venue TEXT,
                required_action TEXT,
                contact TEXT,
                department TEXT,
                batch TEXT,
                semester TEXT,
                deadlines_json TEXT,
                event_date_time_json TEXT,
                fees_json TEXT,
                summary_bengali TEXT,
                summary_english TEXT,
                raw_text TEXT,
                source_type TEXT DEFAULT 'photo',
                file_name TEXT,
                file_hash TEXT,
                status TEXT DEFAULT 'draft',
                created_at TEXT,
                published_at TEXT,
                published_by TEXT,
                review_notes TEXT,
                version INTEGER DEFAULT 1
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS departments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE,
                name TEXT
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                display_name TEXT,
                icon TEXT
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                name TEXT,
                role TEXT,
                department TEXT,
                batch TEXT
            )
            """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS revisions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                notice_id INTEGER,
                diff_summary TEXT,
                previous_data_json TEXT,
                new_data_json TEXT,
                created_at TEXT
            )
            """
        )

        # Seed default departments if empty
        cursor.execute("SELECT COUNT(*) FROM departments")
        if cursor.fetchone()[0] == 0:
            default_depts = [
                ("ALL", "All Departments / University-Wide"),
                ("CSE", "Computer Science & Engineering"),
                ("EEE", "Electrical & Electronic Engineering"),
                ("CE", "Civil Engineering"),
                ("BBA", "Business Administration"),
                ("ENG", "English"),
                ("LAW", "Law & Justice"),
                ("PHARM", "Pharmacy"),
                ("PUB", "Public Health"),
            ]
            cursor.executemany("INSERT INTO departments (code, name) VALUES (?, ?)", default_depts)

        # Seed default categories if empty
        cursor.execute("SELECT COUNT(*) FROM categories")
        if cursor.fetchone()[0] == 0:
            default_cats = [
                ("exam", "Examination", "📝"),
                ("registration", "Registration & Course Enrollment", "📋"),
                ("fee", "Tuition & Fee Payment", "💰"),
                ("holiday", "Holidays & Vacations", "🏖️"),
                ("event", "Seminars, Workshops & Events", "🎉"),
                ("scholarship", "Scholarships & Financial Aid", "🎓"),
                ("result", "Results & Grades", "📊"),
                ("general", "General Administrative Notices", "📢"),
            ]
            cursor.executemany("INSERT INTO categories (name, display_name, icon) VALUES (?, ?, ?)", default_cats)

        # Seed sample users if empty
        cursor.execute("SELECT COUNT(*) FROM users")
        if cursor.fetchone()[0] == 0:
            default_users = [
                ("student1", "Rafiqul Islam", "student", "CSE", "54"),
                ("student2", "Nusrat Jahan", "student", "EEE", "52"),
                ("staff1", "Mohammad Karim (Academic Office)", "staff", "ALL", None),
                ("admin1", "Admin Portal Manager", "admin", "ALL", None),
            ]
            cursor.executemany("INSERT INTO users (username, name, role, department, batch) VALUES (?, ?, ?, ?, ?)", default_users)

        conn.commit()


def row_to_notice_record(row: sqlite3.Row) -> NoticeRecord:
    """Convert an SQLite row to a NoticeRecord Pydantic instance."""
    deadlines = None
    if row["deadlines_json"]:
        try:
            d_list = json.loads(row["deadlines_json"])
            if d_list:
                deadlines = [Deadline(**item) for item in d_list]
        except Exception:
            pass

    event_dt = None
    if row["event_date_time_json"]:
        try:
            e_dict = json.loads(row["event_date_time_json"])
            if e_dict:
                event_dt = EventDateTime(**e_dict)
        except Exception:
            pass

    fees = None
    if row["fees_json"]:
        try:
            f_dict = json.loads(row["fees_json"])
            if f_dict:
                fees = Fees(**f_dict)
        except Exception:
            pass

    target = None
    if row["department"] or row["batch"] or row["semester"]:
        target = TargetStudents(
            department=row["department"],
            batch=row["batch"],
            semester=row["semester"],
        )

    return NoticeRecord(
        id=row["id"],
        title=row["title"],
        issuing_office=row["issuing_office"],
        date_of_issue=row["date_of_issue"],
        category=row["category"] or "general",
        deadlines=deadlines,
        event_date_time=event_dt,
        venue=row["venue"],
        target_students=target,
        required_action=row["required_action"],
        fees=fees,
        contact=row["contact"],
        summary_bengali=row["summary_bengali"],
        summary_english=row["summary_english"],
        raw_text=row["raw_text"],
        source_type=row["source_type"] or "photo",
        file_name=row["file_name"],
        status=row["status"] or "draft",
        created_at=row["created_at"],
        published_at=row["published_at"],
        published_by=row["published_by"],
        review_notes=row["review_notes"],
        version=row["version"] or 1,
    )


def save_notice(notice: NoticeRecord) -> int:
    """Insert a new notice into the database and return its new ID."""
    with db_connection() as conn:
        cursor = conn.cursor()

        now_iso = datetime.now().isoformat()
        created_at = notice.created_at or now_iso

        dept = notice.target_students.department if notice.target_students else None
        batch = notice.target_students.batch if notice.target_students else None
        sem = notice.target_students.semester if notice.target_students else None

        deadlines_json = json.dumps([d.model_dump() for d in notice.deadlines]) if notice.deadlines else None
        event_json = json.dumps(notice.event_date_time.model_dump()) if notice.event_date_time else None
        fees_json = json.dumps(notice.fees.model_dump()) if notice.fees else None

        cursor.execute(
            """
            INSERT INTO notices (
                title, issuing_office, date_of_issue, category, venue,
                required_action, contact, department, batch, semester,
                deadlines_json, event_date_time_json, fees_json,
                summary_bengali, summary_english, raw_text, source_type,
                file_name, status, created_at, published_at, published_by,
                review_notes, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                notice.title,
                notice.issuing_office,
                notice.date_of_issue,
                notice.category,
                notice.venue,
                notice.required_action,
                notice.contact,
                dept,
                batch,
                sem,
                deadlines_json,
                event_json,
                fees_json,
                notice.summary_bengali,
                notice.summary_english,
                notice.raw_text,
                notice.source_type,
                notice.file_name,
                notice.status,
                created_at,
                notice.published_at,
                notice.published_by,
                notice.review_notes,
                notice.version,
            ),
        )
        new_id = cursor.lastrowid
        conn.commit()
        return new_id


def update_notice(notice: NoticeRecord, updated_by: Optional[str] = None) -> None:
    """Update an existing notice."""
    if not notice.id:
        raise ValueError("Notice ID must be provided to update")

    with db_connection() as conn:
        cursor = conn.cursor()

        dept = notice.target_students.department if notice.target_students else None
        batch = notice.target_students.batch if notice.target_students else None
        sem = notice.target_students.semester if notice.target_students else None

        deadlines_json = json.dumps([d.model_dump() for d in notice.deadlines]) if notice.deadlines else None
        event_json = json.dumps(notice.event_date_time.model_dump()) if notice.event_date_time else None
        fees_json = json.dumps(notice.fees.model_dump()) if notice.fees else None

        cursor.execute(
            """
            UPDATE notices SET
                title = ?, issuing_office = ?, date_of_issue = ?, category = ?, venue = ?,
                required_action = ?, contact = ?, department = ?, batch = ?, semester = ?,
                deadlines_json = ?, event_date_time_json = ?, fees_json = ?,
                summary_bengali = ?, summary_english = ?, raw_text = ?, source_type = ?,
                status = ?, published_at = ?, published_by = ?, review_notes = ?, version = version + 1
            WHERE id = ?
            """,
            (
                notice.title,
                notice.issuing_office,
                notice.date_of_issue,
                notice.category,
                notice.venue,
                notice.required_action,
                notice.contact,
                dept,
                batch,
                sem,
                deadlines_json,
                event_json,
                fees_json,
                notice.summary_bengali,
                notice.summary_english,
                notice.raw_text,
                notice.source_type,
                notice.status,
                notice.published_at,
                notice.published_by,
                notice.review_notes,
                notice.id,
            ),
        )
        conn.commit()


def publish_notice(notice_id: int, published_by: str = "Staff Reviewer") -> None:
    """Mark a notice as verified and published."""
    with db_connection() as conn:
        cursor = conn.cursor()
        now_iso = datetime.now().isoformat()
        cursor.execute(
            """
            UPDATE notices SET
                status = 'published',
                published_at = ?,
                published_by = ?
            WHERE id = ?
            """,
            (now_iso, published_by, notice_id),
        )
        conn.commit()


def get_notice_by_id(notice_id: int) -> Optional[NoticeRecord]:
    """Retrieve a single notice by ID."""
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM notices WHERE id = ?", (notice_id,))
        row = cursor.fetchone()
        if row:
            return row_to_notice_record(row)
        return None


def delete_notice(notice_id: int) -> None:
    """Delete a notice by ID."""
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM notices WHERE id = ?", (notice_id,))
        conn.commit()


def list_notices(
    status: Optional[str] = "published",
    category: Optional[str] = None,
    department: Optional[str] = None,
    batch: Optional[str] = None,
    search_query: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    offset: int = 0,
    limit: Optional[int] = None,
) -> List[NoticeRecord]:
    """List notices with dynamic filtering, full-text search, and pagination."""
    with db_connection() as conn:
        cursor = conn.cursor()

        conditions: List[str] = []
        params: List[Any] = []

        if status and status != "all":
            conditions.append("status = ?")
            params.append(status)

        if category and category != "all":
            conditions.append("category = ?")
            params.append(category)

        if department and department not in ["ALL", "all", ""]:
            # Match department or notices applicable to all departments
            conditions.append("(department IS NULL OR department = '' OR department = 'ALL' OR department LIKE ?)")
            params.append(f"%{department}%")

        if batch and batch not in ["ALL", "all", ""]:
            conditions.append("(batch IS NULL OR batch = '' OR batch = 'ALL' OR batch LIKE ?)")
            params.append(f"%{batch}%")

        if start_date:
            conditions.append("date_of_issue >= ?")
            params.append(start_date)

        if end_date:
            conditions.append("date_of_issue <= ?")
            params.append(end_date)

        if search_query and search_query.strip():
            term = f"%{search_query.strip()}%"
            conditions.append(
                "(title LIKE ? OR issuing_office LIKE ? OR raw_text LIKE ? OR summary_bengali LIKE ? OR summary_english LIKE ? OR required_action LIKE ?)"
            )
            params.extend([term, term, term, term, term, term])

        where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""
        query = f"SELECT * FROM notices{where_clause} ORDER BY date_of_issue DESC, id DESC"

        # Apply pagination
        if limit is not None and limit > 0:
            query += " LIMIT ? OFFSET ?"
            params.extend([limit, offset])

        cursor.execute(query, params)
        rows = cursor.fetchall()

        return [row_to_notice_record(r) for r in rows]


def get_all_departments() -> List[Dict[str, str]]:
    """Return list of registered departments."""
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT code, name FROM departments ORDER BY code")
        rows = cursor.fetchall()
        return [{"code": r["code"], "name": r["name"]} for r in rows]


def add_department(code: str, name: str) -> bool:
    """Add a new department."""
    with db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO departments (code, name) VALUES (?, ?)", (code.strip().upper(), name.strip()))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False


def get_all_categories() -> List[Dict[str, str]]:
    """Return list of categories."""
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name, display_name, icon FROM categories ORDER BY id")
        rows = cursor.fetchall()
        return [{"name": r["name"], "display_name": r["display_name"], "icon": r["icon"]} for r in rows]


def add_category(name: str, display_name: str, icon: str = "📢") -> bool:
    """Add a new category."""
    with db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO categories (name, display_name, icon) VALUES (?, ?, ?)", (name.strip().lower(), display_name.strip(), icon))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
