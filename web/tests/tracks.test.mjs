// Role classification, track-specific ordering, semantic dedupe, verified skills,
// unsupported-skill handling, marketing-language exclusion, non-inflated scoring,
// quality control and verdicts.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const S = require("../scoring.js");
const { DEFAULT_RESUME, EVIDENCE_BANK } = require("../../extension/resume-data.js");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const jd = (f) => fs.readFileSync(path.join(ROOT, "jobs", f), "utf8");

const FIXTURES = {
  ds: { file: "figma.txt", track: "ds_ml", first: "flourish" },
  pm: { file: "roblox.txt", track: "product_management", first: "siemens" },
  pa: { file: "product_analytics.txt", track: "product_analytics", first: "flourish" },
  marketing: { file: "marketing_heavy.txt", track: "product_management", first: "siemens" },
  unsupported: { file: "unsupported_skill.txt", track: "ds_ml", first: "flourish" },
};

test("classifies each posting into the expected track", () => {
  for (const [k, f] of Object.entries(FIXTURES)) {
    const c = S.classifyTrack(jd(f.file));
    assert.equal(c.track, f.track, `${k}: got ${c.track} ${JSON.stringify(c.scores)}`);
  }
  assert.equal(S.classifyTrack("AI Product Manager Intern\nYou will ship LLM-powered features and evaluate model quality with prompts and evals.").track, "ai_product");
  assert.equal(S.classifyTrack("Product Strategy & Growth Intern\nDrive market research, competitive analysis, and go-to-market for a new expansion market.").track, "product_strategy");
});

test("experience order follows the track order and never alters titles or dates", () => {
  const expected = {
    ds_ml: ["flourish", "haas", "mercor", "siemens"],
    product_analytics: ["flourish", "haas", "siemens", "mercor"],
    product_management: ["siemens", "flourish", "haas", "mercor"],
    ai_product: ["flourish", "mercor", "siemens", "haas"],
    product_strategy: ["siemens", "flourish", "haas", "mercor"],
  };
  for (const [track, order] of Object.entries(expected)) {
    const o = S.orderForTrack(DEFAULT_RESUME, track);
    assert.deepEqual(o.experience.map((e) => e.id), order, track);
    for (const e of o.experience) { const b = EVIDENCE_BANK.entries.find((x) => x.id === e.id); assert.equal(e.role, b.role); assert.equal(e.dates, b.dates); }
  }
  // GoalKeeper is second in the PM and analytics orders, so Projects follows Experience; it would lead only if ranked first.
  assert.deepEqual(S.orderForTrack(DEFAULT_RESUME, "product_management").sectionOrder, ["experience", "projects"]);
});

test("two GoalKeeper bullets centred on the 30% result are detected and deduped", () => {
  const gk = EVIDENCE_BANK.entries.find((e) => e.id === "goalkeeper");
  // The old duplicate ("Defined engagement metrics … 30%") was removed from the bank; the dedupe rule still guards against it.
  const legacy = "Defined engagement metrics and used them to prioritize features, growing average session duration 30%";
  const entry = { org: gk.org, bullets: [gk.facts[0].text, legacy, gk.facts[1].text], factIds: ["gk.abtests", null, "gk.launch"] };
  const dups = S.duplicateBullets(entry, EVIDENCE_BANK);
  assert.equal(dups.length, 1);
  assert.match(dups[0].reason, /same headline metric/);
  assert.deepEqual(S.dedupeSelection(entry, EVIDENCE_BANK).entry.factIds, ["gk.abtests", "gk.launch"]);
  assert.ok(!gk.facts.some((f) => f.id === "gk.metrics") && gk.facts.some((f) => f.id === "gk.feedback"));
  assert.match(S.selectSkills(EVIDENCE_BANK, "product_strategy", "").skills[0].vals, /^product strategy, market research, competitive analysis/);
});

test("skills come only from the verified bank, ordered for the track; posting-only tools are reported", () => {
  const ds = S.selectSkills(EVIDENCE_BANK, "ds_ml", jd("unsupported_skill.txt"));
  const flat = ds.skills.map((s) => s.vals).join(", ");
  assert.match(flat, /^Python, SQL, R/);
  // Tableau is now a verified skill, so a posting that asks for it is backed, not reported as unsupported.
  assert.ok(/tableau/i.test(flat), flat);
  assert.ok(!/spark|airflow|bigquery/i.test(flat), flat);
  assert.deepEqual(ds.unsupported.sort(), ["airflow", "pyspark", "spark"].sort());
  const pm = S.selectSkills(EVIDENCE_BANK, "product_management", jd("roblox.txt"));
  assert.match(pm.skills.map((s) => s.vals).join(", "), /product strategy/);
});

test("unsupported skills are missing with a confirmation verdict and are not inflated away", () => {
  const items = [
    { statement: "Proficiency in Python and SQL", category: "required_qualification", capabilities: ["python", "sql"] },
    { statement: "Experience with Apache Spark or PySpark", category: "required_qualification", capabilities: [], keywords: ["Spark", "PySpark"] },
    { statement: "Experience building dashboards in Tableau", category: "required_qualification", capabilities: ["dashboards"] },
    { statement: "Strong statistics foundation: regression, hypothesis testing, experimentation", category: "required_qualification", capabilities: ["statistics"] },
    { statement: "Experience with causal inference methods", category: "preferred_qualification", capabilities: ["causal_inference"] },
  ];
  const r = S.evaluate(items, DEFAULT_RESUME, { track: "ds_ml", bank: EVIDENCE_BANK, jd: jd("unsupported_skill.txt") });
  const by = Object.fromEntries(r.items.map((i) => [i.capability || i.statement, i]));
  assert.equal(by["Experience with Apache Spark or PySpark"].status, "missing");
  assert.equal(by["Experience with Apache Spark or PySpark"].verdict, "Needs candidate confirmation");
  // Dashboards is now a full match: the Haas Power BI forecasting bullet names "dashboards" directly,
  // not just a Skills-only listing (unlike Tableau, which is still listed with no backing bullet).
  assert.equal(by.dashboards.status, "matched", "Power BI dashboards now has a real bullet, not just a Skills listing");
  assert.equal(by.dashboards.confidence, "high");
  assert.ok(r.readiness < 85, `readiness ${r.readiness} should reflect the missing required tool`);
  assert.ok(r.ats < 100);
});

test("company marketing language, eligibility and traits are never scored", () => {
  const items = [
    { statement: "Millions of companies use Stripe to accept payments and grow their revenue", category: "company_language", capabilities: [] },
    { statement: "Our mission is to increase the GDP of the internet", category: "required_qualification", capabilities: [] },
    { statement: "We are a fast-growing, mission-driven team of curious builders", category: "required_qualification", capabilities: [] },
    { statement: "Stripe does not sponsor visas for this internship", category: "required_qualification", capabilities: [] },
    { statement: "Experience analyzing data with SQL", category: "required_qualification", capabilities: ["sql"] },
  ];
  const r = S.evaluate(items, DEFAULT_RESUME, { track: "product_management", bank: EVIDENCE_BANK });
  assert.equal(r.counts.scorable, 1);
  assert.equal(r.counts.not_scorable, 4);
  assert.equal(r.items.find((i) => i.capability === "sql").status, "matched");
});

test("keyword presence alone does not produce 100: duplicates, copying and weak matches are penalised", () => {
  const items = [{ statement: "Design and analyze A/B tests", category: "required_qualification", capabilities: ["experimentation_plans"] }];
  // The base pool deliberately holds overlapping facts; compare a deduped page against one with the two 30% bullets.
  const gk = DEFAULT_RESUME.projects[0];
  const dedupedExp = DEFAULT_RESUME.experience.map((e) => ({ ...e, bullets: e.bullets.slice(0, 1), factIds: e.factIds.slice(0, 1) }));
  const cleanDoc = { ...DEFAULT_RESUME, experience: dedupedExp, projects: [{ ...gk, bullets: [gk.bullets[0], gk.bullets[1]], factIds: ["gk.abtests", "gk.launch"] }] };
  const clean = S.evaluate(items, cleanDoc, { track: "product_analytics", bank: EVIDENCE_BANK });
  assert.equal(clean.duplicates.length, 0);
  const dupDoc = { ...DEFAULT_RESUME, experience: dedupedExp, projects: [{ ...gk, bullets: [gk.bullets[0], "Defined engagement metrics and used them to prioritize features, growing average session duration 30%"], factIds: ["gk.abtests", null] }] };
  const dup = S.evaluate(items, dupDoc, { track: "product_analytics", bank: EVIDENCE_BANK });
  assert.ok(dup.readiness < clean.readiness, `duplicate should lower readiness (${dup.readiness} vs ${clean.readiness})`);
  assert.equal(dup.duplicates.length, 1);
  const copiedDoc = { ...DEFAULT_RESUME, experience: [{ ...DEFAULT_RESUME.experience[0], bullets: ["Design and analyze A/B tests and develop metrics that help teams understand the impact of product changes"] }] };
  const copied = S.evaluate(items, copiedDoc, { track: "product_analytics", bank: EVIDENCE_BANK, jd: "You will design and analyze A/B tests and develop metrics that help teams understand the impact of product changes." });
  assert.ok(copied.bullets.some((b) => b.copied));
  assert.ok(copied.components.clarity.value < 1);
  const unsupported = S.evaluate(items, DEFAULT_RESUME, { track: "product_analytics", bank: EVIDENCE_BANK, unsupportedClaims: 1 });
  assert.ok(unsupported.readiness <= 60, "unsupported claims cap readiness at 60");
});

test("quality control blocks altered titles, altered dates, unsupported claims and overflow; warns on the rest", () => {
  const ok = S.qualityControl(DEFAULT_RESUME, { bank: EVIDENCE_BANK, pdf: { overflow: false, pages: 1, clipped: [] } });
  assert.equal(ok.blocked, false);
  const title = { ...DEFAULT_RESUME, experience: DEFAULT_RESUME.experience.map((e, i) => (i === 0 ? { ...e, role: "Product Manager" } : e)) };
  assert.ok(S.qualityControl(title, { bank: EVIDENCE_BANK }).issues.some((i) => i.severity === "block" && /title/.test(i.message)));
  const dates = { ...DEFAULT_RESUME, experience: DEFAULT_RESUME.experience.map((e, i) => (i === 0 ? { ...e, dates: "Jan 2025 – May 2026" } : e)) };
  assert.ok(S.qualityControl(dates, { bank: EVIDENCE_BANK }).issues.some((i) => i.severity === "block" && /dates/.test(i.message)));
  const claim = { ...DEFAULT_RESUME, projects: [{ ...DEFAULT_RESUME.projects[0], bullets: ["Designed 40 A/B tests for 50,000 athletes"], factIds: ["gk.abtests"] }] };
  const qc = S.qualityControl(claim, { bank: EVIDENCE_BANK });
  assert.ok(qc.blocked && qc.issues.some((i) => /not verified/.test(i.message)));
  assert.ok(S.qualityControl(DEFAULT_RESUME, { bank: EVIDENCE_BANK, pdf: { overflow: true, pages: 2 } }).blocked);
  const manual = { ...DEFAULT_RESUME, experience: DEFAULT_RESUME.experience.map((e, i) => (i === 0 ? { ...e, bullets: [...e.bullets, "Helped with various things"], factIds: [...e.factIds, null] } : e)) };
  const m = S.qualityControl(manual, { bank: EVIDENCE_BANK });
  assert.equal(m.blocked, false);
  assert.ok(m.issues.some((i) => /typed by hand/.test(i.message)) && m.issues.some((i) => /weak phrasing/.test(i.message)));
});

test("verdict: blocked → Not ready; missing required → Ready with caveats; otherwise Ready", () => {
  const items = [{ statement: "Experience with SQL", category: "required_qualification", capabilities: ["sql"] }, { statement: "Experience with Tableau", category: "required_qualification", capabilities: ["dashboards"] }];
  const r = S.evaluate(items, DEFAULT_RESUME, { track: "product_analytics", bank: EVIDENCE_BANK });
  assert.equal(S.applicationVerdict(r, { blocked: true, warnings: 0 }).verdict, "Not ready");
  const r2 = S.evaluate([{ statement: "Experience with SQL", category: "required_qualification", capabilities: ["sql"] }, { statement: "Experience with Excel and Looker", category: "required_qualification", capabilities: [], keywords: ["Looker"] }], DEFAULT_RESUME, { track: "product_analytics", bank: EVIDENCE_BANK });
  assert.equal(S.applicationVerdict(r2, { blocked: false, warnings: 0 }).verdict, "Ready with caveats");
  const r3 = S.evaluate([{ statement: "Experience with SQL", category: "required_qualification", capabilities: ["sql"] }, { statement: "Experience with A/B testing", category: "required_qualification", capabilities: ["experimentation_plans"] }], DEFAULT_RESUME, { track: "product_analytics", bank: EVIDENCE_BANK });
  assert.equal(S.applicationVerdict(r3, { blocked: false, warnings: 0 }).verdict, "Ready", JSON.stringify(r3.components));
  assert.ok(S.suggestedQuestions(r2, EVIDENCE_BANK).some((q) => /Looker|Excel/i.test(q)));
});

test("equivalences require meaningful evidence and are labelled equivalent, not direct", () => {
  const one = (b) => ({ profile: {}, education: { degree: "B.A. Data Science", coursework: "" }, experience: [{ id: "x", org: "Acme", role: "Intern", location: "", dates: "", bullets: [b] }], projects: [], skills: {} });
  const ev = (cap, b) => S.evaluate([{ statement: cap, category: "required_qualification", capabilities: [cap] }], one(b), { bank: EVIDENCE_BANK }).items[0];
  assert.equal(ev("experimentation", "Designed and analyzed A/B tests for an iOS app used by 100+ athletes").status, "matched");
  assert.equal(ev("statistics", "Fit regression models to 1,000+ participant responses in R").status, "matched");
  assert.equal(ev("product_development", "Built and shipped an iOS app from idea to launch").status ?? "missing", "missing", "unknown capability id never matches fully");
  assert.equal(ev("stakeholder_communication", "Presented results in slide decks to 2 faculty PIs").status, "matched");
  assert.equal(ev("user_research", "Documented patient journeys across 8+ organizations to pinpoint friction").status, "matched");
  const weak = ev("user_research", "Worked with data from users");
  assert.notEqual(weak.status, "matched");
  const generic = ev("cross_functional_collaboration", "Product engineering data");
  assert.equal(generic.status, "missing");
});
