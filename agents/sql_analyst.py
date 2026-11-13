"""Agent 2: text-to-SQL analyst over a SQLite database. Strictly read-only.

    python -m agents.sql_analyst --make-sample data/sample.db
    python -m agents.sql_analyst data/sample.db "which product category earned the most in Q4?"
"""

from __future__ import annotations

import argparse
import random
import re
import sqlite3
import time
from datetime import date, timedelta
from pathlib import Path

from .core import Tool, cli, run_agent

MAX_ROWS = 200
QUERY_TIMEOUT_S = 5.0

SYSTEM = """You are a careful data analyst answering questions from a SQLite database.
Workflow: list_tables, describe_table for the relevant tables, then write SQL with run_query.
If a query errors or returns something surprising (zero rows, NULLs, implausible totals),
investigate and fix it rather than reporting it. Prefer aggregating in SQL over pulling raw rows.
Final answer: the answer first, then the key numbers, then the SQL you relied on and any
assumptions (for example how you defined 'revenue'). Never claim a number you did not query."""

_ALLOWED = {
    sqlite3.SQLITE_SELECT,
    sqlite3.SQLITE_READ,
    sqlite3.SQLITE_FUNCTION,
    getattr(sqlite3, "SQLITE_RECURSIVE", 33),
}


def _authorizer(action, *_):
    return sqlite3.SQLITE_OK if action in _ALLOWED else sqlite3.SQLITE_DENY


class SqlTools:
    def __init__(self, db_path: str | Path):
        path = Path(db_path).resolve()
        if not path.exists():
            raise FileNotFoundError(f"{db_path} not found (try --make-sample)")
        # Two layers: the file is opened read-only, and every query runs under an authorizer
        # that only permits SELECT, so DDL/DML/ATTACH/PRAGMA are denied by SQLite itself.
        self.con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)

    def _tables(self) -> list[str]:
        rows = self.con.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
        return [r[0] for r in rows]

    def list_tables(self) -> str:
        out = []
        for t in self._tables():
            n = self.con.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
            out.append(f"{t} ({n} rows)")
        return "\n".join(out) or "(no tables)"

    def describe_table(self, table: str) -> str:
        if table not in self._tables():  # whitelist, so the name is safe to quote below
            raise ValueError(f"unknown table {table!r}; call list_tables")
        ddl = self.con.execute("SELECT sql FROM sqlite_master WHERE name=?", (table,)).fetchone()[0]
        cur = self.con.execute(f'SELECT * FROM "{table}" LIMIT 3')
        return f"{ddl}\n\nsample rows:\n{self._fmt(cur.description, cur.fetchall())}"

    def run_query(self, sql: str) -> str:
        deadline = time.monotonic() + QUERY_TIMEOUT_S
        self.con.set_authorizer(_authorizer)
        self.con.set_progress_handler(lambda: int(time.monotonic() > deadline), 10_000)
        try:
            cur = self.con.execute(sql)
            rows = cur.fetchmany(MAX_ROWS + 1)
            note = f"\n(showing first {MAX_ROWS} rows; add LIMIT or aggregate)" if len(rows) > MAX_ROWS else ""
            return self._fmt(cur.description, rows[:MAX_ROWS]) + note
        except sqlite3.DatabaseError as exc:
            raise ValueError(f"{exc} (only single read-only SELECT statements are allowed)") from None
        finally:
            self.con.set_authorizer(None)
            self.con.set_progress_handler(None, 0)

    @staticmethod
    def _fmt(description, rows) -> str:
        if not description:
            return "(no result set)"
        header = [d[0] for d in description]
        lines = ["\t".join(header)] + ["\t".join("NULL" if v is None else str(v) for v in r) for r in rows]
        return "\n".join(lines) if rows else "\t".join(header) + "\n(0 rows)"

    def tools(self) -> list[Tool]:
        return [
            Tool("list_tables", "List tables and views with row counts. Call this first.", {}, [], self.list_tables),
            Tool(
                "describe_table",
                "Show a table's CREATE statement and 3 sample rows. Use before writing SQL against it.",
                {"table": {"type": "string", "description": "Table or view name from list_tables"}},
                ["table"],
                self.describe_table,
            ),
            Tool(
                "run_query",
                f"Run ONE read-only SQLite SELECT (CTEs allowed). Returns tab-separated rows, max {MAX_ROWS}. "
                "Writes are rejected. Errors come back as text so you can fix the SQL.",
                {"sql": {"type": "string", "description": "A single SELECT statement"}},
                ["sql"],
                self.run_query,
            ),
        ]


def ask(db_path: str | Path, question: str, **kwargs) -> str:
    return run_agent(system=SYSTEM, task=question, tools=SqlTools(db_path).tools(), **kwargs)


def make_sample_db(path: str | Path, seed: int = 7) -> None:
    """Deterministic demo shop: customers, products, orders, order_items."""
    rnd = random.Random(seed)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    con = sqlite3.connect(path)
    con.executescript(
        """
        CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, country TEXT, signup_date TEXT);
        CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, category TEXT, unit_price REAL);
        CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id),
                             order_date TEXT, status TEXT);
        CREATE TABLE order_items (order_id INTEGER REFERENCES orders(id),
                                  product_id INTEGER REFERENCES products(id),
                                  quantity INTEGER, PRIMARY KEY (order_id, product_id));
        """
    )
    countries = ["US", "DE", "JP", "BR", "IN", "GB"]
    cats = {"Audio": 40, "Keyboards": 90, "Displays": 250, "Cables": 12, "Chairs": 180}
    con.executemany(
        "INSERT INTO customers VALUES (?,?,?,?)",
        [(i, f"Customer {i}", rnd.choice(countries), str(date(2024, 1, 1) + timedelta(days=rnd.randrange(400)))) for i in range(1, 201)],
    )
    products = [(i, f"{c} {n}", c, round(base * rnd.uniform(0.6, 1.6), 2)) for i, (c, base, n) in enumerate(
        [(c, b, n) for c, b in cats.items() for n in range(1, 5)], 1)]
    con.executemany("INSERT INTO products VALUES (?,?,?,?)", products)
    for oid in range(1, 1501):
        d = date(2025, 1, 1) + timedelta(days=rnd.randrange(365))
        con.execute("INSERT INTO orders VALUES (?,?,?,?)",
                    (oid, rnd.randint(1, 200), str(d), rnd.choices(["shipped", "cancelled", "returned"], [90, 6, 4])[0]))
        for pid in rnd.sample(range(1, len(products) + 1), rnd.randint(1, 4)):
            con.execute("INSERT INTO order_items VALUES (?,?,?)", (oid, pid, rnd.randint(1, 5)))
    con.commit()
    con.close()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--make-sample", metavar="PATH", help="create a demo SQLite database and exit")
    ap.add_argument("db", nargs="?")
    ap.add_argument("question", nargs="?")
    args = ap.parse_args()
    if args.make_sample:
        make_sample_db(args.make_sample)
        print(f"wrote {args.make_sample}")
        return
    if not (args.db and args.question):
        ap.error("usage: sql_analyst DB QUESTION  (or --make-sample PATH)")
    print(ask(args.db, args.question))


if __name__ == "__main__":
    cli(main)
