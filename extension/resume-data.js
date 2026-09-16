// Base resume. Every bullet here is a true fact; the model picks the best
// three per role for each job and rewrites them to match its language.
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
        "Synthesized customer-journey, workflow, and adoption-barrier research across 8+ organizations into a prioritized 90-day product activation strategy",
        "Analyzed patient advocacy networks and competitive positioning across 8+ organizations to identify strategic growth opportunities for theranostics business",
        "Developed data-informed patient engagement strategies by collaborating across clinical, marketing, and product teams",
        "Built a 90-day activation strategy from workflow and adoption-barrier research, prioritizing partnership opportunities across multiple product lines",
      ],
    },
    {
      org: "Mercor",
      role: "AI Growth Intern",
      location: "San Francisco, CA",
      dates: "Jan 2025 – June 2025",
      bullets: [
        "Evaluated 500+ AI-generated responses using structured quality metrics to identify recurring patterns and improve model performance",
        "Contributed to a 15,000+ response training dataset by creating high-signal examples used to refine model behavior and evaluation quality",
        "Improved evaluation workflows by 15% through performance analysis and process optimization",
      ],
    },
    {
      org: "Haas School of Business Lab",
      role: "Undergraduate Research Assistant",
      location: "Berkeley, CA",
      dates: "Feb 2025 – Aug 2026",
      bullets: [
        "Structured open-ended behavioral research questions into testable hypotheses; cleaned and analyzed 1,000+ participant responses using R, regression, and hypothesis testing",
        "Designed behavioral research studies to understand leadership, consumer decision-making, and organizational behavior",
        "Validated and communicated findings through written reports and slide decks to faculty and interdisciplinary research teams",
        "Analyzed datasets containing 1,000+ participant responses using regression models and statistical analysis to generate actionable behavioral insights",
      ],
    },
    {
      org: "FlourishAI (Berkeley SkyDeck)",
      role: "Software Engineer Intern",
      location: "Berkeley, CA",
      dates: "Dec 2024 – Aug 2025",
      bullets: [
        "Engineered a Python and SQL ETL pipeline to ingest, clean, and validate data from 100+ research sources; benchmarked recommendations against expert-labeled references and used error analysis to improve accuracy by 15%",
        "Built and deployed a personalized nutrition recommendation platform using Python and SQL, increasing user engagement by 25%",
        "Developed an automated data pipeline processing 100+ research sources, improving recommendation accuracy by 15%",
        "Integrated continuous user feedback from 10+ SkyDeck startup seminars into agile development cycles, aligning product prototypes with user needs and business strategy",
      ],
    },
  ],
  projects: [
    {
      name: "Project GoalKeeper",
      tech: "Founder & Product Lead | iOS, Python, A/B Testing",
      dates: "May 2023 – Aug 2024",
      bullets: [
        "Designed and analyzed A/B tests for an iOS product used by 100+ athletes, translating behavioral data and user feedback into feature decisions that increased average session duration by 30%",
        "Built and launched an iOS app to improve athletic performance through sports psychology techniques",
        "Led product strategy and partnership with the National Alliance of Mental Health (NAMI), driving user adoption and iterating on features based on community feedback",
        "Used product analytics and A/B testing to guide feature decisions, increasing average session duration by 30%",
      ],
    },
  ],
  skills: {
    "Data & Analytics":
      "SQL, Python (pandas, NumPy), R, statistical modeling, regression analysis, hypothesis testing, experimental design, A/B testing, data cleaning & validation, ETL pipelines, model evaluation",
    "Languages & Tools": "Swift, Power BI, Git, Rust, Microsoft Azure, PostgreSQL",
    Interests: "Consumer Technology, Product Strategy, Entrepreneurship, Experimental",
  },
};
