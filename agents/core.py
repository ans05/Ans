"""Minimal agent loop shared by every agent in this package.

The model never executes anything: it emits `tool_use` blocks, this code runs the
matching Python function, and the results go back in the next user message.
Safety lives in the tools (path confinement, read-only SQL, no write tools at all),
not in the prompt.
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from typing import Any, Callable

import anthropic

MODEL = os.environ.get("AGENT_MODEL", "claude-opus-5-5")
EFFORT = os.environ.get("AGENT_EFFORT", "medium")  # low | medium | high | xhigh | max
USE_FALLBACKS = os.environ.get("AGENT_FALLBACKS", "1") != "0"
MAX_TOOL_OUTPUT = 20_000  # chars; keeps one huge file or diff from flooding the context


class AgentError(RuntimeError):
    pass


class AgentRefused(AgentError):
    """The model declined the request (stop_reason == 'refusal')."""


class AgentStepLimit(AgentError):
    """The agent used all its steps without producing a final answer."""


@dataclass
class Tool:
    name: str
    description: str  # tool descriptions are prompts: say when to use it and what comes back
    properties: dict[str, Any]
    required: list[str]
    fn: Callable[..., str]

    def spec(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": {
                "type": "object",
                "properties": self.properties,
                "required": self.required,
            },
        }


def clip(text: str, limit: int = MAX_TOOL_OUTPUT) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + f"\n... [truncated {len(text) - limit} chars; narrow the request]"


def echo_content(content: list[Any]) -> list[Any]:
    """Blocks to send back as the assistant turn.

    After a server-side refusal fallback, thinking/tool_use blocks that came before the
    final `fallback` block must be omitted; the `fallback` block itself stays in place.
    """
    boundary = max((i for i, b in enumerate(content) if b.type == "fallback"), default=-1)
    if boundary < 0:
        return content
    dropped = ("thinking", "redacted_thinking", "tool_use")
    return [b for i, b in enumerate(content) if i >= boundary or b.type not in dropped]


def _call(client: Any, use_fallbacks: bool, **kwargs: Any) -> Any:
    if use_fallbacks:
        return client.beta.messages.create(
            betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs
        )
    return client.messages.create(**kwargs)


def run_agent(
    *,
    system: str,
    task: str,
    tools: list[Tool],
    client: Any = None,
    max_steps: int = 25,
    max_tokens: int = 16000,
    output_schema: dict[str, Any] | None = None,
    use_fallbacks: bool | None = None,
    log: Callable[[str], None] | None = None,
) -> str:
    """Run the loop until the model answers without calling a tool. Returns the final text."""
    client = client or anthropic.Anthropic()
    use_fallbacks = USE_FALLBACKS if use_fallbacks is None else use_fallbacks
    log = log or (lambda line: print(line, file=sys.stderr))
    by_name = {t.name: t for t in tools}

    output_config: dict[str, Any] = {"effort": EFFORT}
    if output_schema:
        output_config["format"] = {"type": "json_schema", "schema": output_schema}

    messages: list[dict[str, Any]] = [{"role": "user", "content": task}]

    for step in range(1, max_steps + 1):
        response = _call(
            client,
            use_fallbacks,
            model=MODEL,
            max_tokens=max_tokens,
            system=system,
            tools=[t.spec() for t in tools],
            output_config=output_config,
            messages=messages,
        )

        if response.stop_reason == "refusal":
            category = getattr(getattr(response, "stop_details", None), "category", None)
            raise AgentRefused(f"model declined the request (category: {category})")
        if response.stop_reason == "max_tokens":
            raise AgentError("response hit max_tokens; raise max_tokens or narrow the task")

        content = echo_content(response.content)
        messages.append({"role": "assistant", "content": content})

        if response.stop_reason == "pause_turn":
            continue

        calls = [b for b in content if b.type == "tool_use"]
        if not calls:
            return "".join(b.text for b in content if b.type == "text").strip()

        results = []
        for call in calls:
            log(f"[step {step}] {call.name}({_short(call.input)})")
            tool = by_name.get(call.name)
            try:
                if tool is None:
                    raise ValueError(f"unknown tool {call.name!r}")
                out, is_error = clip(str(tool.fn(**call.input))), False
            except Exception as exc:  # tool errors go back to the model so it can recover
                out, is_error = f"Error: {exc}", True
            results.append(
                {"type": "tool_result", "tool_use_id": call.id, "content": out, "is_error": is_error}
            )
        # all results for a turn go back in ONE user message
        messages.append({"role": "user", "content": results})

    raise AgentStepLimit(f"no final answer after {max_steps} steps")


def cli(main: Callable[[], None]) -> None:
    """Run a CLI entry point, printing agent/API failures as one line instead of a traceback."""
    try:
        main()
    except (AgentError, anthropic.APIError) as exc:
        sys.exit(f"error: {exc}")
    except TypeError as exc:
        if "authentication method" in str(exc):  # the SDK only notices a missing key at request time
            sys.exit("error: no credentials: export ANTHROPIC_API_KEY or run `ant auth login`")
        raise


def _short(args: dict[str, Any], limit: int = 90) -> str:
    text = ", ".join(f"{k}={v!r}" for k, v in args.items())
    return text if len(text) <= limit else text[:limit] + "..."
