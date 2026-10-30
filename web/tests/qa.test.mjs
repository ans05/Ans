// End-to-end: the questions step inside Tailor. Answers become facts in the candidate's own
// evidence bank, drafted bullets can never contain a number or tool the answer lacks, "I don't
// have this" is remembered, and sentences that are values/eligibility copy are never asked.
// Run: node --test web/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");

let chromium;
try { ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs")); } catch { ({ chromium } = await import("playwright")); }

const JD = fs.readFileSync(path.join(ROOT, "jobs/roblox.txt"), "utf8");

// Three real gaps (nothing in the bank evidences them), two sentences that are values / audience
// copy and must never become questions, and one requirement the bank already satisfies.
const EXTRACT = { items: [
  { statement: "Experience with SQL or data analysis tools", category: "required_qualification", capabilities: ["sql"], keywords: ["SQL"] },
  { statement: "Build internal tools", category: "responsibility", capabilities: [], keywords: ["internal tools"] },
  { statement: "Build integrations", category: "responsibility", capabilities: [], keywords: ["integrations"] },
  { statement: "Build mobile apps in Kotlin", category: "preferred_qualification", capabilities: [], keywords: ["Kotlin"] },
  { statement: "your job isn't done when the tool works; it's done when someone else can own it.", category: "required_qualification", capabilities: [], keywords: [] },
  { statement: "best suited to people who don't yet have several years of experience.", category: "required_qualification", capabilities: [], keywords: [] },
] };
const TAILOR = { experience: [], projects: [], skills: {}, omittedBecauseUnsupported: [] };
// The "model" drafts a faithful bullet for answer 1 and an INVENTED one (a number and a tool the answer never mentions) for answer 2.
const DRAFTS = { drafts: [
  { n: 1, entryId: "mercor", text: "Built an internal dashboard used by 20 analysts to track LLM review queues", skip: false },
  { n: 2, entryId: "mercor", text: "Built 5 integrations with Slack and Jira that cut review time", skip: false },
] };
const ANSWER_1 = "At Mercor I built an internal dashboard that 20 analysts used to track LLM review queues.";
const ANSWER_2 = "I connected our review tool to Slack.";

async function launch() {
  const b = await chromium.launch({ channel: "chromium", headless: true });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(({ EXTRACT, TAILOR, DRAFTS }) => {
    window.__calls = []; window.__prompts = {};
    const sample = async () => ({});
    sample.json = async (prompt) => {
      await new Promise((r) => setTimeout(r, 20));
      const kind = prompt.startsWith("Extract every distinct statement") ? "extract" : prompt.startsWith("Turn the candidate's own answers") ? "draft" : prompt.startsWith("You are tailoring") ? "tailor" : "unknown";
      window.__calls.push(kind); window.__prompts[kind] = prompt;
      return { extract: EXTRACT, draft: DRAFTS, tailor: TAILOR }[kind] || {};
    };
    sample.limits = async () => ({});
    window.claude = { use: async (n) => ({ sample, downloads: { save: async () => ({ status: "saved" }) }, permissions: { state: async () => "granted", request: async () => ({ downloads: "granted" }) } })[n] || null };
  }, { EXTRACT, TAILOR, DRAFTS });
  await p.goto("file://" + path.join(ROOT, "web/index.html"));
  await p.waitForTimeout(500);
  return { b, p, errors };
}
const startTailor = async (p) => { await p.fill("#company", "Acme"); await p.fill("#jd", JD); await p.click("#tailor"); await p.waitForSelector("#qa[open]", { timeout: 15000 }); };
const onScoreTab = (p) => p.waitForFunction(() => document.querySelector(".tab.active")?.dataset.tab === "score", null, { timeout: 15000 });

test("answers are drafted, verified against the answer, saved as facts, and used by the same tailoring", async () => {
  const { b, p, errors } = await launch();
  try {
    await startTailor(p);
    assert.match(await p.textContent("#qa-title"), /^3 quick questions before tailoring$/);
    const dialog = await p.textContent("#qa-body");
    assert.ok(!/someone else can own it|several years of experience/.test(dialog), "values/audience sentences must not be asked");
    assert.ok(/Build internal tools/.test(dialog) && /Build integrations/.test(dialog) && /Kotlin/.test(dialog));

    await p.locator(".qa-a").nth(0).fill(ANSWER_1);
    await p.locator(".qa-a").nth(1).fill(ANSWER_2);
    await p.locator(".qa-no").nth(2).check();
    assert.ok(await p.locator(".qa-a").nth(2).isDisabled(), "a declined question's answer box is disabled");
    assert.match(await p.textContent("#qa-primary"), /Draft 2 bullets/);
    await p.click("#qa-primary");
    await p.waitForFunction(() => document.getElementById("qa-title").textContent.startsWith("Review"), null, { timeout: 5000 });

    // Faithful draft is kept; the invented one is rejected and the candidate's own wording is shown instead.
    assert.equal(await p.locator(".qa-draft").nth(0).inputValue(), "Built an internal dashboard used by 20 analysts to track LLM review queues");
    assert.equal(await p.locator(".qa-draft").nth(1).inputValue(), ANSWER_2);
    assert.match(await p.locator(".qa-warn").first().textContent(), /couldn't verify my draft.*number “5” is not in your answer.*tool “Jira” is not in your answer/);
    assert.equal(await p.locator(".qa-entry").nth(0).inputValue(), "mercor");

    // Nothing can be added until each bullet has a home; the candidate's edit is what gets saved.
    await p.locator(".qa-entry").nth(1).selectOption("");
    assert.ok(await p.locator("#qa-primary").isDisabled());
    await p.locator(".qa-entry").nth(1).selectOption("mercor");
    await p.locator(".qa-draft").nth(1).fill("Connected an internal review tool to Slack");
    await p.click("#qa-primary");
    await onScoreTab(p);

    assert.deepEqual(await p.evaluate(() => window.__calls), ["extract", "draft", "tailor"]);
    const overlay = await p.evaluate(() => JSON.parse(localStorage.getItem("rt:answers")));
    assert.equal(overlay.facts.length, 2);
    assert.deepEqual(overlay.facts[0].fact.metrics, ["20"]);
    assert.deepEqual(overlay.facts[0].fact.tools, ["LLM"]);
    assert.deepEqual(overlay.facts[1].fact.metrics, [], "the rejected number never reaches the fact");
    assert.deepEqual(overlay.facts[1].fact.tools, [], "the rejected tool never reaches the fact");
    assert.deepEqual(overlay.declined.map((d) => d.label), ["Build mobile apps in Kotlin"]);

    // The same tailoring call already sees the new facts and is told what not to imply.
    const prompt = await p.evaluate(() => window.__prompts.tailor);
    assert.ok(prompt.includes("Built an internal dashboard used by 20 analysts") && prompt.includes("Connected an internal review tool to Slack"));
    assert.match(prompt, /confirmed they do NOT have: Build mobile apps in Kotlin/);
    assert.equal(await p.evaluate(() => state.bank.entries.find((e) => e.id === "mercor").facts.length), 5 + 2);

    // Answered and declined questions are never asked again — not on a reload, not for a different posting.
    // The save is debounced; reload only once the tailored state has actually been written.
    await p.waitForFunction(() => { const r = JSON.parse(localStorage.getItem("rt:lastResult") || "null"); return !!(r && r.doc && r.reqs && r.reqs.qaDone); }, null, { timeout: 10000 });
    await p.reload(); await p.waitForTimeout(500);
    assert.equal(await p.evaluate(() => state.bank.entries.find((e) => e.id === "mercor").facts.length), 5 + 2, "answers survive a reload");
    await p.click('[data-tab="job"]'); await p.click("#tailor"); await onScoreTab(p);
    assert.deepEqual(await p.evaluate(() => window.__calls), ["tailor"], "same posting: no questions, no re-extraction");
    await p.click('[data-tab="job"]'); await p.fill("#jd", JD + "\nAlso: you will build internal tools and integrations.");
    await p.click("#tailor"); await onScoreTab(p);
    assert.deepEqual(await p.evaluate(() => window.__calls), ["tailor", "extract", "tailor"], "a new posting re-extracts but finds nothing left to ask");
    assert.deepEqual(errors, []);
  } finally { await b.close(); }
});

test("skipping tailors untouched, and the questions stay answerable from the score tab", async () => {
  const { b, p, errors } = await launch();
  try {
    await startTailor(p);
    await p.click("#qa-skip");
    await onScoreTab(p);
    assert.deepEqual(await p.evaluate(() => window.__calls), ["extract", "tailor"]);
    assert.equal(await p.evaluate(() => localStorage.getItem("rt:answers")), null, "skipping saves nothing");
    assert.equal(await p.locator("ol.sugg li").count(), 3);

    await p.click("#answer-now");
    await p.waitForSelector("#qa[open]");
    assert.equal(await p.textContent("#qa-title"), "3 quick questions");
    assert.equal(await p.textContent("#qa-skip"), "Not now");
    await p.locator(".qa-no").nth(0).check();
    await p.click("#qa-primary");
    await p.waitForFunction(() => !document.getElementById("qa").open, null, { timeout: 5000 });
    await p.waitForFunction(() => document.querySelectorAll("ol.sugg li").length === 2, null, { timeout: 5000 }); // a declined question disappears from the list
    assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem("rt:answers")).declined.length), 1);
    assert.deepEqual(await p.evaluate(() => window.__calls), ["extract", "tailor"], "no tailoring is triggered from the score tab");
    assert.deepEqual(errors, []);
  } finally { await b.close(); }
});

test("cancelling the dialog stops the tailoring instead of silently continuing", async () => {
  const { b, p } = await launch();
  try {
    await startTailor(p);
    await p.click("#qa-cancel");
    await p.waitForFunction(() => !document.getElementById("qa").open);
    await p.waitForTimeout(300);
    assert.match(await p.textContent("#status"), /Cancelled/);
    assert.deepEqual(await p.evaluate(() => window.__calls), ["extract"], "tailoring never ran");
  } finally { await b.close(); }
});
