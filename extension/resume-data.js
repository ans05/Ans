// Verified evidence bank — the single source of truth for résumé facts.
//
// Every fact here has been confirmed by the candidate. The tailoring model may
// select, shorten, reorder, and rephrase facts; it may NOT invent titles,
// employers, dates, tools, metrics, audience sizes, stakeholders, experiments,
// deliverables, or results. `metrics` and `tools` list what a rephrased bullet
// is allowed to contain; anything else is rejected by the fact guard.
// `tags` name the competencies each fact supports (closed vocabulary in
// web/scoring.js CAPABILITIES). `needsConfirmation` lists claims that were
// asked about and not confirmed; `prohibited` lists extrapolations to refuse.

const EVIDENCE_BANK = {
  version: 2,
  // Applies to every entry, regardless of which one a bullet is under — confirmed 2026-09-30:
  // don't claim these tools until explicitly confirmed, even if a future edit adds them elsewhere.
  prohibited: ["Microsoft PowerPoint", "Microsoft Word", "Jira"],
  profile: {
    name: "Aneesh Srirambhatla",
    phone: "424-390-9605",
    email: "aneeshsri@berkeley.edu",
    linkedin: "linkedin.com/in/aneesh-sri",
  },
  education: {
    school: "University of California, Berkeley",
    grad: "Expected Graduation: Dec 2027",
    degree: "B.A. Data Science | Certificate in Entrepreneurship & Technology",
    field: "Data Science",
    coursework:
      "Data Structures & Algorithms, Foundations of Data Science, Statistical Analysis, Computational Structures in Data Science, Python Programming, Data Engineering",
  },
  entries: [
    {
      id: "siemens",
      altTitles: [],
      kind: "experience",
      org: "Siemens Healthineers",
      role: "Product & Strategy Consultant (Contract)",
      location: "Berkeley, CA",
      dates: "Jan 2026 – May 2026",
      verifiedMetrics: ["8+", "90-day", "3"],
      verifiedTools: [],
      tags: ["product_strategy_roadmap", "market_research", "competitive_analysis", "cross_functional_collaboration", "user_research", "stakeholder_communication"],
      needsConfirmation: [],
      prohibited: ["presented to leadership/directors", "provider journeys", "revenue or adoption figures", "team size"],
      facts: [
        { id: "siemens.roadmap", result: "90-day roadmap", text: "Built a prioritized 90-day activation roadmap for the theranostics business from customer-journey, workflow, and adoption-barrier research across 8+ organizations", metrics: ["90-day", "8+"], tools: [], tags: ["product_strategy_roadmap", "user_research", "market_research"] },
        { id: "siemens.competitive", result: "competitive positioning", text: "Mapped patient advocacy networks and competitive positioning across 8+ organizations to find growth opportunities for the theranostics business", metrics: ["8+"], tools: [], tags: ["competitive_analysis", "market_research"] },
        { id: "siemens.partnerships", result: "partnership priorities", text: "Ranked partnership priorities across multiple product lines using workflow and adoption-barrier findings from 8+ organizations", metrics: ["8+"], tools: [], tags: ["market_research", "product_strategy_roadmap"] },
        { id: "siemens.crossfn", text: "Developed data-informed patient engagement strategies with clinical, marketing, and product teams to improve treatment access and navigation", metrics: ["3"], tools: [], tags: ["cross_functional_collaboration", "stakeholder_communication", "product_strategy_roadmap"] },
        { id: "siemens.journey", text: "Documented patient journeys across 8+ organizations to find what was blocking theranostics adoption", metrics: ["8+"], tools: [], tags: ["user_research"] },
      ],
    },
    {
      id: "mercor",
      kind: "experience",
      org: "Mercor",
      role: "AI Developer",
      location: "San Francisco, CA",
      dates: "Jan 2025 – Jun 2025",
      verifiedMetrics: ["500+", "15,000+", "15%"],
      verifiedTools: ["LLM"],
      altTitles: ["AI Growth Intern"],
      tags: ["ml_evaluation", "data_analysis", "process_improvement"],
      needsConfirmation: [],
      prohibited: ["BigQuery", "inter-rater consistency work", "model accuracy numbers", "the 10,000+ prediction pipeline (that work is FlourishAI's, confirmed, not Mercor's)", "coordinating or calibrating multiple reviewers"],
      facts: [
        { id: "mercor.eval", result: "500+ responses scored", text: "Evaluated 500+ LLM responses for correctness and instruction-following and identified recurring failure patterns that fed into model improvements", metrics: ["500+"], tools: ["LLM"], tags: ["ml_evaluation", "data_analysis", "ai_evaluation"] },
        { id: "mercor.data", text: "Wrote examples for a 15,000+ response training dataset used to improve model behavior and evaluation quality", metrics: ["15,000+"], tools: [], tags: ["ml_evaluation"] },
        { id: "mercor.process", result: "15% workflow", text: "Redesigned the evaluation workflow for 500+ LLM responses after analyzing performance, which raised throughput by about 15% while keeping scoring consistent", metrics: ["500+", "15%"], tools: ["LLM"], tags: ["process_improvement", "data_analysis"] },
        { id: "mercor.rubrics", result: "500+ responses scored", text: "Graded 500+ LLM outputs on accuracy, helpfulness, and safety using scoring rubrics", metrics: ["500+"], tools: ["LLM"], tags: ["ml_evaluation"] },
        { id: "mercor.errors", result: "failure taxonomy", text: "Categorized failure modes across 500+ responses into a taxonomy that became guidance for refining the model", metrics: ["500+"], tools: [], tags: ["ml_evaluation", "data_analysis"] },
      ],
    },
    {
      id: "haas",
      altTitles: [],
      kind: "experience",
      org: "Haas School of Business Lab",
      role: "Data Science Research Assistant",
      location: "Berkeley, CA",
      dates: "Feb 2025 – Aug 2026",
      verifiedMetrics: ["1,000+", "481", "10+", "20+", "2", "5-10"],
      verifiedTools: ["R", "Power BI"],
      tags: ["statistics", "experimentation", "user_research", "data_analysis", "stakeholder_communication", "r_language", "qualitative_research", "forecasting", "dashboards"],
      needsConfirmation: [],
      prohibited: ["sole ownership of study design (co-designed only)", "publication claims", "equating '1,000+ responses' with '1,000+ participants' (responses ≠ unique participants)", "a specific number of studies not stated in a fact", "specific forecast accuracy numbers (not documented)"],
      facts: [
        { id: "haas.hypotheses", result: "1,000+ regression", text: "Turned open-ended behavioral research questions into testable hypotheses, then analyzed 1,000+ participant responses in R using regression", metrics: ["1,000+"], tools: ["R"], tags: ["statistics", "data_analysis", "experimentation", "r_language"] },
        { id: "haas.factors", text: "Examined 10+ factors that influence leadership and group behavior under Professors Cameron Anderson and Angus Hildreth", metrics: ["10+"], tools: [], tags: ["user_research", "statistics"] },
        { id: "haas.pilots", text: "Co-designed and ran pilot behavioral studies in Berkeley's BLab research network, testing 10+ leadership and group-behavior factors", metrics: ["10+"], tools: [], tags: ["experimentation", "user_research"] },
        { id: "haas.regression", result: "1,000+ regression", text: "Fit regression models in R to 1,000+ participant responses; the findings shaped the design of follow-on studies", metrics: ["1,000+"], tools: ["R"], tags: ["statistics", "data_analysis", "r_language"] },
        { id: "haas.coding", result: "481 coded", text: "Coded 481 open-ended participant responses into a structured codebook so they could be analyzed as categories", metrics: ["481"], tools: [], tags: ["qualitative_research", "user_research", "data_analysis"] },
        { id: "haas.independent", text: "Initiated 2 self-directed projects: a 20+ data-point analysis of leadership-seeking strategies in political debates, and a study of how AI tools affect research productivity", metrics: ["2", "20+"], tools: [], tags: ["initiative", "data_analysis"] },
        { id: "haas.comms", text: "Presented data-driven stories through written reports and slide presentations, explaining behavioral research findings and statistical analyses to 2 faculty researchers and interdisciplinary teams", metrics: ["2"], tools: [], tags: ["stakeholder_communication", "written_communication", "cross_functional_collaboration"] },
        { id: "haas.forecasting", text: "Built Power BI dashboards to forecast sales and engagement trends", metrics: [], tools: ["Power BI"], tags: ["forecasting", "dashboards", "data_visualization"] },
      ],
    },
    {
      id: "flourish",
      altTitles: [],
      kind: "experience",
      org: "FlourishAI (Berkeley SkyDeck FA 24)",
      role: "Software Engineer Intern",
      location: "Berkeley, CA",
      dates: "Dec 2024 – Aug 2025",
      verifiedMetrics: ["100+", "15%", "25%", "10+", "10,000+"],
      verifiedTools: ["Python", "SQL"],
      tags: ["data_engineering", "sql", "python", "ml_evaluation", "user_research", "product_launch", "recommendation_systems"],
      needsConfirmation: [],
      prohibited: ["'replaced manual curation'", "instrumented engagement tracking", "defining engagement as retention/sessions/time"],
      facts: [
        { id: "flourish.etl", result: "ETL 100+ sources", text: "Built a Python and SQL ETL pipeline that ingests, cleans, and validates data from 100+ research sources", metrics: ["100+"], tools: ["Python", "SQL", "ETL"], tags: ["data_engineering", "sql", "python"] },
        { id: "flourish.recsys", result: "recsys platform", text: "Built and launched a personalized nutrition recommendation platform, using user needs and expert-labeled data to shape the experience for end users", metrics: [], tools: [], tags: ["product_launch", "recommendation_systems", "user_research", "product_decisions"] },
        { id: "flourish.eval", result: "15% accuracy / 25% engagement", text: "Benchmarked recommendations against expert-labeled references, then used the error analysis to make product changes that improved accuracy by 15% and engagement by 25%", metrics: ["15%", "25%"], tools: [], tags: ["ml_evaluation", "data_analysis", "product_decisions", "product_analytics"] },
        { id: "flourish.feedback", text: "Incorporated feedback from 10+ SkyDeck startup seminars into agile sprints, keeping prototypes aligned with user needs and business strategy", metrics: ["10+"], tools: [], tags: ["user_research", "product_iteration"] },
        { id: "flourish.pipelines", result: "10,000+ predictions", text: "Built automated data pipelines that supported 10,000+ recommendation predictions", metrics: ["10,000+"], tools: [], tags: ["data_engineering", "scale"] },
      ],
    },
    {
      id: "goalkeeper",
      altTitles: [],
      kind: "project",
      org: "Project GoalKeeper",
      role: "Founder & Product Lead",
      tech: "iOS, Swift, A/B Testing, Product Analytics",
      location: "Los Angeles, CA",
      dates: "May 2024 – Aug 2025",
      verifiedMetrics: ["100+", "30%"],
      verifiedTools: ["iOS", "Swift"],
      tags: ["product_ownership", "experimentation", "product_launch", "product_analytics", "user_research", "product_strategy_roadmap", "partnership", "mobile"],
      needsConfirmation: [],
      prohibited: ["App Store release", "download counts", "number of A/B tests", "revenue", "A/B test duration or timeline (not documented)", "statistical significance claims (not calculated)"],
      facts: [
        { id: "gk.abtests", result: "30% session duration", text: "Designed and analyzed A/B tests for an iOS app used by 100+ athletes, and used the results to make feature decisions that increased average session duration by 30%", metrics: ["100+", "30%"], tools: ["iOS"], tags: ["experimentation", "product_analytics", "product_decisions"] },
        { id: "gk.launch", result: "shipped app 100+", text: "Built and shipped an iOS app from idea to launch that applies sports psychology techniques to athletic performance for 100+ athletes", metrics: ["100+"], tools: ["iOS", "Swift"], tags: ["product_launch", "product_ownership", "mobile"] },
        { id: "gk.nami", result: "NAMI partnership", text: "Led product strategy and a partnership with the National Alliance on Mental Illness (NAMI), driving adoption to 100+ athletes and iterating on community feedback", metrics: ["100+"], tools: [], tags: ["product_strategy_roadmap", "partnership", "user_research", "product_iteration"] },
        { id: "gk.feedback", result: "feedback to requirements", text: "Gathered feedback from 100+ athletes and used it to set product requirements and prioritize feature improvements", metrics: ["100+"], tools: [], tags: ["user_research", "product_decisions", "product_specifications", "product_iteration"] },
        { id: "gk.ownership", result: "full ownership", text: "Owned the full development cycle as founder of a 100+ user product: user research, roadmap, build, launch, and iteration", metrics: ["100+"], tools: [], tags: ["product_ownership", "product_strategy_roadmap", "user_research", "product_launch"] },
      ],
    },
    {
      id: "resumetailor",
      kind: "project",
      org: "Resume Tailor",
      role: "Creator",
      tech: "JavaScript, Python, Claude API, Playwright",
      location: "",
      dates: "Sep 2026 – Present",
      verifiedMetrics: ["30+", "28", "35", "5"],
      verifiedTools: ["JavaScript", "Python", "Claude API", "Playwright", "LLM"],
      altTitles: [],
      tags: ["product_ownership", "product_launch", "ai_evaluation", "data_engineering", "python", "initiative", "quality"],
      needsConfirmation: [],
      prohibited: ["revenue", "funding", "company/team size", "specific company logos as customers", "time saved by users (not measured)", "interviews landed or other career outcomes (not measured)"],
      facts: [
        { id: "rt.core", result: "core tool", text: "Built an AI-powered resume tailoring tool used by 30+ active users to flag qualification gaps and suggest targeted improvements against job postings", metrics: ["30+"], tools: ["Claude API", "LLM"], tags: ["ai_evaluation", "product_ownership", "product_launch", "data_analysis"] },
        { id: "rt.scoring", result: "scoring engine", text: "Developed a 35-rule matching engine and 5-factor scoring system pairing Claude API reasoning with structured evidence checks to score job fit beyond keywords", metrics: ["35", "5"], tools: ["Claude API", "LLM"], tags: ["ai_evaluation", "data_analysis"] },
        { id: "rt.tests", result: "automation & tests", text: "Automated resume analysis, recommendation generation, and output validation with Claude, Python, and 28 Playwright/Node tests for faster, consistent iteration", metrics: ["28"], tools: ["Claude API", "Python", "LLM"], tags: ["quality", "python", "ai_evaluation"] },
            ],
    },
  ],
  skills: {
    Languages: "Python (pandas, NumPy), SQL, R, Swift",
    "Data & ML": "ETL pipelines, data cleaning & validation, recommendation systems, model evaluation, error analysis, LLM evaluation, PostgreSQL",
    "Analytics & Experimentation": "A/B testing, experimental design, hypothesis testing, regression analysis, qualitative coding, product analytics, forecasting",
    "Tools & Platforms": "Git, GitHub, Power BI, Tableau, Microsoft Excel, Microsoft Azure",
    "Product & Strategy": "product roadmapping, user research, competitive analysis, customer journey mapping, cross-functional collaboration",
  },
  // Every skill the candidate may list, with the evidence that backs it. Anything not here is never listed.
  // No "group" field: display grouping is derived from each skill's name (see scoring.js
  // classifySkillGroup), so it stays consistent without needing to be hand-tagged here.
  verifiedSkills: [
    { name: "Python", evidence: "flourish.etl" }, { name: "SQL", evidence: "flourish.etl" },
    { name: "R", evidence: "haas.hypotheses" }, { name: "Swift", evidence: "gk.launch" },
    { name: "pandas", evidence: "listed" }, { name: "NumPy", evidence: "listed" },
    { name: "ETL pipelines", evidence: "flourish.etl" }, { name: "data cleaning & validation", evidence: "flourish.etl" },
    { name: "recommendation systems", evidence: "flourish.recsys" }, { name: "model evaluation", evidence: "flourish.eval" },
    { name: "error analysis", evidence: "flourish.eval" }, { name: "LLM evaluation", evidence: "mercor.eval" },
    { name: "PostgreSQL", evidence: "listed" },
    { name: "A/B testing", evidence: "gk.abtests" }, { name: "experimental design", evidence: "haas.pilots" }, { name: "experiment design", evidence: "haas.pilots" },
    { name: "hypothesis testing", evidence: "haas.hypotheses" }, { name: "regression analysis", evidence: "haas.regression" },
    { name: "statistical modeling", evidence: "haas.regression" }, { name: "qualitative coding", evidence: "haas.coding" },
    { name: "product analytics", evidence: "gk.abtests" },
    { name: "product strategy", evidence: "gk.nami" }, { name: "product roadmapping", evidence: "siemens.roadmap" },
    { name: "user research", evidence: "gk.ownership" }, { name: "customer discovery", evidence: "siemens.journey" },
    { name: "customer journey mapping", evidence: "siemens.journey" }, { name: "market research", evidence: "siemens.partnerships" },
    { name: "competitive analysis", evidence: "siemens.competitive" }, { name: "experimentation", evidence: "gk.abtests" },
    { name: "cross-functional collaboration", evidence: "siemens.crossfn" },
    { name: "Git", evidence: "coursework" }, { name: "GitHub", evidence: "coursework" }, { name: "Power BI", evidence: "haas.forecasting" }, { name: "Microsoft Azure", evidence: "listed" },
    { name: "Tableau", evidence: "listed" }, { name: "Microsoft Excel", evidence: "listed" },
    { name: "forecasting", evidence: "haas.forecasting" },
  ],
  // Listed on the original résumé without a supporting bullet; kept only because the candidate confirmed them.
  // (Git/GitHub moved out: confirmed as source control used in Berkeley programming coursework — evidence "coursework".)
  unevidencedSkills: ["Microsoft Azure", "PostgreSQL", "pandas", "NumPy", "Tableau", "Microsoft Excel"],
};

// The rendered base résumé, derived from the bank so the two can never disagree.
function resumeFromBank(bank) {
  const exp = bank.entries.filter((e) => e.kind === "experience");
  const proj = bank.entries.filter((e) => e.kind === "project");
  return {
    profile: { ...bank.profile },
    education: { school: bank.education.school, grad: bank.education.grad, degree: bank.education.degree, coursework: bank.education.coursework },
    experience: exp.map((e) => ({ id: e.id, org: e.org, role: e.role, location: e.location, dates: e.dates, bullets: e.facts.map((f) => f.text), factIds: e.facts.map((f) => f.id) })),
    projects: proj.map((p) => ({ id: p.id, name: p.org, tech: `${p.role} | ${p.tech}`, dates: p.dates, bullets: p.facts.map((f) => f.text), factIds: p.facts.map((f) => f.id) })),
    skills: { ...bank.skills },
  };
}

const DEFAULT_RESUME = resumeFromBank(EVIDENCE_BANK);

if (typeof module !== "undefined") module.exports = { EVIDENCE_BANK, DEFAULT_RESUME, resumeFromBank };
