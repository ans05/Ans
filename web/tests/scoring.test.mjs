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
  // Since the bank gained "translated behavioral insights into product requirements", specifications is partial, not missing.
  assert.equal(r.items.find((i) => i.capability === "product_specifications").status, "partially_matched");
  assert.deepEqual(r.missing, []);
  assert.equal(r.items.filter((i) => i.status === "matched").length, r.counts.matched);
  assert.equal(r.counts.missing + r.counts.matched + r.counts.partially_matched, r.counts.scorable);
  assert.ok(!r.missing.some((m) => r.items.find((i) => i.capability === m.capability && i.status === "matched")));
  assert.ok(r.score < 100, "a partial item must pull the score below 100");
  const r2 = S.evaluate([{ statement: "Write go-to-market briefs", category: "responsibility", capabilities: ["gtm_briefs"] }, { statement: "Fluent in Mandarin", category: "required_qualification", capabilities: [], keywords: ["Mandarin"] }], DEFAULT_RESUME);
  assert.deepEqual(r2.missing.map((i) => i.statement), ["Fluent in Mandarin"]);
  assert.ok(!r2.items.some((i) => i.statement === "Fluent in Mandarin" && i.status === "matched"));
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
  assert.equal(by.product_specifications, "partially_matched", "requirements work without a written spec");
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
  assert.equal(S.detectRoleType("Product Manager Intern — Roblox\nSan Mateo"), "product_management");
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

// A bank-wide prohibited list applies to every entry, not just the one it's declared on.
test("bank-wide prohibited items block a claim under ANY entry, and don't affect unrelated entries", () => {
  assert.deepEqual(EVIDENCE_BANK.prohibited, ["Microsoft PowerPoint", "Microsoft Word", "Jira"]);
  const entry = EVIDENCE_BANK.entries.find((e) => e.id === "haas");
  const fact = entry.facts.find((f) => f.id === "haas.comms");
  const bad = S.factGuard("Presented experimental results in Microsoft PowerPoint decks to 2 faculty PIs", fact, entry, EVIDENCE_BANK);
  assert.equal(bad.ok, false);
  assert.ok(bad.problems.some((p) => /Microsoft PowerPoint/.test(p)));
  // Without the bank argument (old call shape), the bank-wide list is simply not checked — no crash.
  assert.ok(S.factGuard(fact.text, fact, entry).ok);
  // Skills selection never lists a bank-wide-prohibited name even if verifiedSkills somehow contained one.
  const withBanned = { ...EVIDENCE_BANK, verifiedSkills: [...EVIDENCE_BANK.verifiedSkills, { name: "Microsoft Word", evidence: "listed" }] };
  const sk = S.selectSkills(withBanned, "ds_ml", "");
  assert.ok(!sk.skills.some((s) => /\bWord\b/.test(s.vals)));
});

// A "graduate program" requirement is a knowable fact from Education, distinct from field-of-study —
// wrong reading was lumping "enrolled in a graduate program" and "graduation date" into one vague miss.
test("graduate-enrollment requirement reads Education directly and is never a vague guess", () => {
  const r = S.evaluate([{ statement: "Currently enrolled in a full-time graduate degree program", category: "required_qualification", capabilities: ["graduate_enrollment"] }], DEFAULT_RESUME, { bank: EVIDENCE_BANK });
  const item = r.items[0];
  assert.equal(item.status, "missing");
  assert.equal(item.evidenceType, "direct");
  assert.match(item.evidence, /B\.A\./);
  assert.equal(item.verdict, "Not evidenced — do not add");
  assert.doesNotMatch(item.why, /outside the evidence vocabulary/);
  // A graduate-level résumé matches directly.
  const gradDoc = { ...DEFAULT_RESUME, education: { ...DEFAULT_RESUME.education, degree: "M.S. Data Science" } };
  const g = S.evaluate([{ statement: "Currently enrolled in a graduate degree program", category: "required_qualification", capabilities: ["graduate_enrollment"] }], gradDoc, { bank: EVIDENCE_BANK });
  assert.equal(g.items[0].status, "matched");
});

// "Bachelor's or greater/higher" eligibility language is distinct from a graduate-only requirement:
// an enrolled undergrad already satisfies it. Mixing the two up would wrongly mark it missing.
test("'bachelor's or higher' eligibility is matched by an in-progress bachelor's degree, unlike a graduate-only requirement", () => {
  const r = S.evaluate([{ statement: "Currently enrolled in a bachelor's or greater degree program", category: "required_qualification", capabilities: ["degree_bachelor_or_higher"] }], DEFAULT_RESUME, { bank: EVIDENCE_BANK });
  const item = r.items[0];
  assert.equal(item.status, "matched");
  assert.equal(item.evidenceType, "direct");
  assert.match(item.evidence, /B\.A\./);
});

// Skill grouping is derived from the skill's own name, not a hand-typed label, so it works the
// same way for any résumé — including one built by the import flow with no curated groups at all.
test("classifySkillGroup buckets by name alone, with no reliance on a stored group field", () => {
  assert.equal(S.classifySkillGroup("Python"), "Languages");
  assert.equal(S.classifySkillGroup("C++"), "Languages");
  assert.equal(S.classifySkillGroup("C#"), "Languages");
  assert.equal(S.classifySkillGroup("R"), "Languages");
  assert.equal(S.classifySkillGroup("Go-to-market strategy"), "Product & Strategy"); // bare "go" must not false-match Languages
  assert.equal(S.classifySkillGroup("Power BI"), "Tools & Platforms");
  assert.equal(S.classifySkillGroup("Docker"), "Tools & Platforms");
  assert.equal(S.classifySkillGroup("A/B testing"), "Analytics & Experimentation");
  assert.equal(S.classifySkillGroup("ETL pipelines"), "Data & ML");
  assert.equal(S.classifySkillGroup("user research"), "Product & Strategy");
  assert.equal(S.classifySkillGroup("Interpretive dance"), "Other");
});

// regroupSkills is what makes an imported résumé's arbitrary category names (or commas inside a
// parenthetical like a certification) come out the same way the candidate's own bank does.
test("regroupSkills ignores stored category labels and doesn't split on commas inside parentheses", () => {
  const messy = {
    Languages: "Java, Python, C/C++, SQL (Postgres), JavaScript, HTML/CSS",
    "Developer Tools": "Git, Microsoft Azure (AZ-900, AI-900 Certified), Google Cloud Platform",
  };
  const out = S.regroupSkills(messy);
  const flat = Object.fromEntries(out.map((g) => [g.cat, g.vals]));
  assert.match(flat["Languages"], /\bC\/C\+\+/);
  assert.match(flat["Languages"], /\bHTML\/CSS\b/);
  assert.match(flat["Tools & Platforms"], /Microsoft Azure \(AZ-900, AI-900 Certified\)/, "parenthetical certification must survive as one entry");
  assert.ok(!flat["Languages"].includes("AI-900"), "the cert note must not bleed into Languages");
});

// The old PM-track skills path used a separate hardcoded template (Product/Technical/Data & AI)
// disconnected from the general classifier; it's gone now, so every track shares one pipeline.
test("selectSkills groups product-track skills with the same classifier as technical tracks", () => {
  const pm = S.selectSkills(EVIDENCE_BANK, "product_management", "");
  const byCat = Object.fromEntries(pm.skills.map((g) => [g.cat, g.vals]));
  assert.ok(byCat["Product & Strategy"], "product skills must be grouped under Product & Strategy");
  assert.ok(!["Product", "Technical", "Data & AI"].some((c) => c in byCat), "the old PRODUCT_SKILL_TEMPLATE category names must not appear");
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

// Values / audience copy and course prerequisites are not résumé requirements, so they must never
// reach the candidate as "have you ___?" questions — while real gaps still do.
test("narrative, audience and prerequisite sentences are not scored; real requirements still are", () => {
  const notScored = [
    "your job isn't done when the tool works; it's done when someone else can own it.",
    "your job isn’t done when the tool works; it’s done when someone else can own it.",
    "make sure your work survives you.",
    "cut the part of the demo that isn't landing.",
    "finishing or have just finished a degree or trade program and looking for your first full-time role.",
    "transitioning out of military service into your first civilian career.",
    "in your first full-time job and looking to move into mission-driven work.",
    "best suited to people who don’t yet have several years of experience.",
    "can say what you learned from time in or around nonprofits, public service, or civic tech.",
    "completion of AI Fluency and Claude 101, with proof of completion submitted with the application.",
  ];
  for (const statement of notScored) assert.ok(["logistics", "company_language"].includes(S.classify({ statement, category: "required_qualification", capabilities: [] })), statement);
  for (const statement of ["Build internal tools", "have hands-on time with agent frameworks", "Experience transitioning from legacy systems to the cloud"]) {
    assert.equal(S.classify({ statement, category: "required_qualification", capabilities: [] }), "required_qualification", statement);
  }
});

test("questions are real gaps in the whole bank, minus anything already answered or declined", () => {
  const base = require("../../extension/resume-data.js").resumeFromBank(EVIDENCE_BANK);
  const items = [
    { statement: "Build internal tools", category: "responsibility", capabilities: [], keywords: ["internal tools"] },
    { statement: "Conduct user research", category: "responsibility", capabilities: ["user_research"] }, // the bank already evidences this
    { statement: "Build mobile apps in Kotlin", category: "preferred_qualification", capabilities: [], keywords: ["Kotlin"] },
  ];
  const ask = (bank) => S.suggestedQuestionItems(S.evaluate(items, base, { bank }), bank);
  assert.deepEqual(ask(EVIDENCE_BANK).map((q) => q.label), ["Build internal tools", "Build mobile apps in Kotlin"]);
  const after = S.applyAnswers(EVIDENCE_BANK, { declined: [{ key: "stmt:build mobile apps in kotlin", label: "Build mobile apps in Kotlin" }], answered: ["stmt:build internal tools"] });
  assert.deepEqual(ask(after), []);
  // A declined item is a settled "no" in the scoring, not a standing "needs confirmation".
  const declinedItem = S.evaluate(items, base, { bank: after }).items.find((i) => /Kotlin/.test(i.statement));
  assert.equal(declinedItem.verdict, "Not evidenced — do not add");
  assert.match(declinedItem.why, /you confirmed you don't have this/);
});

test("applyAnswers merges facts and resolutions without mutating the bank, and is idempotent", () => {
  const before = JSON.stringify(EVIDENCE_BANK);
  const fact = { id: "ans.mercor.x1", text: "Built an internal dashboard used by 20 analysts", metrics: ["20"], tools: [], tags: [] };
  const overlay = { facts: [{ entryId: "mercor", fact }, { entryId: "gone", fact: { ...fact, id: "ans.gone.1" } }], resolved: [{ entryId: "siemens", question: "q" }] };
  const a = S.applyAnswers(EVIDENCE_BANK, overlay);
  assert.equal(JSON.stringify(EVIDENCE_BANK), before, "input bank untouched");
  const mercor = (b) => b.entries.find((e) => e.id === "mercor");
  assert.equal(mercor(a).facts.length, mercor(EVIDENCE_BANK).facts.length + 1);
  assert.equal(JSON.stringify(S.applyAnswers(a, overlay)), JSON.stringify(a), "re-applying changes nothing");
  assert.ok(!a.entries.some((e) => e.facts.some((f) => f.id === "ans.gone.1")), "a fact for an entry that no longer exists is ignored");
  assert.equal(S.applyAnswers(EVIDENCE_BANK, null), EVIDENCE_BANK);
  const withQuestion = { ...EVIDENCE_BANK, entries: EVIDENCE_BANK.entries.map((e) => (e.id === "siemens" ? { ...e, needsConfirmation: ["q", "keep"] } : e)) };
  assert.deepEqual(S.applyAnswers(withQuestion, overlay).entries.find((e) => e.id === "siemens").needsConfirmation, ["keep"]);
});

test("a drafted bullet may only contain numbers and tools the candidate's answer contains", () => {
  const answer = "I built an internal dashboard that 20 analysts used to track LLM review queues.";
  assert.equal(S.validateDraft("Built an internal dashboard used by 20 analysts to track LLM review queues", answer).ok, true);
  assert.equal(S.validateDraft("Built an internal dashboard used by 20+ analysts", answer).ok, true, "a trailing + is the same number");
  const bad = S.validateDraft("Built 5 dashboards in Tableau used by 200 analysts", answer);
  assert.equal(bad.ok, false);
  assert.ok(bad.problems.some((p) => /number “5”/.test(p)) && bad.problems.some((p) => /number “200”/.test(p)) && bad.problems.some((p) => /tool “Tableau”/.test(p)));
  assert.equal(S.validateDraft("", answer).ok, false);
  assert.equal(S.validateDraft("x".repeat(230), answer).ok, false);
  assert.deepEqual(S.statedTerms("Built a dashboard in Python for 20+ analysts"), { metrics: ["20+"], tools: ["Python"] });
  assert.ok(S.inferTags("Designed and analyzed A/B tests for an iOS app used by 100+ athletes").includes("experimentation"));
});

// Built-in facts should read like a person wrote them: concrete verbs and plain nouns. These are the
// phrases that made earlier wording read as machine-written; this keeps the bank from drifting back.
test("built-in facts avoid the stock phrases that make a bullet read as AI-written", () => {
  const stock = /translat(ed|ing) |high-signal|actionable|leverag(e|ed|ing)|robust|seamless|scalable|reproducible|pinpoint|surfacing|spearhead|\u2014/i;
  for (const e of EVIDENCE_BANK.entries) for (const f of e.facts) assert.doesNotMatch(f.text, stock, `${f.id}: ${f.text}`);
});

// Claims the candidate confirmed as accurate as written on their résumé must exist as facts, so the
// fact guard accepts them instead of replacing them with different wording.
test("confirmed résumé claims are backed by facts and pass the fact guard", () => {
  const confirmed = [
    ["haas", "Designed behavioral research studies to better understand leadership, consumer decision-making, and organizational behavior"],
    ["flourish", "Built and deployed a personalized nutrition recommendation platform using Python and SQL, increasing user engagement by 25%"],
    ["flourish", "Developed an automated data pipeline processing 100+ research sources, improving recommendation accuracy by 15%"],
  ];
  for (const [id, text] of confirmed) {
    const e = EVIDENCE_BANK.entries.find((x) => x.id === id);
    const fact = e.facts.find((f) => f.text === text);
    assert.ok(fact, `no fact carries: ${text}`);
    assert.equal(S.factGuard(text, fact, e, EVIDENCE_BANK).ok, true, text);
  }
});
