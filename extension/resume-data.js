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
  prohibited: ["Microsoft PowerPoint", "Microsoft Word"],
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
      "Data Structures & Algorithms, Foundations of Data Science, Statistical Analysis, Computational Structures in Data Science, Python Programming",
  },
  entries: [
    {
      id: "siemens",
      altTitles: [],
      kind: "experience",
      org: "Siemens Healthineers",
      role: "Product & Strategy Intern",
      location: "Berkeley, CA",
      dates: "Jan 2026 – May 2026",
      verifiedMetrics: ["8+", "90-day", "3"],
      verifiedTools: [],
      tags: ["product_strategy_roadmap", "market_research", "competitive_analysis", "cross_functional_collaboration", "user_research", "stakeholder_communication"],
      needsConfirmation: [],
      prohibited: ["presented to leadership/directors", "provider journeys", "revenue or adoption figures", "team size"],
      facts: [
        { id: "siemens.roadmap", result: "90-day roadmap", text: "Built a prioritized 90-day activation roadmap for the theranostics business from customer-journey, workflow, and adoption-barrier research across 8+ organizations", metrics: ["90-day", "8+"], tools: [], tags: ["product_strategy_roadmap", "user_research", "market_research"] },
        { id: "siemens.competitive", result: "competitive positioning", text: "Mapped patient advocacy networks and competitive positioning across 8+ organizations, surfacing strategic growth opportunities for the theranostics business", metrics: ["8+"], tools: [], tags: ["competitive_analysis", "market_research"] },
        { id: "siemens.partnerships", result: "partnership priorities", text: "Distilled workflow and adoption-barrier findings from 8+ organizations into ranked partnership priorities spanning multiple product lines", metrics: ["8+"], tools: [], tags: ["market_research", "product_strategy_roadmap"] },
        { id: "siemens.crossfn", text: "Developed data-informed patient engagement strategies with clinical, marketing, and product teams to improve treatment access and navigation", metrics: ["3"], tools: [], tags: ["cross_functional_collaboration", "stakeholder_communication", "product_strategy_roadmap"] },
        { id: "siemens.journey", text: "Documented patient journeys across 8+ organizations to pinpoint the friction points blocking theranostics adoption", metrics: ["8+"], tools: [], tags: ["user_research"] },
      ],
    },
    {
      id: "mercor",
      kind: "experience",
      org: "Mercor",
      role: "AI Growth Intern",
      location: "San Francisco, CA",
      dates: "Jan 2025 – Jun 2025",
      verifiedMetrics: ["500+", "15,000+", "15%"],
      verifiedTools: ["LLM"],
      altTitles: [],
      tags: ["ml_evaluation", "data_analysis", "process_improvement"],
      needsConfirmation: [],
      prohibited: ["BigQuery", "inter-rater consistency work", "model accuracy numbers", "the 10,000+ prediction pipeline (that work is FlourishAI's, confirmed, not Mercor's)", "coordinating or calibrating multiple reviewers"],
      facts: [
        { id: "mercor.eval", result: "500+ responses scored", text: "Evaluated 500+ LLM responses against correctness and instruction-following criteria, isolating recurring failure patterns that fed directly into model improvements", metrics: ["500+"], tools: ["LLM"], tags: ["ml_evaluation", "data_analysis", "ai_evaluation"] },
        { id: "mercor.data", text: "Authored high-signal examples for a 15,000+ response training dataset used to refine model behavior and raise evaluation quality", metrics: ["15,000+"], tools: [], tags: ["ml_evaluation"] },
        { id: "mercor.process", result: "15% workflow", text: "Redesigned the evaluation workflow for 500+ LLM responses after a performance analysis, improving throughput by approximately 15% while keeping scoring consistent", metrics: ["500+", "15%"], tools: ["LLM"], tags: ["process_improvement", "data_analysis"] },
        { id: "mercor.rubrics", result: "500+ responses scored", text: "Applied structured, multi-criteria scoring rubrics to 500+ LLM outputs to grade accuracy, helpfulness, and safety", metrics: ["500+"], tools: ["LLM"], tags: ["ml_evaluation"] },
        { id: "mercor.errors", result: "failure taxonomy", text: "Categorized failure modes across 500+ responses into a taxonomy that became concrete guidance for model refinement", metrics: ["500+"], tools: [], tags: ["ml_evaluation", "data_analysis"] },
      ],
    },
    {
      id: "haas",
      altTitles: [],
      kind: "experience",
      org: "Haas School of Business Lab",
      role: "Undergraduate Research Assistant (URAP) — Social Psychology & Business Lab",
      location: "Berkeley, CA",
      dates: "Feb 2025 – Aug 2026",
      verifiedMetrics: ["1,000+", "481", "10+", "20+", "2", "5-10"],
      verifiedTools: ["R", "Power BI"],
      tags: ["statistics", "experimentation", "user_research", "data_analysis", "stakeholder_communication", "r_language", "qualitative_research", "forecasting", "dashboards"],
      needsConfirmation: [],
      prohibited: ["sole ownership of study design (co-designed only)", "publication claims", "equating '1,000+ responses' with '1,000+ participants' (responses ≠ unique participants)", "a specific number of studies not stated in a fact", "specific forecast accuracy numbers (not documented)"],
      facts: [
        { id: "haas.hypotheses", result: "1,000+ regression", text: "Structured open-ended behavioral research questions into testable hypotheses and analyzed 1,000+ participant responses in R using regression", metrics: ["1,000+"], tools: ["R"], tags: ["statistics", "data_analysis", "experimentation", "r_language"] },
        { id: "haas.factors", text: "Examined 10+ factors that influence leadership and group behavior under Professors Cameron Anderson and Angus Hildreth", metrics: ["10+"], tools: [], tags: ["user_research", "statistics"] },
        { id: "haas.pilots", text: "Co-designed and ran pilot behavioral studies in Berkeley's BLab research network, testing 10+ leadership and group-behavior factors", metrics: ["10+"], tools: [], tags: ["experimentation", "user_research"] },
        { id: "haas.regression", result: "1,000+ regression", text: "Fit regression models to 1,000+ participant responses in R, producing behavioral insights that shaped follow-on study design", metrics: ["1,000+"], tools: ["R"], tags: ["statistics", "data_analysis", "r_language"] },
        { id: "haas.coding", result: "481 coded", text: "Coded 481 open-ended participant responses into a structured codebook, converting free text into analyzable categorical data", metrics: ["481"], tools: [], tags: ["qualitative_research", "user_research", "data_analysis"] },
        { id: "haas.independent", text: "Initiated 2 self-directed projects — a 20+ data-point analysis of leadership-seeking strategies in political debates, and a study of AI tools' effect on research productivity", metrics: ["2", "20+"], tools: [], tags: ["initiative", "data_analysis"] },
        { id: "haas.comms", text: "Presented data-driven stories through written reports and slide presentations, explaining behavioral research findings and statistical analyses to 2 faculty researchers and interdisciplinary teams", metrics: ["2"], tools: [], tags: ["stakeholder_communication", "written_communication", "cross_functional_collaboration"] },
        { id: "haas.forecasting", text: "Built Power BI dashboards to forecast sales and engagement trends", metrics: [], tools: ["Power BI"], tags: ["forecasting", "dashboards", "data_visualization"] },
      ],
    },
    {
      id: "flourish",
      altTitles: [],
      kind: "experience",
      org: "FlourishAI (Berkeley SkyDeck)",
      role: "Software Engineer Intern",
      location: "Berkeley, CA",
      dates: "Dec 2024 – Aug 2025",
      verifiedMetrics: ["100+", "15%", "25%", "10+", "10,000+"],
      verifiedTools: ["Python", "SQL"],
      tags: ["data_engineering", "sql", "python", "ml_evaluation", "user_research", "product_launch", "recommendation_systems"],
      needsConfirmation: [],
      prohibited: ["'replaced manual curation'", "instrumented engagement tracking", "defining engagement as retention/sessions/time"],
      facts: [
        { id: "flourish.etl", result: "ETL 100+ sources", text: "Engineered a Python and SQL ETL pipeline to ingest, clean, and validate data from 100+ research sources", metrics: ["100+"], tools: ["Python", "SQL", "ETL"], tags: ["data_engineering", "sql", "python"] },
        { id: "flourish.recsys", result: "recsys platform", text: "Built and launched a personalized nutrition recommendation platform, translating user needs and expert-labeled data into an experience for end users", metrics: [], tools: [], tags: ["product_launch", "recommendation_systems", "user_research", "product_decisions"] },
        { id: "flourish.eval", result: "15% accuracy / 25% engagement", text: "Benchmarked recommendations against expert-labeled references and translated error analysis into product changes that improved accuracy by 15% and engagement by 25%", metrics: ["15%", "25%"], tools: [], tags: ["ml_evaluation", "data_analysis", "product_decisions", "product_analytics"] },
        { id: "flourish.feedback", text: "Folded feedback from 10+ SkyDeck startup seminars into agile sprints, keeping prototypes aligned with user needs and business strategy", metrics: ["10+"], tools: [], tags: ["user_research", "product_iteration"] },
        { id: "flourish.pipelines", result: "10,000+ predictions", text: "Built automated data pipelines supporting 10,000+ recommendation predictions, making product data reproducible and scalable", metrics: ["10,000+"], tools: [], tags: ["data_engineering", "scale"] },
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
      dates: "May 2023 – Aug 2024",
      verifiedMetrics: ["100+", "30%"],
      verifiedTools: ["iOS", "Swift"],
      tags: ["product_ownership", "experimentation", "product_launch", "product_analytics", "user_research", "product_strategy_roadmap", "partnership", "mobile"],
      needsConfirmation: [],
      prohibited: ["App Store release", "download counts", "number of A/B tests", "revenue", "A/B test duration or timeline (not documented)", "statistical significance claims (not calculated)"],
      facts: [
        { id: "gk.abtests", result: "30% session duration", text: "Designed and analyzed A/B tests for an iOS app used by 100+ athletes, translating results into feature decisions that increased average session duration by 30%", metrics: ["100+", "30%"], tools: ["iOS"], tags: ["experimentation", "product_analytics", "product_decisions"] },
        { id: "gk.launch", result: "shipped app 100+", text: "Built and shipped an iOS app from idea to launch that applies sports psychology techniques to athletic performance for 100+ athletes", metrics: ["100+"], tools: ["iOS", "Swift"], tags: ["product_launch", "product_ownership", "mobile"] },
        { id: "gk.nami", result: "NAMI partnership", text: "Led product strategy and a partnership with the National Alliance on Mental Illness (NAMI), driving adoption to 100+ athletes and iterating on community feedback", metrics: ["100+"], tools: [], tags: ["product_strategy_roadmap", "partnership", "user_research", "product_iteration"] },
        { id: "gk.feedback", result: "feedback to requirements", text: "Gathered feedback from 100+ athletes and translated behavioral insights into product requirements and prioritized feature improvements", metrics: ["100+"], tools: [], tags: ["user_research", "product_decisions", "product_specifications", "product_iteration"] },
        { id: "gk.ownership", result: "full ownership", text: "Owned the full development cycle — user research, roadmap, build, launch, and iteration — as founder of a 100+ user product", metrics: ["100+"], tools: [], tags: ["product_ownership", "product_strategy_roadmap", "user_research", "product_launch"] },
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
    "Analytics & Experimentation": "A/B testing, experimental design, hypothesis testing, regression analysis, qualitative coding, product analytics",
    "Product & Tools": "product roadmapping, user research, competitive analysis, customer journey mapping, Git, Power BI, Microsoft Azure",
  },
  // Every skill the candidate may list, with the evidence that backs it. Anything not here is never listed.
  verifiedSkills: [
    { name: "Python", group: "Languages", evidence: "flourish.etl" }, { name: "SQL", group: "Languages", evidence: "flourish.etl" },
    { name: "R", group: "Languages", evidence: "haas.hypotheses" }, { name: "Swift", group: "Languages", evidence: "gk.launch" },
    { name: "pandas", group: "Languages", evidence: "listed" }, { name: "NumPy", group: "Languages", evidence: "listed" },
    { name: "ETL pipelines", group: "Data & ML", evidence: "flourish.etl" }, { name: "data cleaning & validation", group: "Data & ML", evidence: "flourish.etl" },
    { name: "recommendation systems", group: "Data & ML", evidence: "flourish.recsys" }, { name: "model evaluation", group: "Data & ML", evidence: "flourish.eval" },
    { name: "error analysis", group: "Data & ML", evidence: "flourish.eval" }, { name: "LLM evaluation", group: "Data & ML", evidence: "mercor.eval" },
    { name: "PostgreSQL", group: "Data & ML", evidence: "listed" },
    { name: "A/B testing", group: "Analytics & Experimentation", evidence: "gk.abtests" }, { name: "experimental design", group: "Analytics & Experimentation", evidence: "haas.pilots" }, { name: "experiment design", group: "Analytics & Experimentation", evidence: "haas.pilots" },
    { name: "hypothesis testing", group: "Analytics & Experimentation", evidence: "haas.hypotheses" }, { name: "regression analysis", group: "Analytics & Experimentation", evidence: "haas.regression" },
    { name: "statistical modeling", group: "Analytics & Experimentation", evidence: "haas.regression" }, { name: "qualitative coding", group: "Analytics & Experimentation", evidence: "haas.coding" },
    { name: "product analytics", group: "Analytics & Experimentation", evidence: "gk.abtests" },
    { name: "product strategy", group: "Product & Tools", evidence: "gk.nami" }, { name: "product roadmapping", group: "Product & Tools", evidence: "siemens.roadmap" }, { name: "roadmapping", group: "Product & Tools", evidence: "siemens.roadmap" },
    { name: "user research", group: "Product & Tools", evidence: "gk.ownership" }, { name: "customer discovery", group: "Product & Tools", evidence: "siemens.journey" },
    { name: "customer journey mapping", group: "Product & Tools", evidence: "siemens.journey" }, { name: "market research", group: "Product & Tools", evidence: "siemens.partnerships" },
    { name: "competitive analysis", group: "Product & Tools", evidence: "siemens.competitive" }, { name: "experimentation", group: "Product & Tools", evidence: "gk.abtests" },
    { name: "cross-functional collaboration", group: "Product & Tools", evidence: "siemens.crossfn" },
    { name: "Git", group: "Product & Tools", evidence: "listed" }, { name: "Power BI", group: "Product & Tools", evidence: "haas.forecasting" }, { name: "Microsoft Azure", group: "Product & Tools", evidence: "listed" },
    { name: "Tableau", group: "Product & Tools", evidence: "listed" }, { name: "Microsoft Excel", group: "Product & Tools", evidence: "listed" },
    { name: "forecasting", group: "Analytics & Experimentation", evidence: "haas.forecasting" },
  ],
  // Listed on the original résumé without a supporting bullet; kept only because the candidate confirmed them.
  unevidencedSkills: ["Microsoft Azure", "Git", "PostgreSQL", "pandas", "NumPy", "Tableau", "Microsoft Excel"],
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
