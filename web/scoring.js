// Evidence-based scoring. Pure functions, no DOM. Works in the browser
// (globals) and in Node (module.exports) so the same code is unit-tested.
//
// One canonical result from evaluate() drives every number and section the
// UI shows. Statuses: matched | partially_matched | missing | not_scorable.

const SCORING_VERSION = "3.0";

// Weights (percent). Buckets with no scorable items redistribute their weight
// proportionally to the buckets that do have items.
const WEIGHTS = { required: 50, preferred: 10, responsibility: 20, quality: 10, ordering: 10 };
const STATUS_VALUE = { matched: 1, partially_matched: 0.5, missing: 0 };

// ── Requirement categories ──────────────────────────────────────────────
// Only the first three are scored. The rest are shown separately.
const CATEGORIES = ["required_qualification", "preferred_qualification", "responsibility", "company_language", "logistics", "subjective_trait"];
const SCORED = new Set(["required_qualification", "preferred_qualification", "responsibility"]);

const SUBJECTIVE = /\b(passion(ate)?|enthusias|curious|curiosity|excited|love (of|for)|self-starter|team player|positive attitude|fun|delight|humble|hungry|scrappy|growth mindset)\b/i;
const LOGISTICS = /\b(visa|sponsor|work authoriz|authorized to work|eligib|located in|relocat|on-site|onsite|hybrid|remote|hours per week|start date|duration|stipend|hourly|salary|\$\d|background check|must be (18|able))\b/i;
const COMPANY = /\b(our mission|we are|we're|our team|join us|we believe|every day|billion people|tens of millions of people come)\b/i;
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
  forecasting: { label: "Forecasting", full: (t) => /\b(forecast\w*|time.series)\b/i.test(t), partial: (t) => /\b(predict\w*)\b/i.test(t), reasonFull: "forecasting named", reasonPartial: "predictions without forecasting" },
  data_engineering: { label: "Data pipelines", full: (t) => /\b(etl|data pipelines?|pipelines?|ingest\w*)\b/i.test(t) && VERB.build.test(t), partial: (t) => /\b(pipeline|etl)\b/i.test(t), reasonFull: "built data pipelines", reasonPartial: "pipelines mentioned" },
  ml_evaluation: { label: "Model evaluation / ML", full: (t) => /\b(model evaluation|benchmark\w*|llm|training data(set)?|error analysis|recommendation (system|platform)|machine learning|ml\b)/i.test(t), partial: (t) => /\b(model\w*)\b/i.test(t), reasonFull: "ML evaluation or system work", reasonPartial: "models mentioned" },
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
  if (LOGISTICS.test(s)) return "logistics";
  if (COMPANY.test(s) && !(item.capabilities || []).length) return "company_language";
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

// ── Relevance ranking of entries ────────────────────────────────────────
// Score each entry by how many scored capabilities its bullets evidence
// (full = 1, partial = 0.5), weighted by role type. For product roles,
// evidence of owning, shipping, and experimenting on a product outranks
// supporting analysis. Used for ordering and for tailoring emphasis.
const ROLE_WEIGHTS = {
  product: { product_ownership: 1.5, product_launch: 1.5, consumer_product: 1.5, experimentation_plans: 1.5, experimentation: 1.5, product_decisions: 1.5, product_analytics: 1.25, user_research: 1.25, product_strategy_roadmap: 1.25 },
  data: { data_analysis: 1.5, statistics: 1.5, sql: 1.5, python: 1.25, experimentation: 1.5, causal_inference: 1.5, data_engineering: 1.25, ml_evaluation: 1.25 },
  engineering: { data_engineering: 1.5, python: 1.5, sql: 1.25, product_launch: 1.25, mobile: 1.25 },
};
function detectRoleType(jd) {
  const s = String(jd || "").slice(0, 600);
  if (/\b(product manager|product management|associate product)\b|\bPM\b/i.test(s)) return "product";
  if (/\b(data scien\w*|analyst|analytics|machine learning|\bml\b)/i.test(s)) return "data";
  if (/\b(software engineer|swe|developer|engineering intern)\b/i.test(s)) return "engineering";
  return "general";
}
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

// ── The canonical evaluation ────────────────────────────────────────────
function evaluate(extracted, doc, opts = {}) {
  const roleType = opts.roleType || "general";
  const units = resumeUnits(doc);
  const items = [];
  for (const raw of extracted) {
    const category = classify(raw);
    const caps = (raw.capabilities || []).filter((c, i, a) => a.indexOf(c) === i);
    if (!SCORED.has(category)) {
      items.push({ statement: raw.statement, category, status: "not_scorable", capability: null, results: [], reason: { logistics: "eligibility/logistics — not a résumé-keyword item", company_language: "company or mission language — not a candidate requirement", subjective_trait: "subjective trait — cannot be verified from a résumé" }[category] });
      continue;
    }
    // Compound statements are scored per capability so each can be matched/partial/missing on its own.
    const capList = caps.length ? caps : ["__keywords__"];
    for (const c of capList) {
      const r = c === "__keywords__" ? evaluateCapability("__unknown__", units, raw.keywords || []) : evaluateCapability(c, units, raw.keywords || []);
      items.push({ statement: raw.statement, category, status: r.status, capability: c === "__keywords__" ? null : c, label: r.label, evidence: r.evidence, where: r.where, reason: r.reason, confidence: r.confidence, evidenceType: r.evidenceType, results: [r] });
    }
  }

  const bucket = (cat) => items.filter((i) => i.category === cat);
  const cov = (arr) => (arr.length ? arr.reduce((a, i) => a + STATUS_VALUE[i.status], 0) / arr.length : null);
  const req = bucket("required_qualification"), pref = bucket("preferred_qualification"), resp = bucket("responsibility");

  // Bullet quality
  const bullets = units.filter((u) => u.idx >= 0).map((u) => ({ where: u.where, text: u.text, ...bulletQuality(u.text) }));
  const quality = bullets.length ? bullets.filter((b) => b.pass).length / bullets.length : 1;

  // Ordering: entries with the most evidence for scored capabilities should come first
  const scoredCaps = items.filter((i) => i.capability).map((i) => i.capability);
  const ranked = rankEntries(doc, [...new Set(scoredCaps)], roleType);
  const exps = ranked.filter((r) => r.kind === "experience");
  const firstExp = doc.experience?.[0];
  const bestExp = exps[0];
  const bestOverall = ranked[0];
  const projectsFirst = doc.sectionOrder?.[0] === "projects";
  let ordering = 1, orderingNote = "strongest evidence appears first";
  if (bestExp && firstExp && bestExp.id !== (firstExp.id || firstExp.org) && bestExp.name !== firstExp.org) { ordering -= 0.5; orderingNote = `${bestExp.name} has the most evidence among experiences but is not first`; }
  if (bestOverall && bestOverall.kind === "project" && !projectsFirst && bestOverall.score > (bestExp?.score || 0)) { ordering -= 0.5; orderingNote += (ordering < 1 && orderingNote !== "strongest evidence appears first" ? "; " : "") + `${bestOverall.name} (project) is the strongest evidence but Projects is placed after Experience`; }
  ordering = Math.max(0, ordering);

  // Weights with redistribution for empty buckets
  const present = { required: req.length > 0, preferred: pref.length > 0, responsibility: resp.length > 0, quality: true, ordering: true };
  const totalPresent = Object.entries(WEIGHTS).filter(([k]) => present[k]).reduce((a, [, w]) => a + w, 0);
  const w = Object.fromEntries(Object.entries(WEIGHTS).map(([k, v]) => [k, present[k] ? (v * 100) / totalPresent : 0]));

  const components = {
    required: { weight: w.required, value: cov(req) ?? 0, label: `${count(req, "matched")} matched, ${count(req, "partially_matched")} partial, ${count(req, "missing")} missing of ${req.length} required` },
    preferred: { weight: w.preferred, value: cov(pref) ?? 0, label: pref.length ? `${count(pref, "matched")} matched, ${count(pref, "partially_matched")} partial, ${count(pref, "missing")} missing of ${pref.length} preferred` : "none in posting" },
    responsibility: { weight: w.responsibility, value: cov(resp) ?? 0, label: resp.length ? `${count(resp, "matched")} matched, ${count(resp, "partially_matched")} partial, ${count(resp, "missing")} missing of ${resp.length} responsibilities` : "none in posting" },
    quality: { weight: w.quality, value: quality, label: `${bullets.filter((b) => b.pass).length}/${bullets.length} bullets pass (strong verb + metric, or scope + outcome)` },
    ordering: { weight: w.ordering, value: ordering, label: orderingNote },
  };
  for (const c of Object.values(components)) c.points = c.weight * c.value;
  const score = Math.round(Object.values(components).reduce((a, c) => a + c.points, 0));

  const scorable = items.filter((i) => i.status !== "not_scorable");
  return {
    version: SCORING_VERSION,
    score,
    components,
    items,
    counts: {
      scorable: scorable.length,
      matched: count(scorable, "matched"),
      partially_matched: count(scorable, "partially_matched"),
      missing: count(scorable, "missing"),
      not_scorable: items.length - scorable.length,
    },
    missing: scorable.filter((i) => i.status === "missing"),
    partial: scorable.filter((i) => i.status === "partially_matched"),
    notScorable: items.filter((i) => i.status === "not_scorable"),
    bullets,
    ranked,
    explanation: `Evidence Match Score ${score}/100 = ${Object.entries(components).filter(([, c]) => c.weight > 0).map(([k, c]) => `${k} ${c.weight.toFixed(0)}×${c.value.toFixed(2)}`).join(" + ")}. Internal evidence-coverage estimate; not a prediction of any employer's ATS or interview outcome.`,
  };
}
function count(arr, status) { return arr.filter((i) => i.status === status).length; }

// ── Fact guard for tailored output ──────────────────────────────────────
// A rephrased bullet may only contain numbers and tools that its source fact
// (or the source entry) verifies. Returns {ok, problems[]}.
const TOOL_WORDS = /\b(python|sql|r|swift|rust|java|javascript|typescript|c\+\+|go|scala|spark|pyspark|tableau|power bi|looker|figma|jira|excel|aws|azure|gcp|docker|kubernetes|tensorflow|pytorch|scikit-learn|pandas|numpy|postgresql|mysql|mongodb|firebase|react|node\.js|ios|android|kotlin|llm|etl|airflow|dbt|snowflake|bigquery|redshift|git)\b/gi;

function factGuard(bullet, fact, entry) {
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
  for (const p of entry?.prohibited || []) {
    const key = p.replace(/[^a-z0-9 ]/gi, " ").trim().split(/\s+/).slice(0, 2).join(" ");
    if (key && normalize(bullet).includes(normalize(key))) problems.push(`prohibited extrapolation: ${p}`);
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

const api = { SCORING_VERSION, WEIGHTS, CATEGORIES, CAPABILITIES, ROLE_WEIGHTS, detectRoleType, evaluate, evaluateCapability, classify, bulletQuality, rankEntries, resumeUnits, factGuard, validateNote, shortenNote, fillName, NOTE_LIMIT, BANNED_OUTREACH };
if (typeof module !== "undefined") module.exports = api;
if (typeof window !== "undefined") window.Scoring = api;
