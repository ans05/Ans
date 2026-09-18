// Base resume. Every bullet here is a true fact; the model picks the best
// three per role for each job and rewrites them to match its language.
// Keep the pool larger than what fits on a page — more angles, more matches.
const DEFAULT_RESUME = {
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
    coursework:
      "Data Structures & Algorithms, Foundations of Data Science, Statistical Analysis, Computational Structures in Data Science, Python Programming",
  },
  experience: [
    {
      org: "Siemens Healthineers",
      role: "Product & Strategy Intern",
      location: "Berkeley, CA",
      dates: "Jan 2026 – May 2026",
      bullets: [
        "Product roadmap: built a prioritized 90-day activation strategy for the theranostics business from customer-journey, workflow, and adoption-barrier research across 8+ organizations",
        "Competitive analysis: mapped patient advocacy networks and competitive positioning across 8+ organizations, surfacing strategic growth opportunities for the theranostics business",
        "Market research: distilled workflow and adoption-barrier findings from 8+ organizations into ranked partnership priorities spanning multiple product lines",
        "Stakeholder alignment: developed data-informed patient engagement strategies across 3 functions — clinical, marketing, and product — to improve treatment access and navigation",
        "Customer journey mapping: documented patient journeys across 8+ organizations to pinpoint the friction points blocking theranostics adoption",
      ],
    },
    {
      org: "Mercor",
      role: "AI Growth Intern",
      location: "San Francisco, CA",
      dates: "Jan 2025 – June 2025",
      bullets: [
        "Model evaluation: scored 500+ LLM responses against structured quality metrics, isolating recurring failure patterns that fed directly into model improvements",
        "Training data: authored high-signal examples for a 15,000+ response training dataset used to refine model behavior and raise evaluation quality",
        "Process optimization: redesigned the evaluation workflow for 500+ responses after a performance analysis, removing repeated manual steps",
        "Quality rubrics: applied structured, multi-criteria scoring rubrics to 500+ LLM outputs to grade accuracy, helpfulness, and safety",
        "Error analysis: categorized failure modes across 500+ responses into a taxonomy that became concrete guidance for model refinement",
      ],
    },
    {
      org: "Haas School of Business Lab",
      role: "Undergraduate Research Assistant (URAP) — Social Psychology & Business Lab",
      location: "Berkeley, CA",
      dates: "Feb 2025 – Aug 2026",
      bullets: [
        "Hypothesis testing: structured open-ended behavioral research questions into testable hypotheses and analyzed 1,000+ participant responses in R using regression",
        "Behavioral research: examined 10+ factors that influence leadership and group behavior under Professors Cameron Anderson and Angus Hildreth",
        "Experimental design: co-designed and ran pilot behavioral studies in Berkeley's BLab research network, testing 10+ leadership and group-behavior factors",
        "Statistical analysis: fit regression models to 1,000+ participant responses in R, producing behavioral insights that shaped follow-on study design",
        "Qualitative coding: coded 481 open-ended participant responses into a structured codebook, converting free text into analyzable categorical data",
        "Independent research: initiated 2 self-directed projects — a 20+ data-point analysis of leadership-seeking strategies in political debates, and a study of AI tools' effect on research productivity",
        "Research communication: presented experimental results and statistical analyses in written reports and slide decks to 2 faculty PIs and interdisciplinary teams",
      ],
    },
    {
      org: "FlourishAI (Berkeley SkyDeck)",
      role: "Software Engineer Intern",
      location: "Berkeley, CA",
      dates: "Dec 2024 – Aug 2025",
      bullets: [
        "ETL pipeline: engineered a Python and SQL pipeline to ingest, clean, and validate data from 100+ research sources, improving recommendation accuracy by 15%",
        "Recommendation system: built and deployed a personalized nutrition recommendation platform in Python and SQL, increasing user engagement by 25%",
        "Model evaluation: benchmarked recommendations against expert-labeled references and used error analysis to drive a 15% accuracy gain",
        "User research: folded feedback from 10+ SkyDeck startup seminars into agile sprints, keeping prototypes aligned with user needs and business strategy",
        "Data engineering: built automated data pipelines supporting 10,000+ recommendation predictions, making product data reproducible and scalable",
      ],
    },
  ],
  projects: [
    {
      name: "Project GoalKeeper",
      tech: "Founder & Product Lead | iOS, Swift, A/B Testing, Product Analytics",
      dates: "May 2023 – Aug 2024",
      bullets: [
        "A/B tests: designed and analyzed experiments for an iOS app used by 100+ athletes, translating results into feature decisions that increased average session duration by 30%",
        "Product launch: built and shipped an iOS app from idea to launch that applies sports psychology techniques to athletic performance for 100+ athletes",
        "Partnership: led product strategy and a partnership with the National Alliance of Mental Health (NAMI), driving adoption to 100+ athletes and iterating on community feedback",
        "Product analytics: defined engagement metrics and used them to prioritize features, growing average session duration 30%",
        "Product ownership: owned the full development cycle — user research, roadmap, build, launch, and iteration — as founder of a 100+ user product",
      ],
    },
  ],
  skills: {
    Languages: "Python (pandas, NumPy), SQL, R, Swift, Rust",
    "Data & ML": "ETL pipelines, data cleaning & validation, recommendation systems, model evaluation, error analysis, PostgreSQL",
    "Analytics & Experimentation": "A/B testing, experimental design, hypothesis testing, regression analysis, statistical modeling, product analytics",
    "Product & Tools": "product roadmapping, user research, competitive analysis, stakeholder management, Power BI, Git, Microsoft Azure",
  },
};
