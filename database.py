import sqlite3
import os
from datetime import datetime

DB_PATH = "interview_mentor.db"
MAX_SESSIONS = 10


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL DEFAULT 'General',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            message_count INTEGER DEFAULT 0
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
    """)
    conn.commit()
    conn.close()


def create_session(role="General"):
    conn = get_conn()
    c = conn.cursor()
    now = datetime.now().isoformat()
    c.execute(
        "INSERT INTO sessions (role, created_at, updated_at) VALUES (?, ?, ?)",
        (role, now, now)
    )
    session_id = c.lastrowid
    conn.commit()
    conn.close()
    return session_id


def get_all_sessions():
    conn = get_conn()
    c = conn.cursor()
    rows = c.execute(
        "SELECT * FROM sessions ORDER BY updated_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_session(session_id):
    conn = get_conn()
    c = conn.cursor()
    row = c.execute(
        "SELECT * FROM sessions WHERE id = ?", (session_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_session_messages(session_id):
    conn = get_conn()
    c = conn.cursor()
    rows = c.execute(
        "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC",
        (session_id,)
    ).fetchall()
    conn.close()
    return [{"role": r["role"], "content": r["content"]} for r in rows]


def add_message(session_id, role, content):
    conn = get_conn()
    c = conn.cursor()
    now = datetime.now().isoformat()
    c.execute(
        "INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (session_id, role, content, now)
    )
    c.execute(
        "UPDATE sessions SET updated_at = ?, message_count = message_count + 1 WHERE id = ?",
        (now, session_id)
    )
    conn.commit()
    conn.close()


def delete_session(session_id):
    conn = get_conn()
    c = conn.cursor()
    c.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
    c.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()


def cleanup_old_sessions():
    """Auto-delete oldest sessions when count exceeds MAX_SESSIONS."""
    conn = get_conn()
    c = conn.cursor()
    rows = c.execute(
        "SELECT id FROM sessions ORDER BY created_at ASC"
    ).fetchall()
    conn.close()
    total = len(rows)
    if total > MAX_SESSIONS:
        to_delete = rows[:total - MAX_SESSIONS]
        for row in to_delete:
            delete_session(row["id"])


init_db()