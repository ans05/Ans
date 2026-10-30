// Evidence-based scoring. Pure functions, no DOM. Works in the browser
// (globals) and in Node (module.exports) so the same code is unit-tested.
//
// One canonical result from evaluate() drives every number and section the
// UI shows. Statuses: matched | partially_matched | missing | not_scorable.

const SCORING_VERSION = "4.1";

// Weights (percent). Buckets with no scorable items redistribute their weight
// proportionally to the buckets that do have items.
const STATUS_VALUE = { matched: 1, partially_matched: 0.5, missing: 0 };

// ── Requirement categories ──────────────────────────────────────────────
// Only the first three are scored. The rest are shown separately.
const CATEGORIES = ["required_qualification", "preferred_qualification", "responsibility", "company_language", "logistics", "subjective_trait"];
const SCORED = new Set(["required_qualification", "preferred_qualification", "responsibility"]);

const SUBJECTIVE = /\b(passion(ate)?|enthusias|curious|curiosity|excited|love (of|for)|self-starter|team player|positive attitude|fun|delight|humble|hungry|scrappy|growth mindset)\b/i;
const LOGISTICS = /\b(visa|sponsor|work authoriz|authorized to work|eligib|located in|relocat|on-site|onsite|hybrid|remote|hours per week|start date|duration|stipend|hourly|salary|\$\d|background check|must be (18|able)|proof of completion|submit(ted)? with (the|your) application|certificate of completion)\b/i;
const COMPANY = /\b(our mission|we are|we're|our team|join us|we believe|every day|billion people|tens of millions of people come)\b/i;
// Describes who the posting is aimed at, not something a résumé can demonstrate.
const AUDIENCE = /\b(best suited (to|for)|transitioning (out of|from) (the )?(military|service|active duty)|first (full-time|civilian) (job|role|career)|looking (for|to move into) your first|finishing or (have )?just finished|don['’]t yet have (several )?years)\b/i;
// Philosophy / culture copy written in the second person ("your job isn't done when…").
const NARRATIVE = /\b(isn['’]t done when|is not done when|survives you|what you(['’]ve)? learned|isn['’]t landing|your (job|work) (isn['’]t|is not|doesn['’]t)|we (believe|think) (that )?you)\b/i;
const DEGREE = /\b(degree|bachelor|b\.?[as]\.?|pursuing|enrolled|graduat|undergraduate|master|phd)\b/i;

// ── Capability vocabulary ───────────────────────────────────────────────
// Each capability has evidence rules. `full` rules need an action AND an
// object in the same résumé statement (or a section condition); `partial`
// rules are weaker signals that earn half credit. Generic nouns alone never
// match: "engineering" is not collaboration, "roadmap" is not a spec,
// "launched" is not stakeholder communication.
const VERB = {
  collab: /\b(collaborat\w*|partner\w*|work(ed|ing)? (with|across|alongside)|develop\w* .{0,80}\bwith\b|aligned? (with|across)|coordinat\w*|co-design\w*|together with)\b/i,
  write: /\b(wrote|writ\w*|authored|drafted|owned|defined|documented|produced|created|prepared)\b/i,
  design: /\b(designed|planned|ran|led|executed|analy[sz]ed|built|set up|structured|conducted|co-designed)\b/i,
  research: /\b(conducted|ran|led|gathered|collected|synthesi[sz]ed|documented|mapped|distilled|interviewed|surveyed|analy[sz]ed|examined|folded|integrated|incorporated|iterat\w*)\b/i,
  present: /\b(presented|reported|communicated|shared|briefed|delivered|summari[sz]ed|updated)\b/i,
  build: /\b(built|shipped|launched|deployed|developed|engineered|released|owned|delivered)\b/i,
  strategy: /\b(built|led|owned|defined|developed|prioriti[sz]ed|shaped|set|drove|created)\b/i,
  analyze: /\b(analy[sz]ed|fit|ran|modeled|queried|evaluated|scored|benchmarked|measured|coded|structured|examined)\b/i,
};
const FUNCTIONS = /\b(clinical|marketing|product|engineer\w*|design\w*|data scien\w*|sales|research\w*|faculty|interdisciplinary|legal|finance|operations|ops|customer success|support|ux)\b/gi;

const CAPABILITIES = {
  degree_related_field: {
    label: "Degree in a related field",
    section: "education",
    fields: /\b(data science|computer science|engineering|information systems|business|mathematics|statistics|economics|cognitive science|hci|human.computer interaction)\b/i,
  },
  graduate_enrollment: {
    label: "Currently enrolled in a graduate degree program",
    hint: "only for postings that require graduate standing — not for 'bachelor's or greater/higher' language, which an enrolled undergrad already satisfies (use degree_bachelor_or_higher instead)",
    degreeLevel: true,
    graduateWords: /\b(m\.?s\.?|m\.?a\.?|mba|m\.?eng\.?|ph\.?d\.?|master'?s?|doctoral|doctorate|graduate program)\b/i,
    undergradWords: /\b(b\.?a\.?|b\.?s\.?|bachelor'?s?|undergraduate)\b/i,
  },
  degree_bachelor_or_higher: {
    label: "Currently enrolled in a bachelor's degree program or higher",
    hint: "use for 'bachelor's or greater/higher' eligibility language — an enrolled undergrad already qualifies",
    degreeLevel: true,
    graduateWords: /\b(b\.?a\.?|b\.?s\.?|bachelor'?s?|undergraduate|m\.?s\.?|m\.?a\.?|mba|m\.?eng\.?|ph\.?d\.?|master'?s?|doctoral|doctorate|graduate program)\b/i,
    undergradWords: /(?!)/, // never matches — nothing below bachelor's needs to fail this check
    matchedReason: "degree level listed in Education is bachelor's or higher",
  },
  cross_functional_collaboration: {
    label: "Cross-functional collaboration",
    full: (t) => VERB.collab.test(t) && distinctFunctions(t) >= 2,
    partial: (t) => (VERB.collab.test(t) && distinctFunctions(t) === 1) || /\b(cross-functional|interdisciplinary|stakeholders?)\b/i.test(t),
    reasonFull: "names collaboration with two or more functions",
    reasonPartial: "collaboration with one function or a stakeholder mention only",
  },
  product_specifications: {
    label: "Product specifications / PRDs",
    full: (t) => VERB.write.test(t) && /\b(spec|specs|specification\w*|prd\w*|product requirements?|requirements? doc\w*|functional requirements)\b/i.test(t),
    partial: (t) => /\b(user stor(y|ies)|acceptance criteria|requirements)\b/i.test(t),
    reasonFull: "explicitly wrote/owned specifications or requirements",
    reasonPartial: "requirements-adjacent work without a written spec",
  },
  experimentation_plans: {
    label: "Experimentation plans",
    full: (t) => VERB.design.test(t) && /\b(a\/b test\w*|experiments?|experimentation)\b/i.test(t),
    partial: (t) => /\b(a\/b|experiment\w*|hypothes[ie]s|pilot stud\w*)\b/i.test(t),
    reasonFull: "designed/ran/analyzed experiments",
    reasonPartial: "experiment or hypothesis work mentioned without design ownership",
  },
  gtm_briefs: {
    label: "Go-to-market briefs",
    full: (t) => /\b(go-to-market|gtm|launch (plan|brief|strategy)|marketing brief|positioning (doc|brief)|messaging framework)\b/i.test(t),
    partial: (t) => /\b(activation (strategy|roadmap|plan)|partnership priorities|adoption strateg\w*)\b/i.test(t),
    reasonFull: "explicit go-to-market or launch-planning deliverable",
    reasonPartial: "activation/adoption strategy work, not a GTM brief",
  },
  user_research: {
    label: "User research and feedback",
    full: (t) => VERB.research.test(t) && /\b(user research|user feedback|customer journey\w*|patient journey\w*|interviews?|surveys?|participant responses|community feedback|feedback from|user needs|behavioral (research|stud\w*))\b/i.test(t),
    partial: (t) => /\b(feedback|users?' needs|customer|participants?)\b/i.test(t),
    reasonFull: "conducted research or gathered feedback from users/participants",
    reasonPartial: "feedback or users mentioned without a research action",
  },
  data_analysis: {
    label: "Data analysis",
    full: (t) => VERB.analyze.test(t) && /\b(data|responses|dataset|regression|sql|pandas|metrics|results|analysis|analytics)\b/i.test(t),
    partial: (t) => /\b(data|analytics|metrics)\b/i.test(t),
    reasonFull: "analyzed data with a named method or output",
    reasonPartial: "data mentioned without an analysis action",
  },
  market_research: {
    label: "Market research",
    full: (t) => /\b(market research|market (analysis|sizing|trends?)|adoption-barrier research|customer-journey.{0,40}research)\b/i.test(t),
    partial: (t) => /\b(market|industry|landscape)\b/i.test(t),
    reasonFull: "explicit market research",
    reasonPartial: "market context without a research deliverable",
  },
  competitive_analysis: {
    label: "Competitive analysis",
    full: (t) => /\b(competitive (analysis|positioning|landscape)|competitor\w*)\b/i.test(t),
    partial: (t) => /\b(positioning|benchmark\w*)\b/i.test(t),
    reasonFull: "explicit competitive analysis/positioning",
    reasonPartial: "positioning or benchmarking without competitors named",
  },
  product_strategy_roadmap: {
    label: "Product strategy and roadmaps",
    full: (t) => VERB.strategy.test(t) && /\b(product strategy|roadmap\w*|activation (strategy|roadmap))\b/i.test(t),
    partial: (t) => /\b(strategy|prioriti[sz]\w*|feature decisions?)\b/i.test(t),
    reasonFull: "built/led/defined a product strategy or roadmap",
    reasonPartial: "strategy or prioritization without roadmap ownership",
  },
  senior_pm_partnership: {
    label: "Partnering with senior product managers",
    full: (t) => VERB.collab.test(t) && /\b(product managers?|pms?\b|head of product|product lead\w*)\b/i.test(t),
    partial: (t) => /\b(product (team|strategy)|product lead)\b/i.test(t),
    reasonFull: "explicitly partnered with product managers",
    reasonPartial: "worked within a product team or on product strategy",
  },
  stakeholder_communication: {
    label: "Sharing progress and learnings with stakeholders",
    full: (t) => VERB.present.test(t) && /\b(stakeholders?|faculty|leadership|executives?|teams?|pis?\b|clients?|partners)\b/i.test(t),
    partial: (t) => /\b(stakeholders?|reports?|slide decks?|briefs?)\b/i.test(t),
    reasonFull: "presented or reported results to a named audience",
    reasonPartial: "stakeholders or reports mentioned without a communication action",
  },
  written_communication: {
    label: "Written communication",
    full: (t) => /\b(written reports?|reports?|slide decks?|documentation|memos?|briefs?|wrote|authored)\b/i.test(t),
    partial: (t) => /\b(communicat\w*|presented)\b/i.test(t),
    reasonFull: "produced written deliverables",
    reasonPartial: "communication without a written artifact",
  },
  product_launch: {
    label: "Shipping a product",
    full: (t) => VERB.build.test(t) && /\b(app|platform|product|feature\w*|system|pipeline|tool)\b/i.test(t) && /\b(shipped|launched|deployed|released|to launch|live)\b/i.test(t),
    partial: (t) => VERB.build.test(t) && /\b(app|platform|product|feature\w*|prototype)\b/i.test(t),
    reasonFull: "shipped/launched/deployed a product",
    reasonPartial: "built a product without an explicit launch",
  },
  consumer_product: {
    label: "Consumer product experience",
    full: (t) => /\b(ios|android|mobile app|consumer|app used by|athletes|users)\b/i.test(t) && VERB.build.test(t),
    partial: (t) => /\b(app|users)\b/i.test(t),
    reasonFull: "built a consumer-facing app/product",
    reasonPartial: "consumer context without building",
  },
  scale_millions: {
    label: "Features used by millions of users",
    scale: true,
    reasonFull: "résumé states an audience of 1,000,000+",
    reasonPartial: "largest stated audience is 10,000+; millions-scale not evidenced",
  },
  product_ownership: {
    label: "End-to-end product ownership",
    full: (t) => /\b(owned|founder|founded|led|from idea to launch|end.to.end|full (development|product) (cycle|lifecycle))\b/i.test(t) && /\b(product|app|roadmap|development cycle)\b/i.test(t),
    partial: (t) => /\b(product lead|product management)\b/i.test(t),
    reasonFull: "owned a product end to end",
    reasonPartial: "product leadership without full ownership",
  },
  product_decisions: {
    label: "Data-informed product decisions",
    full: (t) => /\b(feature decisions?|prioriti[sz]e features?|informed .{0,30}decisions?|data-informed|translat\w* .{0,40}(into|to) (feature|product) decisions?)\b/i.test(t),
    partial: (t) => /\b(decisions?|prioriti[sz]\w*)\b/i.test(t),
    reasonFull: "used data to make product decisions",
    reasonPartial: "decisions mentioned without data linkage",
  },
  product_analytics: {
    label: "Product analytics and metrics",
    full: (t) => /\b(engagement metrics|product analytics|session duration|kpis?|success metrics|defined .{0,20}metrics|retention|conversion)\b/i.test(t),
    partial: (t) => /\b(metrics|analytics)\b/i.test(t),
    reasonFull: "defined or used product metrics",
    reasonPartial: "metrics mentioned generically",
  },
  sql: { label: "SQL", full: (t) => /\bsql\b/i.test(t), reasonFull: "SQL named" },
  python: { label: "Python", full: (t) => /\bpython\b/i.test(t), partial: (t) => /\b(pandas|numpy)\b/i.test(t), reasonFull: "Python named", reasonPartial: "Python libraries named" },
  r_language: { label: "R", full: (t) => /\bin R\b|\bR\b(?= using|,| and| to)|\busing R\b/.test(t), reasonFull: "R named" },
  statistics: { label: "Statistics and quantitative reasoning", full: (t) => /\b(regression|hypothesis test\w*|statistical|a\/b test\w*|experimental design)\b/i.test(t), partial: (t) => /\b(quantitative|analy[sz]\w*)\b/i.test(t), reasonFull: "statistical method named", reasonPartial: "quantitative work without a named method" },
  experimentation: { label: "Experimentation", full: (t) => VERB.design.test(t) && /\b(a\/b test\w*|experiments?|experimentation)\b/i.test(t), partial: (t) => /\b(a\/b|experiment\w*|hypothes[ie]s|pilot)\b/i.test(t), reasonFull: "designed/ran experiments", reasonPartial: "experiments mentioned" },
  causal_inference: { label: "Causal inference", full: (t) => /\b(causal inference|difference-in-differences|instrumental variable|propensity|treatment effect)\b/i.test(t), partial: (t) => /\b(a\/b test\w*|randomi[sz]ed|experiments?)\b/i.test(t), reasonFull: "causal method named", reasonPartial: "randomized experiments imply causal reasoning" },
  forecasting: { label: "Forecasting", full: (t) => /\b(forecast\w*|time.series)\b/i.test(t), partial: (t) => /\b(predict(ed|ing|ions?)?\s+(growth|demand|trends?|churn|revenue|usage|volume|adoption))\b/i.test(t), reasonFull: "forecasting named", reasonPartial: "predicted a business trend without a named forecasting method" },
  data_engineering: { label: "Data pipelines", full: (t) => /\b(etl|data pipelines?|pipelines?|ingest\w*)\b/i.test(t) && VERB.build.test(t), partial: (t) => /\b(pipeline|etl)\b/i.test(t), reasonFull: "built data pipelines", reasonPartial: "pipelines mentioned" },
  ml_evaluation: { label: "Model evaluation / ML", full: (t) => /\b(model evaluation|benchmark\w*|llm|training data(set)?|error analysis|recommendation (system|platform)|machine learning|ml\b)/i.test(t), partial: (t) => /\b(model\w*)\b/i.test(t), reasonFull: "ML evaluation or system work", reasonPartial: "models mentioned" },
  ai_evaluation: { label: "LLM / AI output evaluation", full: (t) => /\b(llm|ai-generated|model outputs?|instruction-following|correctness criteria|prompt)\b/i.test(t) && /\b(evaluat\w*|scored|graded|assessed|rubric)/i.test(t), partial: (t) => /\b(llm|ai)\b/i.test(t), reasonFull: "evaluated AI/LLM outputs against criteria", reasonPartial: "AI mentioned without evaluation work" },
  data_visualization: { label: "Data visualization", full: (t) => /\b(visuali[sz]\w*|dashboards?|charts?|plots?|tableau|looker|power bi|matplotlib|plotly)\b/i.test(t), reasonFull: "visualization or dashboard work named" },
  dashboards: { label: "Dashboards / BI tools", full: (t) => /\b(power bi|tableau|looker|dashboards?)\b/i.test(t), reasonFull: "BI tool named" },
  mobile: { label: "Mobile development", full: (t) => /\b(ios|android|swift|kotlin|mobile app)\b/i.test(t), reasonFull: "mobile platform named" },
  leadership: { label: "Leadership", full: (t) => /\b(led|founder|founded|owned|initiated)\b/i.test(t), partial: (t) => /\b(coordinat\w*|organi[sz]ed)\b/i.test(t), reasonFull: "led or founded", reasonPartial: "coordinated" },
  initiative: { label: "Initiative", full: (t) => /\b(initiated|self-directed|founded|founder|launched (an )?independent)\b/i.test(t), reasonFull: "self-initiated work" },
  process_improvement: { label: "Process improvement", full: (t) => /\b(redesigned|streamlined|automated|optimi[sz]ed|improved .{0,30}(workflow|process))\b/i.test(t), reasonFull: "improved a process" },
};

function distinctFunctions(t) {
  const found = new Set();
  for (const m of String(t).matchAll(FUNCTIONS)) found.add(m[0].toLowerCase().replace(/s$/, "").replace(/(ing|er|ers)$/, ""));
  return found.size;
}

// ── Résumé units (section-aware) ────────────────────────────────────────
function resumeUnits(doc) {
  const units = [];
  const push = (text, where, section, entry, idx) => units.push({ text: String(text || ""), where, section, entry, idx });
  push(doc.education?.degree, "Education — degree", "education", null, -1);
  push(doc.education?.coursework, "Education — coursework", "education", null, -1);
  (doc.experience || []).forEach((e, i) => e.bullets.forEach((b, j) => push(b, `${e.org}, bullet ${j + 1}`, "experience", e, j)));
  (doc.projects || []).forEach((p, i) => {
    push(p.tech, `${p.name}, tech line`, "projects", p, -1);
    p.bullets.forEach((b, j) => push(b, `${p.name}, bullet ${j + 1}`, "projects", p, j));
  });
  const skills = Array.isArray(doc.skills) ? doc.skills : Object.entries(doc.skills || {}).map(([cat, vals]) => ({ cat, vals }));
  skills.forEach((s) => push(`${s.cat}: ${s.vals}`, `Skills — ${s.cat}`, "skills", null, -1));
  return units;
}

function largestAudience(units) {
  let max = 0;
  for (const u of units) {
    for (const m of u.text.matchAll(/(\d[\d,]*)\s*(\+|k|m)?\s*(?:[a-z-]+\s+){0,2}(users?|athletes?|people|customers?|members?|predictions?|monthly|listeners?|players?|creators?)/gi)) {
      let n = Number(m[1].replace(/,/g, ""));
      if (m[2]?.toLowerCase() === "k") n *= 1e3; if (m[2]?.toLowerCase() === "m") n *= 1e6;
      if (n > max) max = n;
    }
  }
  return max;
}

// ── Evaluate one capability against the résumé ──────────────────────────
function evaluateCapability(capId, units, keywords = []) {
  const cap = CAPABILITIES[capId];
  const result = { capability: capId, label: cap?.label || capId, status: "missing", evidence: null, where: null, reason: "no résumé statement demonstrates this", confidence: "high", evidenceType: null };

  if (!cap) {
    // Unknown capability: exact normalized phrase match in a bullet gives a partial, never a full match.
    for (const k of keywords) {
      const u = units.find((u) => u.section !== "skills" && normalize(u.text).includes(normalize(k)));
      if (u) return { ...result, status: "partially_matched", evidence: u.text, where: u.where, reason: `phrase “${k}” appears; capability not in the evidence vocabulary`, confidence: "low", evidenceType: "inferred" };
    }
    return { ...result, confidence: "low" };
  }

  if (cap.section === "education") {
    const u = units.find((u) => u.section === "education" && cap.fields.test(u.text));
    return u ? { ...result, status: "matched", evidence: u.text, where: u.where, reason: "degree field listed in Education", confidence: "high", evidenceType: "direct" } : result;
  }

  if (cap.degreeLevel) {
    const edu = units.find((u) => u.section === "education" && (cap.graduateWords.test(u.text) || cap.undergradWords.test(u.text)));
    if (edu && cap.graduateWords.test(edu.text)) return { ...result, status: "matched", evidence: edu.text, where: edu.where, reason: cap.matchedReason || "degree level listed in Education is graduate-level", confidence: "high", evidenceType: "direct" };
    if (edu && cap.undergradWords.test(edu.text)) return { ...result, status: "missing", evidence: edu.text, where: edu.where, reason: "Education lists an undergraduate degree, not graduate enrollment", confidence: "high", evidenceType: "direct" };
    return { ...result, reason: "no degree level stated in Education to check against" };
  }

  if (cap.scale) {
    const n = largestAudience(units);
    if (n >= 1e6) return { ...result, status: "matched", evidence: `largest stated audience: ${n.toLocaleString()}`, where: "résumé", reason: cap.reasonFull, confidence: "high", evidenceType: "direct" };
    if (n >= 1e4) return { ...result, status: "partially_matched", evidence: `largest stated audience: ${n.toLocaleString()}`, where: "résumé", reason: cap.reasonPartial, confidence: "medium", evidenceType: "inferred" };
    return { ...result, evidence: n ? `largest stated audience: ${n.toLocaleString()}` : null, reason: "no audience at the required scale" };
  }

  // Full rules: statements in experience/projects (not skills lists — a skills keyword is not a demonstrated action).
  for (const u of units) {
    if (u.section === "skills" || u.section === "education") continue;
    if (cap.full && cap.full(u.text)) return { ...result, status: "matched", evidence: u.text, where: u.where, reason: cap.reasonFull, confidence: "high", evidenceType: "direct" };
  }
  for (const u of units) {
    if (u.section === "education") continue;
    if (cap.partial && cap.partial(u.text)) return { ...result, status: "partially_matched", evidence: u.text, where: u.where, reason: cap.reasonPartial || "related but incomplete evidence", confidence: u.section === "skills" ? "low" : "medium", evidenceType: "inferred" };
  }
  // A skills-list mention of a tool-type capability (SQL, Python) counts as a weak match.
  if (cap.full && !cap.partial) {
    const u = units.find((u) => u.section === "skills" && cap.full(u.text));
    if (u) return { ...result, status: "partially_matched", evidence: u.text, where: u.where, reason: "listed in Skills only, not demonstrated in a bullet", confidence: "low", evidenceType: "inferred" };
  }
  return result;
}

function normalize(s) { return String(s).toLowerCase().replace(/[^a-z0-9+#/ ]/g, " ").replace(/\s+/g, " ").trim(); }

// ── Classification of extracted statements ──────────────────────────────
// The extractor (a model call) proposes {statement, category, capabilities[]};
// this deterministic pass overrides obvious misclassifications.
function classify(item) {
  const s = item.statement || "";
  if (LOGISTICS.test(s) || AUDIENCE.test(s)) return "logistics";
  if ((COMPANY.test(s) || NARRATIVE.test(s)) && !(item.capabilities || []).length) return "company_language";
  if (SUBJECTIVE.test(s) && !/\b(sql|python|research|analy[st]|experiment|data|metrics)/i.test(s)) return "subjective_trait";
  if (CATEGORIES.includes(item.category)) return item.category;
  return "responsibility";
}

// ── Bullet quality (no number required) ─────────────────────────────────
const WEAK = /\b(responsible for|helped|worked on|assisted with|various|participated in|involved in|exposure to)\b/i;
const STRONG_VERB = /^(?:[A-Z][\w-]*ed|Built|Led|Ran|Drove|Grew|Wrote|Cut|Set|Won|Made|Met|Taught|Brought|Sold|Held|Kept|Chose|Began|Saw|Found|Oversaw|Shipped|Fit|Fed|Co-designed|Spearheaded|Redesigned)\b/;
const OUTCOME = /\b(to |increas\w*|improv\w*|reduc\w*|produc\w*|enabl\w*|driv\w*|surfac\w*|deliver\w*|result\w*|so that|which|that (fed|became|shaped|increased|improved)|making|keeping|converting|removing|translating|growing|isolating)\b/i;

function bulletQuality(text) {
  const t = String(text).trim();
  const verb = STRONG_VERB.test(t);
  const strong = !WEAK.test(t);
  const length = t.length <= 220;
  const number = /\d|%/.test(t);
  const words = t.split(/\s+/).length;
  const scope = words >= 8;
  const outcome = OUTCOME.test(t);
  const pass = verb && strong && length && (number || (scope && outcome));
  const notes = [];
  if (!verb) notes.push("does not open with a strong past-tense verb");
  if (!strong) notes.push("weak phrase");
  if (!length) notes.push(`${t.length} chars (max 220)`);
  if (!number && !(scope && outcome)) notes.push("no metric and no clear scope + outcome");
  return { verb, strong, length, number, scope, outcome, pass, notes };
}

// ── Track classification ────────────────────────────────────────────────
// One primary track per posting, from the title (weighted 3×) and the body.
const TRACKS = {
  ds_ml: { label: "Data Science / ML", signals: [/\bdata scien\w*/i, /\bmachine learning\b/i, /\bml (engineer|intern|model)/i, /\bstatistic\w*/i, /\bregression\b/i, /\bforecast\w*/i, /\bcausal\b/i, /\bpython\b/i, /\bmodel(s|ing)?\b/i, /\bdata pipelines?\b/i] },
  product_analytics: { label: "Product Analytics / BI", signals: [/\bproduct analy\w*/i, /\bbusiness intelligence\b/i, /\banalyst\b/i, /\banalytics\b/i, /\bdashboards?\b/i, /\bsql\b/i, /\btableau|looker|power bi\b/i, /\bkpis?\b/i, /\bmetrics\b/i, /\bfunnel\b/i] },
  product_management: { label: "Product Management", signals: [/\bproduct manager\b/i, /\bproduct management\b/i, /\bassociate product\b/i, /\bapm\b/i, /\broadmaps?\b/i, /\bspecifications?\b|\bprds?\b/i, /\buser research\b/i, /\bcross-functional\b/i, /\bfeatures?\b/i, /\bgo-to-market\b/i] },
  ai_product: { label: "AI Product / Technical PM", signals: [/\bai product\b/i, /\btechnical product manager\b/i, /\btpm\b/i, /\bllms?\b/i, /\bgenerative ai\b|\bgenai\b/i, /\bai[- ]powered\b/i, /\bmodel (evaluation|quality)\b/i, /\bprompt\w*/i, /\bai features?\b/i, /\bmachine learning product\b/i] },
  product_strategy: { label: "Product Strategy / Growth", signals: [/\bproduct strateg\w*/i, /\bgrowth\b/i, /\bstrategy (intern|analyst|associate)\b/i, /\bmarket research\b/i, /\bcompetitive (analysis|landscape)\b/i, /\bgo-to-market\b/i, /\bacquisition|retention|conversion\b/i, /\bbusiness case\b/i, /\bpartnerships?\b/i, /\bexpansion\b/i] },
};

function classifyTrack(jd) {
  const text = String(jd || "");
  const title = text.split("\n").find((l) => l.trim()) || "";
  const scores = {};
  for (const [id, t] of Object.entries(TRACKS)) {
    let s = 0;
    t.signals.forEach((re, i) => {
      const w = i < 4 ? 2 : 1;                       // the first signals are the strongest identifiers
      if (re.test(title)) s += 3 * w;
      const n = (text.match(new RegExp(re.source, "gi")) || []).length;
      s += Math.min(n, 4) * w * 0.5;
    });
    scores[id] = Math.round(s * 10) / 10;
  }
  // Disambiguation: AI product needs AI signals on top of PM signals; strategy needs strategy language on top of PM.
  if (scores.ai_product > 0 && scores.ai_product < scores.product_management * 0.6) scores.ai_product *= 0.5;
  const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [track, top] = ordered[0];
  const second = ordered[1]?.[1] || 0;
  return { track: top > 0 ? track : "product_management", label: TRACKS[top > 0 ? track : "product_management"].label, confidence: top === 0 ? "low" : top - second >= 4 ? "high" : top - second >= 1.5 ? "medium" : "low", scores };
}

// Track-specific experience order (entry ids). GoalKeeper is a project section; when it is
// ranked first the Projects section leads, otherwise Projects follows Experience.
const TRACK_ORDER = {
  ds_ml: ["flourish", "haas", "mercor", "resumetailor", "siemens", "goalkeeper"],
  product_analytics: ["flourish", "resumetailor", "goalkeeper", "haas", "siemens", "mercor"],
  product_management: ["siemens", "goalkeeper", "resumetailor", "flourish", "haas", "mercor"],
  ai_product: ["flourish", "mercor", "resumetailor", "goalkeeper", "siemens", "haas"],
  product_strategy: ["siemens", "goalkeeper", "resumetailor", "flourish", "haas", "mercor"],
};

// Verified skills to lead with per track (only ones present in the bank are ever listed).
const TRACK_SKILL_PRIORITY = {
  ds_ml: ["Python", "SQL", "R", "pandas", "NumPy", "BigQuery", "statistical modeling", "regression analysis", "hypothesis testing", "A/B testing", "ETL pipelines", "data visualization", "model evaluation", "error analysis"],
  product_analytics: ["SQL", "Python", "R", "pandas", "A/B testing", "product analytics", "experimentation", "regression analysis", "statistical modeling", "ETL pipelines", "data visualization", "Power BI"],
  product_management: ["product strategy", "customer discovery", "user research", "product roadmapping", "experimentation", "product analytics", "market research", "competitive analysis", "cross-functional collaboration", "A/B testing", "SQL"],
  ai_product: ["LLM evaluation", "model evaluation", "error analysis", "product strategy", "experimentation", "user research", "product roadmapping", "Python", "SQL", "A/B testing", "product analytics", "cross-functional collaboration"],
  product_strategy: ["product strategy", "market research", "competitive analysis", "customer discovery", "customer journey mapping", "product roadmapping", "user research", "experimentation", "product analytics", "cross-functional collaboration", "SQL"],
};

// Capability weights per track (used for bullet selection and relevance ordering checks).
const TRACK_CAP_WEIGHTS = {
  ds_ml: { data_analysis: 1.5, statistics: 1.5, sql: 1.5, python: 1.5, r_language: 1.25, experimentation: 1.5, causal_inference: 1.5, forecasting: 1.25, data_engineering: 1.5, ml_evaluation: 1.5, ai_evaluation: 1.25 },
  product_analytics: { data_analysis: 1.5, sql: 1.5, product_analytics: 1.5, experimentation: 1.5, experimentation_plans: 1.5, statistics: 1.25, product_decisions: 1.5, dashboards: 1.5, data_engineering: 1.25 },
  product_management: { product_ownership: 1.5, product_launch: 1.5, consumer_product: 1.25, experimentation_plans: 1.5, product_decisions: 1.5, product_analytics: 1.25, user_research: 1.5, product_strategy_roadmap: 1.5, cross_functional_collaboration: 1.25, product_specifications: 1.5 },
  ai_product: { ml_evaluation: 1.5, ai_evaluation: 1.5, product_ownership: 1.25, product_launch: 1.25, experimentation_plans: 1.25, product_decisions: 1.5, user_research: 1.25, product_strategy_roadmap: 1.25, data_engineering: 1.25 },
  product_strategy: { product_strategy_roadmap: 1.5, market_research: 1.5, competitive_analysis: 1.5, user_research: 1.25, stakeholder_communication: 1.25, cross_functional_collaboration: 1.25, product_decisions: 1.25, product_analytics: 1.25, gtm_briefs: 1.5 },
};
const ROLE_WEIGHTS = { product: TRACK_CAP_WEIGHTS.product_management, data: TRACK_CAP_WEIGHTS.ds_ml, engineering: { data_engineering: 1.5, python: 1.5, sql: 1.25, product_launch: 1.25, mobile: 1.25 }, ...TRACK_CAP_WEIGHTS };
function detectRoleType(jd) { return classifyTrack(jd).track; }

// ── Relevance ranking of entries ────────────────────────────────────────
function rankEntries(doc, capIds, roleType = "general") {
  const weights = ROLE_WEIGHTS[roleType] || {};
  const entries = [...(doc.experience || []).map((e) => ({ kind: "experience", id: e.id, name: e.org, ref: e })), ...(doc.projects || []).map((p) => ({ kind: "project", id: p.id, name: p.name, ref: p }))];
  return entries.map((en) => {
    const units = resumeUnits({ experience: en.kind === "experience" ? [en.ref] : [], projects: en.kind === "project" ? [en.ref] : [], education: {}, skills: {} });
    let score = 0; const hits = [];
    for (const c of capIds) {
      const r = evaluateCapability(c, units);
      const w = weights[c] || 1;
      if (r.status === "matched") { score += w; hits.push(c); } else if (r.status === "partially_matched") { score += 0.5 * w; hits.push(`${c}(partial)`); }
    }
    return { ...en, score: Math.round(score * 100) / 100, hits };
  }).sort((a, b) => b.score - a.score);
}

// Order entries by the track's fixed order. That table only knows the built-in example's entry
// ids, so a different résumé (a custom evidence bank) falls back to ranking every entry by how
// well it evidences the posting's own capabilities — still ordered, just not from a lookup table.
function orderForTrack(doc, track, capIds) {
  const order = TRACK_ORDER[track] || [];
  const allIds = [...(doc.experience || []), ...(doc.projects || [])].map((e) => e.id);
  const known = allIds.some((id) => order.includes(id));
  if (!known && capIds && capIds.length) {
    const ranked = rankEntries(doc, capIds, track);
    const rank = new Map(ranked.map((r, i) => [r.id, i]));
    const pos = (id) => rank.get(id) ?? 99;
    const experience = [...(doc.experience || [])].sort((a, b) => pos(a.id) - pos(b.id));
    const projects = [...(doc.projects || [])].sort((a, b) => pos(a.id) - pos(b.id));
    const top = ranked[0];
    const sectionOrder = top && projects.some((p) => p.id === top.id) ? ["projects", "experience"] : ["experience", "projects"];
    return { experience, projects, sectionOrder, fallback: true };
  }
  const pos = (id) => { const i = order.indexOf(id); return i < 0 ? 99 : i; };
  const experience = [...(doc.experience || [])].sort((a, b) => pos(a.id) - pos(b.id));
  const projects = [...(doc.projects || [])].sort((a, b) => pos(a.id) - pos(b.id));
  const firstId = order[0];
  const sectionOrder = projects.some((p) => p.id === firstId) ? ["projects", "experience"] : ["experience", "projects"];
  return { experience, projects, sectionOrder };
}

// ── Chronology ──────────────────────────────────────────────────────────
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
function parseEnd(dates) {
  const s = String(dates || "");
  if (/present|current/i.test(s)) return 999912;
  const parts = s.split(/[–—-]/).map((x) => x.trim()).filter(Boolean);
  const last = parts[parts.length - 1] || "";
  const m = /([A-Za-z]{3,})\.?\s+(\d{4})/.exec(last) || /(\d{4})/.exec(last);
  if (!m) return null;
  return m.length === 3 ? Number(m[2]) * 100 + (MONTHS[m[1].slice(0, 4).toLowerCase()] || MONTHS[m[1].slice(0, 3).toLowerCase()] || 0) : Number(m[1]) * 100;
}
function isChronological(entries) {
  const ends = entries.map((e) => parseEnd(e.dates)).filter((x) => x !== null);
  for (let i = 1; i < ends.length; i++) if (ends[i] > ends[i - 1]) return false;
  return true;
}

// ── Duplication and copying ─────────────────────────────────────────────
const STOP = new Set(["a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "with", "by", "from", "that", "into", "across", "as", "at", "its", "their"]);
function contentTokens(t) { return new Set(String(t).toLowerCase().replace(/[^a-z0-9%+ ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))); }
function jaccard(a, b) { const A = contentTokens(a), B = contentTokens(b); let inter = 0; for (const x of A) if (B.has(x)) inter++; const uni = A.size + B.size - inter; return uni ? inter / uni : 0; }
function metricsIn(t) { return [...String(t).matchAll(/\d[\d,]*(?:\.\d+)?%?\+?/g)].map((m) => m[0]); }

// Two bullets are semantic duplicates when their source facts share a result key, when they share
// the same headline metric and overlap heavily, or when their content overlap is very high.
function duplicateBullets(entry, bank) {
  const facts = new Map((bank?.entries || []).flatMap((e) => e.facts.map((f) => [f.id, f])));
  const out = [];
  const bl = entry.bullets || [], ids = entry.factIds || [];
  for (let i = 0; i < bl.length; i++) for (let j = i + 1; j < bl.length; j++) {
    const fi = facts.get(ids[i]), fj = facts.get(ids[j]);
    const sameResult = fi?.result && fj?.result && fi.result === fj.result;
    const mi = metricsIn(bl[i]), mj = metricsIn(bl[j]);
    const sharedMetric = mi.some((m) => /%/.test(m) && mj.includes(m));
    const sim = jaccard(bl[i], bl[j]);
    // A shared percentage result counts as a duplicate when the bullets also share the metric's subject (e.g. "session duration").
    const sharedSubject = sharedMetric && [...contentTokens(bl[i])].filter((w) => contentTokens(bl[j]).has(w) && !/^\d/.test(w)).length >= 2;
    if (sameResult || (sharedMetric && (sim >= 0.25 || sharedSubject)) || sim >= 0.6) out.push({ i, j, reason: sameResult ? `both center on the same result (${fi.result})` : sharedMetric ? "repeat the same headline metric" : "near-identical wording" });
  }
  return out;
}

function copiedFromPosting(bullet, jd, n = 6) {
  if (!jd) return false;
  const words = String(bullet).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const hay = " " + String(jd).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ") + " ";
  for (let i = 0; i + n <= words.length; i++) if (hay.includes(" " + words.slice(i, i + n).join(" ") + " ")) return true;
  return false;
}

// ── Deterministic bullet selection (fallback and post-processing) ────────
// Picks the strongest non-duplicative facts for a track: capability hits × track weights,
// then drops any fact whose result key or wording duplicates an already chosen one.
function selectFacts(entry, capIds, track, n) {
  const weights = TRACK_CAP_WEIGHTS[track] || {};
  const scored = entry.facts.map((f) => {
    const units = resumeUnits({ experience: [{ org: entry.org, bullets: [f.text] }], projects: [], education: {}, skills: {} });
    let s = 0;
    for (const c of capIds) { const r = evaluateCapability(c, units); const w = weights[c] || 1; if (r.status === "matched") s += w; else if (r.status === "partially_matched") s += 0.5 * w; }
    for (const t of f.tags || []) if (weights[t]) s += 0.25 * weights[t];
    return { f, s };
  }).sort((a, b) => b.s - a.s);
  const chosen = [];
  for (const { f } of scored) {
    if (chosen.length >= n) break;
    const dup = chosen.some((c) => (c.result && c.result === f.result) || jaccard(c.text, f.text) >= 0.6);
    if (!dup) chosen.push(f);
  }
  return chosen;
}

function dedupeSelection(entry, bank) {
  const dups = duplicateBullets(entry, bank);
  const drop = new Set(dups.map((d) => d.j));
  if (!drop.size) return { entry, dropped: [] };
  const keep = entry.bullets.map((_, i) => i).filter((i) => !drop.has(i));
  return { entry: { ...entry, bullets: keep.map((i) => entry.bullets[i]), factIds: keep.map((i) => (entry.factIds || [])[i]) }, dropped: dups.map((d) => ({ text: entry.bullets[d.j], reason: d.reason })) };
}

// ── Skills selection ────────────────────────────────────────────────────
// Skill grouping is derived from the skill's own name via pattern matching, never from a
// hand-typed label on the data — this is what makes it work the same way for any résumé
// (the candidate's own bank, or one built from an imported résumé with no curated groups).
const SKILL_GROUP_RULES = [
  // C++/C# end in a non-word character, so a trailing \b can never match (no boundary between
  // a symbol and end-of-string/another symbol) — these need a left-only boundary instead.
  ["Languages", /\bc\+\+|\bc#/i],
  ["Languages", /\b(python|java(script)?|typescript|swift|golang|rust|scala|kotlin|ruby|php|sql|html|css|matlab|latex|scheme|bash|shell|dart|perl|objective-c|pandas|numpy)\b/i],
  ["Languages", /^[a-z]$/i], // bare single-letter languages (R, C) only when that is the whole token
  ["Tools & Platforms", /\b(git(hub|lab)?|docker|kubernetes|aws|amazon web services|sagemaker|azure|gcp|google cloud|power ?bi|tableau|excel|looker|figma|jira|postgres(ql)?|mysql|mongodb|firebase|redis|snowflake|databricks|airflow|py ?spark|spark|hadoop|terraform|jenkins|linux|vs ?code|visual studio|intellij|xcode|jupyter|colab|bigquery|quicksight|microstrategy|chromadb)\b/i],
  ["Analytics & Experimentation", /\b(a\/b test\w*|experiment\w*|hypothesis|regression|statistic\w*|forecast\w*|causal|qualitative coding|product analytics)\b/i],
  ["Data & ML", /\b(etl|pipelines?|model\w*|recommendation|llm|error analysis|data clean\w*|data valid\w*|machine learning|deep learning|\bnlp\b|computer vision|tensorflow|pytorch|scikit)\b/i],
  ["Product & Strategy", /\b(product strategy|roadmap\w*|user research|customer|market research|competitive analysis|cross-functional|stakeholder|go-to-market|prd|specification\w*|partnership)\b/i],
];
function classifySkillGroup(name) {
  const n = String(name || "").trim();
  for (const [group, re] of SKILL_GROUP_RULES) if (re.test(n)) return group;
  return "Other";
}
// Flattens any {category: "a, b, c"} shape (or [{cat, vals}] array) into individual skills
// and re-buckets them with classifySkillGroup, ignoring whatever category labels were stored —
// so an imported bank's arbitrary category names never produce an inconsistent skills section.
// Commas inside parentheses (e.g. "Azure (AZ-900, AI-900 Certified)") don't split the entry.
function regroupSkills(skillsObjOrArray) {
  const entries = Array.isArray(skillsObjOrArray) ? skillsObjOrArray.map((s) => [s.cat, s.vals]) : Object.entries(skillsObjOrArray || {});
  const groups = {}; const order = [];
  for (const [, vals] of entries) {
    for (const raw of String(vals || "").split(/,(?![^(]*\))/)) {
      const name = raw.trim();
      if (!name) continue;
      const g = classifySkillGroup(name);
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(name);
    }
  }
  return order.map((g) => ({ cat: g, vals: groups[g].join(", ") }));
}
const REQUESTED_TOOLS = /\b(tableau|looker|spark|pyspark|bigquery|snowflake|dbt|airflow|figma|jira|excel|scala|java|c\+\+|kotlin|tensorflow|pytorch|scikit-learn|aws|gcp|azure|docker|kubernetes|power bi)\b/g;
function selectSkills(bank, track, jd, max = 12) {
  const banned = new Set((bank.prohibited || []).map((p) => p.toLowerCase()));
  const isBanned = (name) => banned.has(String(name).toLowerCase());
  const verified = (bank.verifiedSkills || []).filter((v) => !isBanned(v.name));
  const priority = TRACK_SKILL_PRIORITY[track] || [];
  const jdl = String(jd || "").toLowerCase();
  const scoreOf = (s) => {
    const p = priority.findIndex((x) => x.toLowerCase() === s.name.toLowerCase());
    const inJd = jdl.includes(s.name.toLowerCase()) ? 1 : 0;
    return (p >= 0 ? (priority.length - p) : 0) + inJd * 3;
  };
  const chosen = verified.map((s) => ({ ...s, score: scoreOf(s) })).filter((s) => s.score > 0 || priority.length === 0).sort((a, b) => b.score - a.score);
  // Group order follows selection order (most track-relevant group leads) rather than a fixed list,
  // so a product-focused track naturally leads with Product & Strategy and a technical track with Languages.
  const groups = {}; const order = [];
  for (const s of chosen.slice(0, max)) { const g = classifySkillGroup(s.name); if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(s.name); }
  // Anything the posting names that the bank cannot back is reported, never listed.
  const requested = [...jdl.matchAll(REQUESTED_TOOLS)].map((m) => m[1]);
  const unsupported = [...new Set(requested)].filter((r) => !verified.some((v) => v.name.toLowerCase() === r));
  return { skills: order.map((g) => ({ cat: g, vals: groups[g].join(", ") })), unsupported };
}

// ── Missing-item verdicts ───────────────────────────────────────────────
const CAP_KIND = { scale_millions: "scale", degree_related_field: "eligibility", graduate_enrollment: "degree_level" };
function missingVerdict(item, bank) {
  if (isDeclined(bank, questionKey(item))) return { verdict: "Not evidenced — do not add", why: "you confirmed you don't have this" };
  const cap = item.capability;
  const kind = CAP_KIND[cap] || (CAPABILITIES[cap] ? "activity" : "skill");
  const prohibited = (bank?.entries || []).some((e) => (e.prohibited || []).some((p) => cap && normalize(p).includes(normalize(cap.replace(/_/g, " ")).split(" ")[0])));
  if (kind === "degree_level" && item.evidenceType === "direct") return { verdict: "Not evidenced — do not add", why: "Education states an undergraduate degree; this can't be resolved by rewording — only by actually being enrolled in a graduate program" };
  if (kind === "scale" || prohibited) return { verdict: "Not evidenced — do not add", why: kind === "scale" ? "the posting describes the employer's scale; no résumé claim can truthfully supply it" : "a related claim is explicitly prohibited in the evidence bank" };
  return { verdict: "Needs candidate confirmation", why: kind === "skill" ? "a tool or skill the candidate may have used but has not documented" : "the candidate may have done this in a role already on the résumé; it is not documented" };
}

// ── The canonical evaluation ────────────────────────────────────────────
const WEIGHTS = { required: 40, preferred: 20, strength: 20, relevance: 10, clarity: 10 };

function evaluate(extracted, doc, opts = {}) {
  const track = opts.track || opts.roleType || classifyTrack(opts.jd || "").track;
  const bank = opts.bank || null;
  const jd = opts.jd || "";
  const relevanceOrdering = opts.relevanceOrdering !== false;
  const units = resumeUnits(doc);
  const items = [];
  for (const raw of extracted) {
    const category = classify(raw);
    const caps = (raw.capabilities || []).filter((c, i, a) => a.indexOf(c) === i);
    if (!SCORED.has(category)) {
      items.push({ statement: raw.statement, category, status: "not_scorable", capability: null, results: [], reason: { logistics: "eligibility/logistics — not a résumé-keyword item", company_language: "company or mission language — not a candidate requirement", subjective_trait: "subjective trait — cannot be verified from a résumé" }[category] });
      continue;
    }
    const capList = caps.length ? caps : ["__keywords__"];
    for (const c of capList) {
      const r = c === "__keywords__" ? evaluateCapability("__unknown__", units, raw.keywords || []) : evaluateCapability(c, units, raw.keywords || []);
      const item = { statement: raw.statement, category, status: r.status, capability: c === "__keywords__" ? null : c, label: c === "__keywords__" ? raw.statement : r.label, evidence: r.evidence, where: r.where, reason: r.reason, confidence: r.confidence, evidenceType: r.evidenceType === "direct" ? "direct" : r.evidenceType ? "equivalent" : null, results: [r] };
      if (r.status === "missing") Object.assign(item, missingVerdict(item, bank));
      if (!item.capability && r.status === "missing" && !isDeclined(bank, questionKey(item))) Object.assign(item, { verdict: "Needs candidate confirmation", why: "outside the evidence vocabulary; phrase not found on the résumé" });
      items.push(item);
    }
  }

  const bucket = (cat) => items.filter((i) => i.category === cat);
  const cov = (arr) => (arr.length ? arr.reduce((a, i) => a + STATUS_VALUE[i.status], 0) / arr.length : null);
  const req = bucket("required_qualification"), pref = bucket("preferred_qualification"), resp = bucket("responsibility");
  // Responsibilities count with the required bucket at half weight per item (they describe the job, not the bar).
  const reqPlus = [...req, ...resp];
  const reqCov = req.length + resp.length ? (req.reduce((a, i) => a + STATUS_VALUE[i.status], 0) + 0.5 * resp.reduce((a, i) => a + STATUS_VALUE[i.status], 0)) / (req.length + 0.5 * resp.length) : null;

  // Evidence strength: how convincing the matches are (direct high > equivalent > partial), plus bullet specificity.
  const scorable = items.filter((i) => i.status !== "not_scorable");
  const strengthOf = (i) => i.status === "matched" ? (i.evidenceType === "direct" ? (i.confidence === "high" ? 1 : 0.8) : 0.6) : i.status === "partially_matched" ? (i.confidence === "low" ? 0.25 : 0.4) : 0;
  const matchedItems = scorable.filter((i) => i.status !== "missing");
  const matchStrength = matchedItems.length ? matchedItems.reduce((a, i) => a + strengthOf(i), 0) / matchedItems.length : 0;
  const bullets = units.filter((u) => u.idx >= 0).map((u) => ({ where: u.where, text: u.text, entry: u.entry, ...bulletQuality(u.text), copied: copiedFromPosting(u.text, jd), long: u.text.length > 180 }));
  const specificity = bullets.length ? bullets.filter((b) => b.number || (b.scope && b.outcome)).length / bullets.length : 0;
  const unsupported = opts.unsupportedClaims || 0;
  const strength = Math.max(0, (0.6 * matchStrength + 0.4 * specificity) - 0.1 * unsupported);

  // Relevance & ordering: track order respected (or chronology when relevance ordering is off), strongest evidence early.
  const expectedOrder = orderForTrack(doc, track, [...new Set(items.filter((i) => i.capability).map((i) => i.capability))]);
  const actualExp = (doc.experience || []).map((e) => e.id);
  const expectedExp = expectedOrder.experience.map((e) => e.id);
  const orderMatches = JSON.stringify(actualExp) === JSON.stringify(expectedExp);
  const sectionMatches = (doc.sectionOrder?.[0] || "experience") === expectedOrder.sectionOrder[0];
  const chrono = isChronological(doc.experience || []);
  let relevance, relevanceNote;
  if (relevanceOrdering) { relevance = (orderMatches ? 0.7 : 0.35) + (sectionMatches ? 0.3 : 0); relevanceNote = orderMatches ? `entries follow the ${TRACKS[track]?.label || track} order` : `entries do not follow the ${TRACKS[track]?.label || track} order (${expectedExp.join(" → ")})`; if (!sectionMatches) relevanceNote += `; ${expectedOrder.sectionOrder[0] === "projects" ? "Projects should lead" : "Experience should lead"}`; }
  else { relevance = chrono ? 1 : 0.4; relevanceNote = chrono ? "chronological order is correct" : "entries are not in reverse-chronological order"; }

  // Clarity, concision, duplication, copying.
  const dupPairs = [...(doc.experience || []), ...(doc.projects || [])].flatMap((en) => duplicateBullets(en, bank).map((d) => ({ entry: en.org || en.name, a: en.bullets[d.i], b: en.bullets[d.j], reason: d.reason })));
  const weak = bullets.filter((b) => !b.strong || !b.verb).length;
  const copied = bullets.filter((b) => b.copied).length;
  const longCount = bullets.filter((b) => b.long).length;
  const clarity = Math.max(0, 1 - 0.15 * dupPairs.length - 0.1 * weak - 0.15 * copied - 0.03 * longCount);

  const present = { required: reqPlus.length > 0, preferred: pref.length > 0, strength: true, relevance: true, clarity: true };
  const totalPresent = Object.entries(WEIGHTS).filter(([k]) => present[k]).reduce((a, [, w]) => a + w, 0);
  const w = Object.fromEntries(Object.entries(WEIGHTS).map(([k, v]) => [k, present[k] ? (v * 100) / totalPresent : 0]));
  const components = {
    required: { weight: w.required, value: reqCov ?? 0, label: `${count(req, "matched")}/${req.length} required matched (+${count(req, "partially_matched")} partial); responsibilities ${count(resp, "matched")}/${resp.length} (+${count(resp, "partially_matched")} partial) at half weight` },
    preferred: { weight: w.preferred, value: cov(pref) ?? 0, label: pref.length ? `${count(pref, "matched")}/${pref.length} preferred matched (+${count(pref, "partially_matched")} partial)` : "none in posting" },
    strength: { weight: w.strength, value: strength, label: `match strength ${matchStrength.toFixed(2)} (direct > equivalent > partial), bullet specificity ${specificity.toFixed(2)}${unsupported ? `, ${unsupported} unsupported claim${unsupported > 1 ? "s" : ""}` : ""}` },
    relevance: { weight: w.relevance, value: relevance, label: relevanceNote },
    clarity: { weight: w.clarity, value: clarity, label: `${dupPairs.length} duplicate pair${dupPairs.length === 1 ? "" : "s"}, ${weak} weak bullet${weak === 1 ? "" : "s"}, ${copied} copied from posting, ${longCount} over 180 chars` },
  };
  for (const c of Object.values(components)) c.points = c.weight * c.value;
  let readiness = Math.round(Object.values(components).reduce((a, c) => a + c.points, 0));
  if (unsupported > 0) readiness = Math.min(readiness, 60);
  const atsPool = scorable;
  const ats = atsPool.length ? Math.round((atsPool.reduce((a, i) => a + STATUS_VALUE[i.status], 0) / atsPool.length) * 100) : 0;

  return {
    version: SCORING_VERSION, track, trackLabel: TRACKS[track]?.label || track,
    score: readiness, readiness, ats, components, items,
    counts: { scorable: scorable.length, matched: count(scorable, "matched"), partially_matched: count(scorable, "partially_matched"), missing: count(scorable, "missing"), not_scorable: items.length - scorable.length },
    missing: scorable.filter((i) => i.status === "missing"),
    partial: scorable.filter((i) => i.status === "partially_matched"),
    notScorable: items.filter((i) => i.status === "not_scorable"),
    bullets, duplicates: dupPairs, expectedOrder: expectedExp, sectionOrderExpected: expectedOrder.sectionOrder, chronological: chrono,
    ranked: rankEntries(doc, [...new Set(items.filter((i) => i.capability).map((i) => i.capability))], track),
    explanation: `Recruiter-readiness ${readiness}/100 = ${Object.entries(components).filter(([, c]) => c.weight > 0).map(([k, c]) => `${k} ${c.weight.toFixed(0)}×${c.value.toFixed(2)}`).join(" + ")}${unsupported ? " (capped at 60 while unsupported claims remain)" : ""}. ATS coverage ${ats}/100 = matched + ½ partial over ${atsPool.length} scorable items. Internal estimates, not an employer's decision.`,
  };
}
function count(arr, status) { return arr.filter((i) => i.status === status).length; }

// ── Quality control before export ───────────────────────────────────────
// severity "block" prevents export; "warn" allows it with a notice.
function qualityControl(doc, { jd = "", bank = null, pdf = null, relevanceOrdering = true } = {}) {
  const issues = [];
  const add = (severity, message) => issues.push({ severity, message });
  if (pdf) { if (pdf.overflow || (pdf.pages && pdf.pages > 1)) add("block", "Résumé runs past one page — remove or shorten a bullet."); if (pdf.clipped?.length) add("warn", `Text was truncated to fit: ${pdf.clipped.join("; ")}`); }
  const entries = [...(doc.experience || []), ...(doc.projects || [])];
  const facts = new Map((bank?.entries || []).flatMap((e) => e.facts.map((f) => [f.id, { f, e }])));
  const bankEntries = new Map((bank?.entries || []).map((e) => [e.id, e]));
  for (const en of entries) {
    const be = bankEntries.get(en.id);
    if (be) {
      const title = en.role || (en.tech || "").split("|")[0].trim();
      const allowed = [be.role, ...(be.altTitles || [])].map((t) => t.trim());
      if (title && !allowed.includes(title.trim())) add("block", `${en.org || en.name}: title “${title}” is not a verified title (allowed: ${allowed.join(" / ")}).`);
      if (en.dates && en.dates !== be.dates) add("block", `${en.org || en.name}: dates “${en.dates}” differ from the verified “${be.dates}”.`);
    }
    (en.bullets || []).forEach((b, i) => {
      if (!b || !b.trim()) { add("warn", `${en.org || en.name}: empty bullet ${i + 1}.`); return; }
      const fid = (en.factIds || [])[i];
      const src = fid ? facts.get(fid) : null;
      if (src) { const g = factGuard(b, src.f, src.e, bank); if (!g.ok) add("block", `${en.org || en.name}, bullet ${i + 1}: ${g.problems.join("; ")}.`); }
      else if (be) add("warn", `${en.org || en.name}, bullet ${i + 1} was typed by hand and is not tied to a verified fact — make sure it is true.`);
      const q = bulletQuality(b); if (!q.strong) add("warn", `${en.org || en.name}, bullet ${i + 1}: weak phrasing.`);
      if (b.length > 200) add("warn", `${en.org || en.name}, bullet ${i + 1}: ${b.length} characters — consider trimming.`);
      if (copiedFromPosting(b, jd)) add("warn", `${en.org || en.name}, bullet ${i + 1} repeats a phrase from the posting nearly verbatim.`);
      if (/\s{2,}/.test(b) || /\b(\w+)\s+\1\b/i.test(b)) add("warn", `${en.org || en.name}, bullet ${i + 1}: doubled word or spacing.`);
      if (/^[a-z]/.test(b.trim())) add("warn", `${en.org || en.name}, bullet ${i + 1} starts with a lowercase letter.`);
    });
    for (const d of duplicateBullets(en, bank)) add("warn", `${en.org || en.name}: bullets ${d.i + 1} and ${d.j + 1} ${d.reason}.`);
  }
  if (!relevanceOrdering && !isChronological(doc.experience || [])) add("warn", "Experience is not in reverse-chronological order.");
  const p = doc.profile || {};
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(p.email || "")) add("warn", "Email address looks malformed.");
  if (!/linkedin\.com\/in\/[a-z0-9-]+/i.test(p.linkedin || "")) add("warn", "LinkedIn URL is not a linkedin.com/in/ link.");
  if (!/\d{3}[-. ]?\d{3}[-. ]?\d{4}/.test(p.phone || "")) add("warn", "Phone number looks malformed.");
  return { issues, blocked: issues.some((i) => i.severity === "block"), warnings: issues.filter((i) => i.severity === "warn").length };
}

function applicationVerdict(result, qc) {
  if (!result) return { verdict: "Not ready", why: "no evaluation yet" };
  if (qc?.blocked) return { verdict: "Not ready", why: "export is blocked by an unsupported claim, altered title/dates, or overflow" };
  const missingReq = result.items.filter((i) => i.category === "required_qualification" && i.status === "missing").length;
  if (result.readiness >= 75 && missingReq === 0 && (qc?.warnings || 0) <= 2) return { verdict: "Ready", why: `readiness ${result.readiness}, no missing required qualifications` };
  return { verdict: "Ready with caveats", why: `${missingReq} missing required qualification${missingReq === 1 ? "" : "s"}, readiness ${result.readiness}, ${qc?.warnings || 0} warning${(qc?.warnings || 0) === 1 ? "" : "s"}` };
}

// ── Questions the candidate can answer (never auto-filled) ──────────────
// A question is a gap the whole evidence bank can't back. What the candidate answers is their own
// claim: it is drafted into a bullet, reviewed by them, and stored as a fact — nothing is inferred.
const questionKey = (item) => (item.capability ? `cap:${item.capability}` : `stmt:${normalize(item.statement || item.label || "").slice(0, 80)}`);
const isDeclined = (bank, key) => (bank?.declined || []).some((d) => d.key === key);
const isAnswered = (bank, key) => (bank?.answered || []).includes(key);

function suggestedQuestionItems(result, bank) {
  const out = []; const seen = new Set();
  for (const i of result?.missing || []) {
    if (i.verdict !== "Needs candidate confirmation") continue;
    const key = questionKey(i);
    if (seen.has(key) || isDeclined(bank, key) || isAnswered(bank, key)) continue;
    seen.add(key);
    out.push({ key, source: "posting", label: i.label || i.statement, statement: i.statement, capability: i.capability || null });
  }
  for (const e of bank?.entries || []) for (const q of e.needsConfirmation || []) {
    const key = `nc:${e.id}:${normalize(q).slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, source: "bank", entryId: e.id, label: `${e.org}: ${q}`, statement: q, question: q, capability: null });
  }
  return out;
}
const questionText = (q) => (q.source === "bank" ? q.label : `Do you have experience with “${q.label}”? If so: where, when, and any numbers.`);
function suggestedQuestions(result, bank) { return suggestedQuestionItems(result, bank).map(questionText); }

// Merges the candidate's saved answers into a bank without mutating it. Idempotent by fact id, so the
// same answers can be re-applied to a newer built-in bank and never duplicate.
function applyAnswers(bank, overlay) {
  if (!bank || !overlay) return bank;
  const out = JSON.parse(JSON.stringify(bank));
  for (const { entryId, fact } of overlay.facts || []) {
    const e = out.entries.find((x) => x.id === entryId);
    if (!e || !fact?.id || e.facts.some((f) => f.id === fact.id)) continue;
    e.facts.push(JSON.parse(JSON.stringify(fact)));
  }
  for (const r of overlay.resolved || []) {
    const e = out.entries.find((x) => x.id === r.entryId);
    if (e) e.needsConfirmation = (e.needsConfirmation || []).filter((q) => q !== r.question);
  }
  const declined = [...(out.declined || [])];
  for (const d of overlay.declined || []) if (!declined.some((x) => x.key === d.key)) declined.push({ key: d.key, label: d.label });
  if (declined.length) out.declined = declined;
  const answered = [...new Set([...(out.answered || []), ...(overlay.answered || [])])];
  if (answered.length) out.answered = answered;
  return out;
}

// Numbers and tools a piece of text itself states — what a fact built from it is allowed to mention.
function statedTerms(text) {
  const t = String(text || "");
  const metrics = [];
  for (const m of t.matchAll(/\d[\d,]*(?:\.\d+)?\s*(?:%|\+|k|x|-day|-week|-month)?/gi)) if (normalizeMetric(m[0])) metrics.push(m[0].trim());
  const tools = [];
  for (const m of t.matchAll(TOOL_WORDS)) {
    if (m[0].toLowerCase() === "r" && !/\bin R\b|\busing R\b|\bR\b(?= using|,| and)/.test(t)) continue;
    tools.push(m[0]);
  }
  return { metrics: [...new Set(metrics)], tools: [...new Set(tools)] };
}

// A model-drafted bullet may only contain numbers and tools the candidate's own answer contains.
function validateDraft(draft, answer) {
  const text = String(draft || "").trim();
  if (!text) return { ok: false, problems: ["empty draft"] };
  const problems = [];
  if (text.length > 220) problems.push("longer than 220 characters");
  const ans = String(answer || "");
  const answerNums = [...ans.matchAll(/\d[\d,]*(?:\.\d+)?\s*(?:%|\+|k|x)?/gi)].map((m) => normalizeMetric(m[0])).filter(Boolean);
  const { metrics, tools } = statedTerms(text);
  for (const m of metrics) {
    const n = normalizeMetric(m);
    if (!answerNums.some((a) => a === n || a.replace(/\+$/, "") === n.replace(/\+$/, ""))) problems.push(`number “${m}” is not in your answer`);
  }
  for (const t of tools) {
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i").test(ans)) problems.push(`tool “${t}” is not in your answer`);
  }
  return { ok: problems.length === 0, problems };
}

// Capabilities the text itself evidences — used to tag a new fact so tailoring can find it.
function inferTags(text) {
  const units = resumeUnits({ experience: [{ org: "x", bullets: [text] }], projects: [], education: {}, skills: {} });
  return Object.keys(CAPABILITIES).filter((id) => !CAPABILITIES[id].section && !CAPABILITIES[id].degreeLevel && evaluateCapability(id, units).status === "matched");
}

// ── Fact guard for tailored output ──────────────────────────────────────
// A rephrased bullet may only contain numbers and tools that its source fact
// (or the source entry) verifies. Returns {ok, problems[]}.
const TOOL_WORDS = /\b(python|sql|r|swift|rust|java|javascript|typescript|c\+\+|go|scala|spark|pyspark|tableau|power bi|looker|figma|jira|excel|aws|azure|gcp|docker|kubernetes|tensorflow|pytorch|scikit-learn|pandas|numpy|postgresql|mysql|mongodb|firebase|react|node\.js|ios|android|kotlin|llm|etl|airflow|dbt|snowflake|bigquery|redshift|git)\b/gi;

function factGuard(bullet, fact, entry, bank) {
  const problems = [];
  const allowedMetrics = new Set([...(fact?.metrics || []), ...(entry?.verifiedMetrics || [])].map((m) => normalizeMetric(m)));
  for (const m of String(bullet).matchAll(/\d[\d,]*(?:\.\d+)?\s*(?:%|\+|k|x|-day|-week|-month)?/gi)) {
    const norm = normalizeMetric(m[0]);
    if (!norm) continue;
    if (![...allowedMetrics].some((a) => a === norm || a.replace(/\+$/, "") === norm.replace(/\+$/, ""))) problems.push(`metric “${m[0].trim()}” is not verified for this fact`);
  }
  const allowedTools = new Set([...(fact?.tools || []), ...(entry?.verifiedTools || [])].map((t) => t.toLowerCase()));
  for (const m of String(bullet).matchAll(TOOL_WORDS)) {
    const t = m[0].toLowerCase();
    if (t === "r" && !/\bin R\b|\busing R\b|\bR\b(?= using|,| and)/.test(bullet)) continue;
    if (!allowedTools.has(t) && !/\b(etl)\b/.test(t)) problems.push(`tool “${m[0]}” is not verified for this fact`);
  }
  for (const p of [...(entry?.prohibited || []), ...(bank?.prohibited || [])]) {
    const key = p.replace(/[^a-z0-9 ]/gi, " ").trim().split(/\s+/).slice(0, 2).join(" ");
    if (key && normalize(bullet).includes(normalize(key))) problems.push(`prohibited: ${p}`);
  }
  return { ok: problems.length === 0, problems };
}
function normalizeMetric(m) { const s = String(m).toLowerCase().replace(/\s+/g, "").replace(/,/g, ""); return /\d/.test(s) ? s : ""; }

// ── Outreach validation ─────────────────────────────────────────────────
const NOTE_LIMIT = 300;
const BANNED_OUTREACH = /\b(flag (my|the|this) (application|resume|résumé)|flag (it|me) internally|internally flag|15[- ]?minute|15 min|quick call|hop on a call|jump on a call|grab (coffee|time)|schedule a (call|chat|meeting))\b/i;
const VALUE_PROP = /\b(goalkeeper|100\+ athletes|30%|session duration|a\/b|experiment|product strategy|user research|berkeley)\b/i;

function fillName(text, name) {
  const t = String(text || "");
  if (name && name.trim()) return t.replace(/\{\{\s*name\s*\}\}|\[Name\]|\[name\]/g, name.trim());
  // name-free version: drop the salutation token cleanly
  return t.replace(/^(hi|hello|hey|dear)\s*(\{\{\s*name\s*\}\}|\[Name\]|\[name\])\s*[,—-]?\s*/i, "Hi — ").replace(/\{\{\s*name\s*\}\}|\[Name\]|\[name\]/g, "").replace(/\s{2,}/g, " ").trim();
}

function shortenNote(text, limit = NOTE_LIMIT) {
  let t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= limit) return t;
  // Drop sentences from the end, never one carrying the value proposition, until it fits.
  let sentences = t.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) || [t];
  while (t.length > limit && sentences.length > 1) {
    let idx = -1;
    for (let i = sentences.length - 1; i >= 1; i--) if (!VALUE_PROP.test(sentences[i])) { idx = i; break; }
    if (idx < 0) idx = sentences.length - 1;
    sentences.splice(idx, 1);
    t = sentences.join(" ");
  }
  if (t.length > limit) { t = t.slice(0, limit - 1); t = t.slice(0, Math.max(t.lastIndexOf(" "), 0)).replace(/[,;:—-]\s*$/, "") + "."; }
  return t;
}

function validateNote(text, { limit = NOTE_LIMIT, name = "" } = {}) {
  let t = fillName(text, name);
  const issues = [];
  if (BANNED_OUTREACH.test(t)) { issues.push("removed a pushy or inappropriate ask"); t = t.replace(/[^.!?]*(?:flag|15[- ]?minute|15 min|quick call|hop on a call|jump on a call|grab (?:coffee|time)|schedule a (?:call|chat|meeting))[^.!?]*[.!?]?/gi, "").replace(/\s{2,}/g, " ").trim(); }
  if (/\[name\]|\{\{\s*name\s*\}\}/i.test(t)) { issues.push("unfilled name placeholder"); t = fillName(t, ""); }
  if (t.length > limit) { issues.push(`shortened from ${t.length} to fit ${limit}`); t = shortenNote(t, limit); }
  return { text: t, length: t.length, ok: t.length <= limit && !BANNED_OUTREACH.test(t) && !/\[name\]/i.test(t), issues, hasValueProp: VALUE_PROP.test(t) };
}

const api = { SCORING_VERSION, WEIGHTS, CATEGORIES, CAPABILITIES, ROLE_WEIGHTS, TRACKS, TRACK_ORDER, TRACK_SKILL_PRIORITY, TRACK_CAP_WEIGHTS, classifyTrack, detectRoleType, orderForTrack, isChronological, duplicateBullets, dedupeSelection, copiedFromPosting, selectFacts, selectSkills, classifySkillGroup, regroupSkills, questionKey, isDeclined, suggestedQuestionItems, questionText, applyAnswers, statedTerms, validateDraft, inferTags, missingVerdict, qualityControl, applicationVerdict, suggestedQuestions, jaccard, evaluate, evaluateCapability, classify, bulletQuality, rankEntries, resumeUnits, factGuard, validateNote, shortenNote, fillName, NOTE_LIMIT, BANNED_OUTREACH };
if (typeof module !== "undefined") module.exports = api;
if (typeof window !== "undefined") window.Scoring = api;
