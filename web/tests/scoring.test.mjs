import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const S = require("../scoring.js");
const { DEFAULT_RESUME, EVIDENCE_BANK } = require("../../extension/resume-data.js");

const doc = (over = {}) => ({ profile: {}, education: { degree: "B.A. Data Science", coursework: "" }, experience: [], projects: [], skills: {}, ...over });
const one = (bullet, org = "Acme") => doc({ experience: [{ id: "x", org, role: "Intern", location: "", dates: "", bullets: [bullet] }] });
const cap = (id, d) => S.evaluateCapability(id, S.resumeUnits(d)).status;

// 1. A missing qualification cannot simultaneously appear as matched.
test("canonical result: counts derive from statuses; missing and matched are disjoint", () => {
  const r = S.evaluate([
    { statement: "Write product specifications", category: "responsibility", capabilities: ["product_specifications"] },
    { statement: "Conduct user research", category: "responsibility", capabilities: ["user_research"] },
  ], DEFAULT_RESUME);
  const ids = (arr) => arr.map((i) => i.capability);
  assert.deepEqual(ids(r.missing), ["product_specifications"]);
  assert.equal(r.items.filter((i) => i.status === "matched").length, r.counts.matched);
  assert.equal(r.counts.missing + r.counts.matched + r.counts.partially_matched, r.counts.scorable);
  assert.ok(!r.missing.some((m) => r.items.find((i) => i.capability === m.capability && i.status === "matched")));
  assert.ok(r.score < 100, "a missing item must pull the score below 100");
});

// 2. not_scorable requirements do not affect the score.
test("not_scorable items are excluded from the score and shown separately", () => {
  const base = [{ statement: "Conduct user research", category: "responsibility", capabilities: ["user_research"] }];
  const r1 = S.evaluate(base, DEFAULT_RESUME);
  const r2 = S.evaluate([...base,
    { statement: "Passionate about user experience and building products that delight users", category: "required_qualification", capabilities: [] },
    { statement: "Roblox does not sponsor work visas for internship positions.", category: "logistics", capabilities: [] },
    { statement: "Our mission is to connect a billion people with optimism and civility.", category: "company_language", capabilities: [] },
  ], DEFAULT_RESUME);
  assert.equal(r1.score, r2.score);
  assert.equal(r2.counts.not_scorable, 3);
  assert.equal(r2.notScorable[0].status, "not_scorable");
  assert.equal(r2.counts.scorable, r1.counts.scorable);
});

// 3. "Engineering" alone does not match cross-functional collaboration.
test("engineering alone is not cross-functional collaboration", () => {
  assert.equal(cap("cross_functional_collaboration", one("Built automated data engineering pipelines supporting 10,000+ predictions")), "missing");
  assert.equal(cap("cross_functional_collaboration", one("Developed engagement strategies with clinical, marketing, and product teams to improve access")), "matched");
  assert.equal(cap("cross_functional_collaboration", one("Partnered with the design team on onboarding")), "partially_matched");
});

// 4. "Roadmap" alone does not match product specifications.
test("roadmap alone is not a product specification", () => {
  assert.equal(cap("product_specifications", one("Built a prioritized 90-day activation roadmap for the business from research")), "missing");
  assert.equal(cap("product_specifications", one("Wrote product specifications and PRDs for two features")), "matched");
  assert.equal(cap("product_specifications", one("Gathered requirements from customers for the checkout flow")), "partially_matched");
});

// 5. "Launched" alone does not match stakeholder communication.
test("launched alone is not stakeholder communication", () => {
  assert.equal(cap("stakeholder_communication", one("Built and launched an iOS app from idea to launch for 100+ athletes")), "missing");
  assert.equal(cap("stakeholder_communication", one("Presented experimental results in slide decks to 2 faculty PIs")), "matched");
});

// 6. Compound requirements are scored per capability.
test("compound requirement splits into separately scored capabilities", () => {
  const r = S.evaluate([{ statement: "Write specifications, experimentation plans and go-to-market briefs", category: "responsibility", capabilities: ["product_specifications", "experimentation_plans", "gtm_briefs"] }], DEFAULT_RESUME);
  const by = Object.fromEntries(r.items.map((i) => [i.capability, i.status]));
  assert.equal(by.product_specifications, "missing");
  assert.equal(by.experimentation_plans, "matched");
  assert.equal(by.gtm_briefs, "partially_matched");
  assert.equal(r.items.length, 3);
});

// 9. Outreach notes cannot exceed 300 characters, keep the value proposition, and carry no banned asks.
test("outreach validation enforces limits and removes banned phrases", () => {
  const long = "Hi {{name}}, I'm a Berkeley Data Science student applying to the PM intern role. I founded GoalKeeper, an iOS app for 100+ athletes, and ran A/B tests that increased session duration 30%. I'd love to hop on a quick call for 15 minutes. Could you flag my application internally? I also worked on recommendation systems and pipelines and lots of other things that make this far too long for a connection note on LinkedIn.";
  const v = S.validateNote(long, { name: "Priya" });
  assert.ok(v.length <= 300, `length ${v.length}`);
  assert.ok(v.ok);
  assert.ok(!/\[name\]|\{\{name\}\}/i.test(v.text));
  assert.ok(/Priya/.test(v.text));
  assert.ok(!S.BANNED_OUTREACH.test(v.text));
  assert.ok(v.hasValueProp, "value proposition must survive shortening");
  const nameless = S.validateNote("Hi {{name}}, quick note about the PM role.", {});
  assert.ok(!/\{\{name\}\}|\[Name\]/.test(nameless.text));
  assert.ok(/^Hi — /.test(nameless.text));
});

// 11. Tailoring cannot introduce a fact absent from the evidence bank.
test("fact guard rejects unverified metrics, tools, and prohibited extrapolations", () => {
  const entry = EVIDENCE_BANK.entries.find((e) => e.id === "goalkeeper");
  const fact = entry.facts.find((f) => f.id === "gk.abtests");
  assert.ok(S.factGuard("Designed and analyzed A/B tests for an iOS app used by 100+ athletes, lifting session duration 30%", fact, entry).ok);
  const bad = S.factGuard("Designed 12 A/B tests in Python for 5,000+ athletes released on the App Store, lifting session duration 45%", fact, entry);
  assert.ok(!bad.ok);
  assert.ok(bad.problems.some((p) => /45%/.test(p)));
  assert.ok(bad.problems.some((p) => /5,000\+|5000/.test(p)));
  assert.ok(bad.problems.some((p) => /Python/i.test(p)));
  assert.ok(bad.problems.some((p) => /App Store/i.test(p)));
});

// 12. GoalKeeper ranks as high-priority evidence for a consumer-product PM role.
test("GoalKeeper ranks first for a consumer PM capability set", () => {
  const pmCaps = ["product_ownership", "user_research", "experimentation_plans", "product_decisions", "product_strategy_roadmap", "consumer_product", "product_launch", "product_analytics"];
  const ranked = S.rankEntries(DEFAULT_RESUME, pmCaps, "product");
  assert.equal(ranked[0].name, "Project GoalKeeper");
  assert.equal(S.detectRoleType("Product Manager Intern — Roblox\nSan Mateo"), "product");
  // Even with the full Roblox capability set (where Siemens has broad analysis evidence), PM weighting puts GoalKeeper first.
  const roblox = ["degree_related_field", "cross_functional_collaboration", "product_specifications", "experimentation_plans", "gtm_briefs", "user_research", "data_analysis", "market_research", "competitive_analysis", "senior_pm_partnership", "product_strategy_roadmap", "scale_millions", "stakeholder_communication", "written_communication", "consumer_product", "sql", "product_decisions"];
  assert.equal(S.rankEntries(DEFAULT_RESUME, roblox, "product")[0].name, "Project GoalKeeper");
  assert.ok(ranked[0].score >= 6, `score ${ranked[0].score}`);
});

// Bullet quality no longer requires a number.
test("a strong qualitative bullet passes without a metric; a weak one fails", () => {
  assert.ok(S.bulletQuality("Documented patient journeys across partner clinics to pinpoint the friction points blocking treatment adoption").pass);
  assert.ok(!S.bulletQuality("Responsible for various tasks").pass);
  assert.ok(!S.bulletQuality("Helped the team with data").pass);
});

// Subjective vs analytical classification.
test("classification separates subjective traits from analytical requirements", () => {
  assert.equal(S.classify({ statement: "Passionate about user experience and building products that delight users", category: "required_qualification" }), "subjective_trait");
  assert.equal(S.classify({ statement: "Strong analytical skills and a curiosity about user behavior", category: "required_qualification", capabilities: ["data_analysis"] }), "required_qualification");
  assert.equal(S.classify({ statement: "Candidates must be authorized to work in the United States", category: "required_qualification" }), "logistics");
});

// Degree matches from Education, not from bullets.
test("degree requirement is evidenced by the Education section", () => {
  const r = S.evaluate([{ statement: "Pursuing degree in computer science, engineering, or related field", category: "required_qualification", capabilities: ["degree_related_field"] }], DEFAULT_RESUME);
  assert.equal(r.items[0].status, "matched");
  assert.match(r.items[0].where, /Education/);
  const noDegree = S.evaluate([{ statement: "Pursuing degree in engineering", category: "required_qualification", capabilities: ["degree_related_field"] }], one("Built data engineering pipelines"));
  assert.equal(noDegree.items[0].status, "matched", "Data Science degree in fixture counts");
  const artDoc = doc({ education: { degree: "B.A. Art History", coursework: "" }, experience: [{ org: "x", bullets: ["Built data engineering pipelines"] }] });
  assert.equal(S.evaluate([{ statement: "Pursuing degree in engineering", category: "required_qualification", capabilities: ["degree_related_field"] }], artDoc).items[0].status, "missing");
});

// Scale expectations are not satisfied by any launch.
test("millions-of-users scale is not fully matched by a 100+ user launch", () => {
  assert.equal(cap("scale_millions", DEFAULT_RESUME), "partially_matched"); // 10,000+ predictions
  assert.equal(cap("scale_millions", one("Built and shipped an iOS app used by 100+ athletes")), "missing");
  assert.equal(cap("scale_millions", one("Shipped a feature used by 2M users")), "matched");
});
