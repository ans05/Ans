# agents/

Three small tool-using agents (Python) on one shared loop, `core.py` (~100 lines).
Each agent file is just its tools plus a system prompt.

```bash
pip install -r agents/requirements.txt
export ANTHROPIC_API_KEY=...        # or: ant auth login
```

| Agent | Run | Tools | Why it's safe |
|---|---|---|---|
| Codebase Q&A | `python -m agents.codebase_qa "where is X handled?" --root .` | `list_dir`, `read_file`, `grep` | Confined to `--root` (symlink escapes blocked); `.env`, keys and `*.db` are denied |
| SQL analyst | `python -m agents.sql_analyst --make-sample data/sample.db`<br>`python -m agents.sql_analyst data/sample.db "top category by revenue?"` | `list_tables`, `describe_table`, `run_query` | DB opened `mode=ro` **and** every query runs under a SQLite authorizer that allows only SELECT; 5 s timeout, 200-row cap |
| PR reviewer | `python -m agents.pr_reviewer [--base main --head HEAD] [--json]` | `changed_files`, `file_diff`, `commit_messages` + the read-only code tools | Has no write, post, approve or merge tool; git refs validated; diff treated as untrusted data |

## How the loop works

`run_agent` sends the task and tool specs, executes any `tool_use` blocks the model returns,
sends all results back in one user message, and repeats until the model answers without a
tool call. It stops with an error on a refusal, `max_tokens`, or 25 steps. Tool errors are
returned to the model (`is_error`) so it can fix its own SQL or path.

## Config (env vars)

- `AGENT_MODEL` (default `claude-opus-5-5`; try `claude-sonnet-5-5` for cheaper runs)
- `AGENT_EFFORT` (`low`|`medium`|`high`|`xhigh`|`max`, default `medium`)
- `AGENT_FALLBACKS=0` turns off server-side refusal fallback (on by default)

## Tests

```bash
python -m pytest agents/tests -q
```

Offline: a scripted fake client replaces the API, so the tests cover the loop and every tool's
guardrails (path escape, SQL writes, ref injection) but not model quality.
