// End-to-end: full Roblox workflow in headless Chromium with a simulated
// claude.ai runtime (extraction + tailoring replies are fixtures shaped like
// real model output). Verifies live rescoring, cache invalidation, PDF
// export, and outreach limits. Run: node --test web/tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
const OUT = path.join(ROOT, "web/tests/out");
fs.mkdirSync(OUT, { recursive: true });

let chromium;
try { ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs")); } catch { ({ chromium } = await import("playwright")); }

const ROBLOX = fs.readFileSync(path.join(ROOT, "jobs/roblox.txt"), "utf8");

const EXTRACT = { items: [
  { statement: "Build product features that millions of users interact with", category: "responsibility", capabilities: ["scale_millions"], keywords: ["millions of users"] },
  { statement: "sharing progress and learnings with stakeholders", category: "responsibility", capabilities: ["stakeholder_communication"], keywords: ["stakeholders"] },
  { statement: "Conduct user research, gather feedback", category: "responsibility", capabilities: ["user_research"], keywords: ["user research"] },
  { statement: "analyze data to identify creator community needs", category: "responsibility", capabilities: ["data_analysis"], keywords: ["data analysis"] },
  { statement: "Support market research", category: "responsibility", capabilities: ["market_research"], keywords: ["market research"] },
  { statement: "competitive analysis to inform product decisions", category: "responsibility", capabilities: ["competitive_analysis", "product_decisions"], keywords: ["competitive analysis"] },
  { statement: "Partner with senior product managers", category: "responsibility", capabilities: ["senior_pm_partnership"], keywords: ["product managers"] },
  { statement: "define product strategy and roadmaps", category: "responsibility", capabilities: ["product_strategy_roadmap"], keywords: ["roadmap"] },
  { statement: "Write specifications", category: "responsibility", capabilities: ["product_specifications"], keywords: ["specifications"] },
  { statement: "experimentation plans", category: "responsibility", capabilities: ["experimentation_plans"], keywords: ["experimentation"] },
  { statement: "go-to-market briefs", category: "responsibility", capabilities: ["gtm_briefs"], keywords: ["go-to-market"] },
  { statement: "Collaborate with cross-functional teams of engineers, designers, and data scientists", category: "responsibility", capabilities: ["cross_functional_collaboration"], keywords: ["cross-functional"] },
  { statement: "Pursuing degree in computer science, engineering, information systems, business, mathematics or related field", category: "required_qualification", capabilities: ["degree_related_field"], keywords: ["degree"] },
  { statement: "Strong analytical skills and a curiosity about user behavior", category: "required_qualification", capabilities: ["data_analysis", "user_research"], keywords: ["analytical"] },
  { statement: "Excellent written and verbal communication skills", category: "required_qualification", capabilities: ["written_communication"], keywords: ["communication"] },
  { statement: "Passionate about user experience and building products that delight users", category: "subjective_trait", capabilities: [], keywords: ["user experience"] },
  { statement: "Prior internship or project experience shipping a consumer product", category: "preferred_qualification", capabilities: ["consumer_product"], keywords: ["consumer product"] },
  { statement: "Experience with SQL or data analysis tools", category: "preferred_qualification", capabilities: ["sql"], keywords: ["SQL"] },
  { statement: "Roblox does not sponsor work visas for internship positions. Candidates must be authorized to work in the United States.", category: "logistics", capabilities: [], keywords: [] },
  { statement: "Our mission is to connect a billion people with optimism and civility.", category: "company_language", capabilities: [], keywords: [] },
] };

// A realistic tailoring reply: selects facts by id, one deliberately invented number (guard must catch it).
const TAILOR = {
  experience: [
    { id: "siemens", bullets: [{ factId: "siemens.roadmap", text: "Built a prioritized 90-day activation roadmap for a theranostics business from customer-journey and adoption-barrier research across 8+ organizations" }, { factId: "siemens.competitive", text: "Mapped competitive positioning and patient advocacy networks across 8+ organizations to surface growth opportunities" }, { factId: "siemens.crossfn", text: "Developed data-informed engagement strategies with clinical, marketing, and product teams" }] },
    { id: "haas", bullets: [{ factId: "haas.hypotheses", text: "Turned open-ended behavioral questions into testable hypotheses and analyzed 1,000+ participant responses in R using regression" }, { factId: "haas.comms", text: "Presented experimental results in reports and slide decks to 2 faculty PIs and interdisciplinary teams" }, { factId: "haas.coding", text: "Coded 481 open-ended responses into a structured codebook" }] },
    { id: "flourish", bullets: [{ factId: "flourish.recsys", text: "Built and deployed a personalized recommendation platform in Python and SQL, increasing user engagement by 25%" }, { factId: "flourish.feedback", text: "Folded feedback from 10+ SkyDeck seminars into agile sprints to keep prototypes aligned with user needs" }] },
    { id: "mercor", bullets: [{ factId: "mercor.eval", text: "Scored 500+ LLM responses against structured quality metrics to isolate recurring failure patterns" }, { factId: "mercor.process", text: "Redesigned the evaluation workflow for 500+ responses after a performance analysis" }] },
  ],
  projects: [
    { id: "goalkeeper", bullets: [
      { factId: "gk.ownership", text: "Owned the full development cycle — user research, roadmap, build, launch, and iteration — as founder of a 100+ user product" },
      { factId: "gk.abtests", text: "Designed and analyzed 12 A/B tests for an iOS app used by 100+ athletes, increasing average session duration by 30%" },
      { factId: "gk.nami", text: "Led product strategy and a partnership with NAMI, driving adoption to 100+ athletes and iterating on community feedback" },
    ] },
  ],
  skills: { "Product & Analytics": "product roadmapping, user research, competitive analysis, A/B testing, product analytics, Figma", Languages: "Python, SQL, R, Swift" },
  omittedBecauseUnsupported: ["written product specifications", "go-to-market briefs"],
};

const OUTREACH = { targets: [
  { audience: "recruiter", role: "University Recruiter", why: "Owns the intern pipeline.", linkedinQuery: "Roblox university recruiter", note: "Hi {{name}}, I'm a Berkeley Data Science student and just applied to the PM intern role. I founded GoalKeeper, an iOS app for 100+ athletes, and ran A/B tests that lifted session duration 30%. Would love to connect — and if you have 15 minutes I'd love a quick call, or if you could flag my application internally that would be amazing. Thanks so much for your time and consideration!", followUp: "Thanks for connecting. Could you flag my application internally? Happy to share more." },
  { audience: "pm", role: "Product Manager, Creator Experience", why: "Likely team.", linkedinQuery: "Roblox product manager creator", note: "Hi {{name}}, I'm applying to the Roblox PM intern role. I built and iterated GoalKeeper for 100+ athletes and used experiments to grow session duration 30%. Curious how your team decides what to test next.", followUp: "Thanks for connecting! One question: what does a strong intern project look like on your team? No pressure if you're busy." },
  { audience: "alum", role: "Berkeley alum at Roblox", why: "Shared background.", linkedinQuery: "Roblox Berkeley", note: "Hi {{name}}, fellow Berkeley student here (Data Science, '27). I'm applying to the PM intern role — I founded GoalKeeper and led product strategy and user research for 100+ athletes. Would love to connect.", followUp: "Thanks for connecting. How did you find the path from Berkeley to Roblox? Any advice welcome; totally fine if you're slammed." },
] };

async function launch() {
  const b = await chromium.launch({ channel: "chromium", headless: true });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await p.addInitScript(({ EXTRACT, TAILOR, OUTREACH }) => {
    window.__calls = [];
    const sample = async () => ({});
    sample.json = async (prompt) => {
      await new Promise((r) => setTimeout(r, 20));
      if (prompt.startsWith("Extract every distinct statement")) { window.__calls.push("extract"); return EXTRACT; }
      if (prompt.startsWith("You are tailoring")) { window.__calls.push("tailor"); return TAILOR; }
      if (prompt.startsWith("Write LinkedIn outreach")) { window.__calls.push("outreach"); return OUTREACH; }
      window.__calls.push("unknown"); return {};
    };
    sample.limits = async () => ({});
    const downloads = { save: async ({ filename, data }) => { const buf = await data.arrayBuffer(); window.__saved = { filename, bytes: Array.from(new Uint8Array(buf)) }; return { status: "saved" }; } };
    const permissions = { state: async () => "granted", request: async () => ({ downloads: "granted" }) };
    window.claude = { use: async (n) => ({ sample, downloads, permissions })[n] || null };
  }, { EXTRACT, TAILOR, OUTREACH });
  await p.goto("file://" + path.join(ROOT, "web/index.html"));
  await p.waitForTimeout(600);
  return { b, p, errors };
}

test("Roblox workflow: tailor → score → edit → PDF → outreach", async () => {
  const { b, p, errors } = await launch();
  try {
    await p.fill("#company", "Roblox");
    await p.fill("#jd", ROBLOX);
    await p.click("#tailor");
    try { await p.waitForFunction(() => document.querySelector(".tab.active")?.dataset.tab === "score", null, { timeout: 15000 }); }
    catch (e) { throw new Error(`tailor did not finish. status="${await p.textContent("#status")}" scoreStatus="${await p.textContent("#score-status")}" calls=${JSON.stringify(await p.evaluate(() => window.__calls))} errors=${JSON.stringify(errors)}`); }
    await p.waitForTimeout(300);
    const calls = await p.evaluate(() => window.__calls);
    assert.deepEqual(calls, ["extract", "tailor"], "one extraction + one tailoring call");

    // Fact guard: the invented "12 A/B tests" must be replaced by the verified fact text.
    const bullets = await p.locator("#paper .bl .txt").allTextContents();
    assert.ok(!bullets.some((t) => /12 A\/B tests/.test(t)), "invented count must not appear");
    assert.ok(bullets.some((t) => /Designed and analyzed A\/B tests for an iOS app used by 100\+ athletes/.test(t)));
    assert.ok(!bullets.some((t) => /^[A-Za-z &/-]{1,40}:\s/.test(t)), "no label prefixes");
    // Skill not in bank ("Figma") is dropped.
    const skillText = await p.locator('[data-path^="skills."][data-path$=".vals"]').allTextContents();
    assert.ok(!skillText.join(" ").includes("Figma"));

    // PM track: Siemens → FlourishAI → Haas → Mercor, Projects after Experience (GoalKeeper is ranked second).
    assert.match(await p.textContent("#track-detected"), /Product Management/);
    assert.deepEqual(await p.locator('[data-path$=".org"]').allTextContents(), ["Siemens Healthineers", "FlourishAI (Berkeley SkyDeck)", "Haas School of Business Lab", "Mercor"]);
    assert.equal(await p.locator("#paper .r-sec").nth(1).textContent(), "Experience");
    assert.ok(!(await p.locator("#projects-first").isChecked()));
    // Two 30% GoalKeeper bullets can't both survive; the fixture selected abtests only, so exactly one 30% bullet.
    assert.equal(bullets.filter((t) => /30%/.test(t)).length, 1);

    // 6/7: canonical score, no contradictions, not 100.
    const score = Number((await p.locator(".score-big").first().textContent()).replace(/\/100.*/, ""));
    const ats = Number((await p.locator(".score-big").nth(1).textContent()).replace(/\/100.*/, ""));
    const card = await p.textContent(".score-verdict");
    const m = /(\d+) matched · (\d+) partial · (\d+) missing of (\d+) scorable; (\d+) not scored/.exec(card);
    assert.ok(m, card);
    const [, matched, partial, missing, scorable, notScorable] = m.map(Number);
    assert.equal(matched + partial + missing, scorable);
    assert.ok(missing >= 1, "specifications must be missing");
    assert.ok(score < 100, `score ${score} must not be 100 with missing items`);
    assert.equal(notScorable, 3);
    const missingLabels = await p.locator("ul.checks li.miss .req > span:first-child").allTextContents();
    assert.ok(missingLabels.some((t) => /specifications/i.test(t)));
    const matchedLabels = await p.locator("ul.checks li.ok .req > span:first-child").allTextContents();
    assert.ok(!matchedLabels.some((t) => /specifications/i.test(t)), "specifications cannot be both missing and matched");
    assert.equal(await p.locator("ul.checks li.na").count(), 3, "subjective + visa + mission shown as not scored");
    assert.ok(ats < 100 && ats > 0);
    assert.match(await p.textContent("#verdict"), /Ready with caveats|Ready|Not ready/);
    fs.writeFileSync(path.join(OUT, "roblox_score.txt"), `readiness=${score} ats=${ats}\n${card}\n${(await p.locator("ul.checks li").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim()).join("\n")}`);

    // 7. Editing the résumé immediately recomputes the score (no model call).
    const before = score;
    const specBullet = p.locator('[data-path="projects.0.bullets.0"]');
    await specBullet.click(); await p.keyboard.press("End"); await p.keyboard.type(" and wrote product specifications for each release");
    await p.waitForTimeout(150);
    const after = Number((await p.locator(".score-big").first().textContent()).replace(/\/100.*/, ""));
    assert.ok(after > before, `score should rise after adding spec evidence (${before} → ${after})`);
    assert.deepEqual(await p.evaluate(() => window.__calls), ["extract", "tailor"], "no model call on edit");

    // Export gating: an invented number in a fact-backed bullet blocks export; reverting unblocks it.
    const gkBullet = p.locator('[data-path="projects.0.bullets.1"]');
    const original = await gkBullet.textContent();
    await gkBullet.click(); await p.keyboard.press("End"); await p.keyboard.type(" across 5,000 athletes");
    await p.waitForTimeout(500);
    assert.ok(await p.locator("#download").isDisabled(), "download must be disabled while an unsupported claim is present");
    assert.match(await p.textContent("#checks"), /not verified/);
    assert.equal(await p.textContent("#verdict"), "Not ready");
    await gkBullet.click(); await p.keyboard.press("Control+A"); await p.keyboard.type(original);
    await p.waitForTimeout(500);
    assert.ok(!(await p.locator("#download").isDisabled()), "download re-enabled after reverting");

    // 10. PDF export: one page, extractable text, words intact.
    await p.click("#download");
    await p.waitForFunction(() => !!window.__saved, null, { timeout: 5000 });
    const saved = await p.evaluate(() => window.__saved);
    const pdfPath = path.join(OUT, saved.filename);
    fs.writeFileSync(pdfPath, Buffer.from(saved.bytes));
    const words = await p.evaluate(() => { const d = state.doc; return [d.profile.name, d.education.school, d.education.degree, d.education.coursework, ...d.experience.flatMap((e) => [e.org, e.role, e.location, ...e.bullets]), ...d.projects.flatMap((x) => [x.name, x.tech, ...x.bullets]), ...d.skills.flatMap((s) => [s.cat, s.vals])].join("\n"); });
    fs.writeFileSync(path.join(OUT, "expected_words.txt"), words);
    let report, raw = "";
    try { raw = execFileSync("python3", [path.join(ROOT, "web/validate_pdf.py"), pdfPath, "--expect-words", path.join(OUT, "expected_words.txt"), "--png", path.join(OUT, "roblox_page1.png")], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
    catch (e) { raw = e.stdout || ""; }
    report = JSON.parse(raw.slice(raw.indexOf("{")));
    fs.writeFileSync(path.join(OUT, "pdf_report.json"), JSON.stringify(report, null, 2));
    assert.equal(report.pages, 1, "one page");
    assert.ok(report.checks.words_intact, `lost words: ${JSON.stringify(report.lost_words)}`);
    assert.ok(report.checks.no_spaced_letters);
    assert.ok(report.checks.links_present, `links: ${JSON.stringify(report.links)}`);
    assert.ok(report.checks.reading_order);

    // 9. Outreach: every note ≤ 300, banned asks removed, placeholder handled.
    await p.click('[data-tab="outreach"]');
    await p.click("#outreach");
    await p.waitForSelector(".target");
    const counters = await p.locator(".counter").allTextContents();
    for (const c of counters) { const n = Number(c.split("/")[0]); assert.ok(n <= 300, c); }
    const notes = await p.locator(".target").evaluateAll((cards) => cards.map((c) => c.querySelector(".msg").textContent));
    for (const n of notes) {
      assert.ok(!/flag|15[- ]?minute|quick call/i.test(n), n);
      assert.ok(!/\{\{name\}\}|\[Name\]/.test(n), n);
    }
    assert.ok(notes.some((n) => /GoalKeeper/.test(n)), "GoalKeeper value prop survives shortening");
    await p.fill('.name-in[data-i="0"]', "Priya");
    assert.match(await p.locator('.target[data-i="0"] .msg').first().textContent(), /^Hi Priya,/);
    const copyDisabled = await p.locator('.target[data-i="0"] .msg .copy').first().isDisabled();
    assert.equal(copyDisabled, false);

    // 8. Editing the job description invalidates cached extraction.
    await p.click('[data-tab="job"]');
    await p.fill("#jd", ROBLOX + "\nAlso: experience with Figma.");
    await p.waitForTimeout(100);
    assert.equal(await p.locator(".score-big").count(), 0, "score cleared when JD changes");
    await p.click('[data-tab="score"]'); await p.click("#rate");
    await p.waitForSelector(".score-big");
    assert.deepEqual(await p.evaluate(() => window.__calls), ["extract", "tailor", "outreach", "extract"], "JD change forces re-extraction");

    // Track override re-orders the page without a model call.
    await p.click('[data-tab="job"]');
    await p.selectOption("#track-select", "ds_ml");
    await p.waitForTimeout(200);
    assert.deepEqual(await p.locator('[data-path$=".org"]').allTextContents(), ["FlourishAI (Berkeley SkyDeck)", "Haas School of Business Lab", "Mercor", "Siemens Healthineers"]);
    await p.selectOption("#track-select", "");
    // Chronological mode.
    await p.uncheck("#relevance-order"); await p.waitForTimeout(200);
    assert.deepEqual(await p.locator('[data-path$=".org"]').allTextContents(), ["Haas School of Business Lab", "Siemens Healthineers", "FlourishAI (Berkeley SkyDeck)", "Mercor"]);
    await p.check("#relevance-order");

    assert.deepEqual(errors, [], "no console/page errors");
  } finally { await b.close(); }
});

const FIGMA = fs.readFileSync(path.join(ROOT, "jobs/figma.txt"), "utf8");
const EXTRACT_FIGMA = { items: [
  { statement: "Experience using SQL and a scripting language such as Python or R to clean, explore, and analyze data", category: "required_qualification", capabilities: ["sql", "python", "data_analysis"], keywords: ["SQL", "Python", "R"] },
  { statement: "A solid foundation in statistics and quantitative reasoning, with exposure to experimentation, forecasting, statistical modeling, causal inference", category: "required_qualification", capabilities: ["statistics", "experimentation", "forecasting", "causal_inference"], keywords: ["statistics"] },
  { statement: "The ability to structure open-ended questions, validate your analysis, and connect findings to product or business decisions", category: "required_qualification", capabilities: ["data_analysis", "product_decisions"], keywords: ["open-ended questions"] },
  { statement: "Curiosity, initiative, and strong communication and collaboration skills", category: "subjective_trait", capabilities: [], keywords: [] },
  { statement: "Design and evaluate experiments and develop metrics that help teams understand the impact of product changes", category: "responsibility", capabilities: ["experimentation_plans", "product_analytics"], keywords: ["experiments"] },
  { statement: "Build and improve data pipelines and tools that make product data more scalable and accessible", category: "responsibility", capabilities: ["data_engineering"], keywords: ["data pipelines"] },
  { statement: "Build models to understand user behavior and predict growth", category: "responsibility", capabilities: ["ml_evaluation", "forecasting"], keywords: ["models"] },
  { statement: "Figma's platform helps teams bring ideas to life", category: "company_language", capabilities: [], keywords: [] },
] };
const TAILOR_FIGMA = {
  experience: [
    { id: "flourish", bullets: [{ factId: "flourish.etl", text: "Engineered a Python and SQL ETL pipeline to ingest, clean, and validate data from 100+ research sources" }, { factId: "flourish.pipelines", text: "Built automated data pipelines supporting 10,000+ recommendation predictions, making product data reproducible and scalable" }, { factId: "flourish.eval", text: "Benchmarked recommendations against expert-labeled references and translated error analysis into product changes that improved accuracy by 15% and engagement by 25%" }] },
    { id: "haas", bullets: [{ factId: "haas.hypotheses", text: "Structured open-ended behavioral research questions into testable hypotheses and analyzed 1,000+ participant responses in R using regression" }, { factId: "haas.regression", text: "Fit regression models to 1,000+ participant responses in R, producing behavioral insights that shaped follow-on study design" }, { factId: "haas.coding", text: "Coded 481 open-ended participant responses into a structured codebook" }] },
    { id: "mercor", bullets: [{ factId: "mercor.eval", text: "Evaluated 500+ LLM responses against correctness and instruction-following criteria, isolating recurring failure patterns" }, { factId: "mercor.process", text: "Redesigned the evaluation workflow for 500+ LLM responses, improving throughput by approximately 15%" }] },
    { id: "siemens", bullets: [{ factId: "siemens.roadmap", text: "Built a prioritized 90-day activation roadmap from customer-journey and adoption-barrier research across 8+ organizations" }, { factId: "siemens.crossfn", text: "Developed data-informed patient engagement strategies with clinical, marketing, and product teams" }] },
  ],
  projects: [{ id: "goalkeeper", bullets: [{ factId: "gk.abtests", text: "Designed and analyzed A/B tests for an iOS app used by 100+ athletes, translating results into feature decisions that increased average session duration by 30%" }, { factId: "gk.feedback", text: "Gathered feedback from 100+ athletes and translated behavioral insights into product requirements and prioritized feature improvements" }] }],
  skills: {},
  omittedBecauseUnsupported: ["forecasting", "causal inference"],
};

test("Figma data-science workflow: DS track ordering, dedupe of the duplicate 30% bullet, honest missing items", async () => {
  const b = await chromium.launch({ channel: "chromium", headless: true });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = []; p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(({ EXTRACT_FIGMA, TAILOR_FIGMA }) => {
    const sample = async () => ({});
    sample.json = async (prompt) => { await new Promise((r) => setTimeout(r, 20)); if (prompt.startsWith("Extract every distinct statement")) return EXTRACT_FIGMA; if (prompt.startsWith("You are tailoring")) return TAILOR_FIGMA; return {}; };
    sample.limits = async () => ({});
    window.claude = { use: async (n) => ({ sample, downloads: { save: async () => ({ status: "saved" }) }, permissions: { state: async () => "granted", request: async () => ({ downloads: "granted" }) } })[n] || null };
  }, { EXTRACT_FIGMA, TAILOR_FIGMA });
  try {
    await p.goto("file://" + path.join(ROOT, "web/index.html")); await p.waitForTimeout(600);
    await p.fill("#company", "Figma"); await p.fill("#jd", FIGMA);
    assert.match(await p.textContent("#track-detected"), /Data Science/);
    await p.click("#tailor");
    await p.waitForFunction(() => document.querySelector(".tab.active")?.dataset.tab === "score", null, { timeout: 15000 });
    await p.waitForTimeout(300);
    assert.deepEqual(await p.locator('[data-path$=".org"]').allTextContents(), ["FlourishAI (Berkeley SkyDeck)", "Haas School of Business Lab", "Mercor", "Siemens Healthineers"]);
    const gkBullets = await p.locator('[data-path^="projects.0.bullets."]').allTextContents();
    assert.equal(gkBullets.filter((t) => /30%/.test(t)).length, 1, "only one 30% bullet");
    const skills = await p.locator('[data-path^="skills."][data-path$=".vals"]').allTextContents();
    assert.match(skills[0], /^Python, SQL, R/);
    const missing = await p.locator("ul.checks li.miss .req > span:first-child").allTextContents();
    assert.ok(missing.some((t) => /Forecasting/.test(t)), `forecasting must be missing: ${missing.join(" | ")}`);
    const partial = await p.locator("ul.checks li.part .req > span:first-child").allTextContents();
    assert.ok(partial.some((t) => /Causal/.test(t)), `randomized A/B tests give causal inference partial credit only: ${partial.join(" | ")}`);
    const verdicts = await p.locator("ul.checks li.miss .ev").allTextContents();
    assert.ok(verdicts.some((t) => /Needs candidate confirmation/.test(t)), verdicts.join(" | "));
    assert.match(await p.textContent("#verdict"), /Ready/);
    const readiness = Number((await p.locator(".score-big").first().textContent()).replace(/\/100.*/, ""));
    assert.ok(readiness < 100 && readiness > 40, `readiness ${readiness}`);
    fs.writeFileSync(path.join(OUT, "figma_score.txt"), `readiness=${readiness}\n${await p.textContent(".score-verdict")}\n${(await p.locator("ul.checks li").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim()).join("\n")}`);
    assert.deepEqual(errors, []);
  } finally { await b.close(); }
});
