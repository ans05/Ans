"""Offline tests: a scripted fake client stands in for the API, so no key or network is needed.

    python -m pytest agents/tests -q
"""

import json
import subprocess
from types import SimpleNamespace as NS

import pytest

from agents import core
from agents.codebase_qa import CodeTools
from agents.core import AgentRefused, AgentStepLimit, Tool, run_agent
from agents.pr_reviewer import GitTools, render, review
from agents.sql_analyst import SqlTools, make_sample_db


# ---------- fake client ----------
def text(t):
    return NS(type="text", text=t)


def call(id, name, **inp):
    return NS(type="tool_use", id=id, name=name, input=inp)


def resp(content, stop="end_turn", **kw):
    return NS(content=content, stop_reason=stop, **kw)


class FakeClient:
    """Returns scripted responses in order and records every request."""

    def __init__(self, *responses):
        self.script = list(responses)
        self.requests = []
        self.messages = NS(create=self._create)
        self.beta = NS(messages=NS(create=self._create))

    def _create(self, **kw):
        self.requests.append({**kw, "messages": list(kw["messages"])})  # snapshot: the loop keeps appending
        return self.script.pop(0)


QUIET = dict(log=lambda _: None, use_fallbacks=False)


# ---------- core loop ----------
def test_loop_runs_tool_and_batches_results_in_one_message():
    seen = []
    echo = Tool("echo", "d", {"x": {"type": "string"}}, ["x"], lambda x: seen.append(x) or f"got {x}")
    fake = FakeClient(
        resp([call("a", "echo", x="1"), call("b", "echo", x="2")], "tool_use"),
        resp([text("done")]),
    )
    assert run_agent(system="s", task="t", tools=[echo], client=fake, **QUIET) == "done"
    assert seen == ["1", "2"]
    results = fake.requests[1]["messages"][-1]
    assert results["role"] == "user" and [r["tool_use_id"] for r in results["content"]] == ["a", "b"]


def test_tool_errors_and_unknown_tools_go_back_to_the_model():
    boom = Tool("boom", "d", {}, [], lambda: 1 / 0)
    fake = FakeClient(resp([call("a", "boom"), call("b", "nope")], "tool_use"), resp([text("recovered")]))
    assert run_agent(system="s", task="t", tools=[boom], client=fake, **QUIET) == "recovered"
    r = fake.requests[1]["messages"][-1]["content"]
    assert all(x["is_error"] for x in r) and "division" in r[0]["content"] and "unknown tool" in r[1]["content"]


def test_refusal_and_step_limit_raise():
    with pytest.raises(AgentRefused):
        run_agent(system="s", task="t", tools=[], client=FakeClient(resp([], "refusal")), **QUIET)
    loop = Tool("loop", "d", {}, [], lambda: "again")
    fake = FakeClient(*[resp([call(str(i), "loop")], "tool_use") for i in range(3)])
    with pytest.raises(AgentStepLimit):
        run_agent(system="s", task="t", tools=[loop], client=fake, max_steps=3, **QUIET)


def test_long_tool_output_is_clipped():
    big = Tool("big", "d", {}, [], lambda: "x" * 50_000)
    fake = FakeClient(resp([call("a", "big")], "tool_use"), resp([text("ok")]))
    run_agent(system="s", task="t", tools=[big], client=fake, **QUIET)
    assert "truncated" in fake.requests[1]["messages"][-1]["content"][0]["content"]


def test_fallback_flag_uses_beta_endpoint_and_echo_drops_pre_boundary_blocks():
    blocks = [NS(type="thinking"), call("a", "x"), NS(type="fallback"), text("hi")]
    assert [b.type for b in core.echo_content(blocks)] == ["fallback", "text"]
    fake = FakeClient(resp([text("hi")]))
    run_agent(system="s", task="t", tools=[], client=fake, log=lambda _: None, use_fallbacks=True)
    assert fake.requests[0]["fallbacks"] == "default" and "betas" in fake.requests[0]


# ---------- codebase_qa tools ----------
@pytest.fixture
def repo(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "a.js").write_text("function save() {\n  return 1;\n}\n")
    (tmp_path / ".env").write_text("SECRET=1")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "x.js").write_text("function save() {}")
    return tmp_path


def test_read_file_numbers_lines_and_grep_skips_junk(repo):
    t = CodeTools(repo)
    assert "    2    return 1;" in t.read_file("src/a.js")
    out = t.grep(r"function save")
    assert out == "src/a.js:1: function save() {"  # node_modules excluded
    assert ".env" not in t.list_dir(".") and "node_modules" not in t.list_dir(".")


def test_codetools_block_escape_secrets_and_symlinks(repo, tmp_path_factory):
    t = CodeTools(repo)
    for bad in ("../outside", "/etc/passwd", ".env"):
        with pytest.raises(PermissionError):
            t.read_file(bad)
    outside = tmp_path_factory.mktemp("o") / "s.txt"
    outside.write_text("secret")
    (repo / "link").symlink_to(outside)
    with pytest.raises(PermissionError):
        t.read_file("link")


# ---------- sql_analyst tools ----------
@pytest.fixture
def db(tmp_path):
    p = tmp_path / "s.db"
    make_sample_db(p)
    return p


def test_sample_db_queries_work(db):
    t = SqlTools(db)
    assert "orders (1500 rows)" in t.list_tables()
    assert "CREATE TABLE products" in t.describe_table("products")
    out = t.run_query("SELECT category, COUNT(*) n FROM products GROUP BY 1 ORDER BY 1")
    assert out.splitlines()[0] == "category\tn" and "Audio\t4" in out
    assert "(0 rows)" in t.run_query("SELECT * FROM orders WHERE id < 0")


@pytest.mark.parametrize(
    "sql",
    [
        "DROP TABLE orders",
        "DELETE FROM orders",
        "INSERT INTO customers VALUES (999,'x','US','2025-01-01')",
        "UPDATE orders SET status='x'",
        "ATTACH DATABASE ':memory:' AS m",
        "PRAGMA writable_schema=1",
        "CREATE TABLE t(a)",
        "SELECT 1; DROP TABLE orders",
    ],
)
def test_sql_writes_are_rejected_and_data_survives(db, sql):
    t = SqlTools(db)
    with pytest.raises(ValueError):
        t.run_query(sql)
    assert "orders (1500 rows)" in t.list_tables()


def test_sql_row_cap_bad_table_and_runaway_query(db, monkeypatch):
    t = SqlTools(db)
    assert "showing first 200" in t.run_query("SELECT * FROM order_items")
    with pytest.raises(ValueError):
        t.describe_table('orders"; DROP TABLE orders; --')
    monkeypatch.setattr("agents.sql_analyst.QUERY_TIMEOUT_S", 0.2)
    slow = "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c) SELECT COUNT(*) FROM c"
    with pytest.raises(ValueError):
        t.run_query(slow)


# ---------- pr_reviewer ----------
@pytest.fixture
def git_repo(tmp_path):
    def git(*a):
        subprocess.run(["git", "-C", str(tmp_path), *a], check=True, capture_output=True)

    git("init", "-q", "-b", "main")
    git("config", "user.email", "t@t")
    git("config", "user.name", "t")
    (tmp_path / "f.py").write_text("def f(x):\n    return x\n")
    git("add", ".")
    git("commit", "-qm", "base")
    git("checkout", "-qb", "feat")
    (tmp_path / "f.py").write_text("def f(x):\n    return x / 0\n")
    git("commit", "-qam", "break f")
    return tmp_path


def test_git_tools_and_ref_validation(git_repo):
    g = GitTools(git_repo, "main", "feat")
    assert "f.py" in g.changed_files() and "+    return x / 0" in g.file_diff("f.py")
    assert "break f" in g.commit_messages()
    for bad in ("--output=/tmp/x", "a;b", "$(x)"):
        with pytest.raises(ValueError):
            GitTools(git_repo, bad, "feat")
    with pytest.raises(ValueError):
        g.file_diff("--output=/tmp/pwned")


def test_review_end_to_end_with_structured_output(git_repo):
    result = {
        "summary": "Division by zero.",
        "verdict": "request_changes",
        "comments": [{"file": "f.py", "line": 2, "severity": "blocker", "body": "always raises"}],
    }
    fake = FakeClient(resp([call("a", "changed_files")], "tool_use"), resp([text(json.dumps(result))]))
    out = review(str(git_repo), "main", "feat", client=fake, **QUIET)
    assert out == result
    assert fake.requests[0]["output_config"]["format"]["type"] == "json_schema"
    names = {t["name"] for t in fake.requests[0]["tools"]}
    assert names == {"changed_files", "file_diff", "commit_messages", "list_dir", "read_file", "grep"}
    assert "`f.py:2`" in render(out)  # no tool can write, post, or merge
