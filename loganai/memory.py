import sqlite3
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path("data/loganai.sqlite3")

class MemoryStore:
    def __init__(self, path=DB_PATH):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as db:
            db.execute("""CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )""")
            db.execute("""CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )""")

    def _connect(self):
        return sqlite3.connect(self.path)

    def add(self, content: str):
        content = content.strip()
        if not content or len(content) > 2000: raise ValueError("Souvenir vide ou trop long (2000 caractères max).")
        with self._connect() as db:
            cur = db.execute("INSERT INTO memories(content,created_at) VALUES(?,?)",(content,datetime.now(timezone.utc).isoformat()))
            return cur.lastrowid

    def list(self):
        with self._connect() as db:
            return [{"id":r[0],"content":r[1],"created_at":r[2]} for r in db.execute("SELECT id,content,created_at FROM memories ORDER BY id DESC")]

    def delete(self, memory_id: int):
        with self._connect() as db:
            cur = db.execute("DELETE FROM memories WHERE id=?",(memory_id,))
            return cur.rowcount > 0

    def add_message(self, role, content):
        with self._connect() as db:
            db.execute("INSERT INTO messages(role,content,created_at) VALUES(?,?,?)",(role,content,datetime.now(timezone.utc).isoformat()))

    def history(self, limit=40):
        with self._connect() as db:
            rows = db.execute("SELECT role,content FROM messages ORDER BY id DESC LIMIT ?",(limit,)).fetchall()
        return [{"role":r[0],"content":r[1]} for r in reversed(rows)]

    def clear_history(self):
        with self._connect() as db: db.execute("DELETE FROM messages")
