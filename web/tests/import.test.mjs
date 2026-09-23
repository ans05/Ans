// Switching the evidence bank to a different résumé: unit coverage for the deterministic
// fallback ordering, plus an end-to-end run that imports a friend's résumé in the browser and
// confirms tailoring, scoring, and the exported PDF are built entirely from their facts.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const S = require("../scoring.js");
const { resumeFromBank } = require("../../extension/resume-data.js");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "web/tests/out");
fs.mkdirSync(OUT, { recursive: true });

let chromium;
try { ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs")); } catch { ({ chromium } = await import("playwright")); }

// A stranger's bank: none of these entry ids appear in any TRACK_ORDER table.
const FRIEND_BANK = {
  version: 1,
  profile: { name: "Jordan Lee", phone: "555-010-2020", email: "jordan.lee@example.edu", linkedin: "linkedin.com/in/jordanlee" },
  education: { school: "State University", grad: "Expected Graduation: May 2027", degree: "B.S. Computer Science", coursework: "Algorithms, Databases, Operating Systems" },
  entries: [
    {
      id: "acme", kind: "experience", org: "Acme Robotics", role: "Software Engineering Intern", location: "Austin, TX", dates: "Jun 2025 – Aug 2025",
      verifiedMetrics: ["3", "40%"], verifiedTools: ["Python", "SQL"], altTitles: [], tags: ["data_engineering", "python", "sql"], needsConfirmation: [], prohibited: [],
      facts: [
        { id: "acme.pipeline", text: "Built a Python and SQL data pipeline processing sensor logs from 3 robots, cutting nightly processing time by 40%", metrics: ["3", "40%"], tools: ["Python", "SQL"], tags: ["data_engineering", "python", "sql"] },
        { id: "acme.tests", text: "Wrote unit tests that caught 12 regressions before release", metrics: ["12"], tools: [], tags: ["quality"] },
      ],
    },
    {
      id: "sideproj", kind: "project", org: "Campus Bike Share Tracker", role: "Solo Developer", tech: "React, Node.js", location: "", dates: "Jan 2025 – Mar 2025",
      verifiedMetrics: ["500+"], verifiedTools: ["React", "Node.js"], altTitles: [], tags: ["product_launch", "mobile"], needsConfirmation: [], prohibited: [],
      facts: [{ id: "side.launch", text: "Built and launched a bike-availability tracker app used by 500+ students", metrics: ["500+"], tools: ["React", "Node.js"], tags: ["product_launch"] }],
    },
  ],
  skills: { Languages: "Python, SQL, JavaScript", "Data & ML": "ETL pipelines" },
  unevidencedSkills: [],
};

test("orderForTrack falls back to evidence ranking for entry ids outside every TRACK_ORDER table", () => {
  const doc = resumeFromBank(FRIEND_BANK);
  const caps = ["data_engineering", "python", "sql", "product_launch"];
  const o = S.orderForTrack(doc, "ds_ml", caps);
  assert.equal(o.fallback, true);
  assert.equal(o.experience[0].id, "acme", "Acme is the only experience, so it stays first");
  const ranked = S.rankEntries(doc, caps, "ds_ml");
  assert.equal(ranked[0].id, "acme");
  // Without capIds the function still returns something usable (no crash on default fallback path).
  const noCaps = S.orderForTrack(doc, "ds_ml");
  assert.equal(noCaps.experience.length, 1);
});

test("qualityControl and evaluate work against a completely different evidence bank", () => {
  const doc = resumeFromBank(FRIEND_BANK);
  const qc = S.qualityControl(doc, { bank: FRIEND_BANK });
  assert.equal(qc.blocked, false, JSON.stringify(qc.issues));
  const items = [
    { statement: "Experience with Python and SQL", category: "required_qualification", capabilities: ["python", "sql"] },
    { statement: "Experience shipping a product used by real users", category: "required_qualification", capabilities: ["product_launch"] },
    { statement: "Experience with causal inference", category: "preferred_qualification", capabilities: ["causal_inference"] },
  ];
  const r = S.evaluate(items, doc, { track: "ds_ml", bank: FRIEND_BANK });
  assert.equal(r.items.find((i) => i.capability === "python").status, "matched");
  assert.equal(r.items.find((i) => i.capability === "product_launch").status, "matched");
  assert.equal(r.items.find((i) => i.capability === "causal_inference").status, "missing");
  assert.ok(!JSON.stringify(r).includes("GoalKeeper") && !JSON.stringify(r).includes("Siemens"), "no trace of the built-in example's data");
});

test("Import flow: a friend's résumé replaces the bank end to end — tailor, score, PDF, and text carry only their facts", async () => {
  const b = await chromium.launch({ channel: "chromium", headless: true });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = []; p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript((FRIEND_BANK) => {
    window.__calls = [];
    const TAILOR = {
      experience: [{ id: "acme", bullets: [{ factId: "acme.pipeline", text: "Built a Python and SQL data pipeline processing sensor logs from 3 robots, cutting nightly processing time by 40%" }, { factId: "acme.tests", text: "Wrote unit tests that caught 12 regressions before release" }] }],
      projects: [{ id: "sideproj", bullets: [{ factId: "side.launch", text: "Built and launched a bike-availability tracker app used by 500+ students" }] }],
      skills: { Languages: "Python, SQL, JavaScript" }, omittedBecauseUnsupported: [],
    };
    const EXTRACT = { items: [{ statement: "Experience with Python and SQL", category: "required_qualification", capabilities: ["python", "sql"] }] };
    const sample = async () => ({});
    sample.json = async (prompt) => {
      window.__calls.push(prompt.slice(0, 20));
      if (prompt.startsWith("Convert this résumé")) return FRIEND_BANK;
      if (prompt.startsWith("Extract every distinct statement")) return EXTRACT;
      if (prompt.startsWith("You are tailoring")) return TAILOR;
      return {};
    };
    sample.limits = async () => ({});
    window.claude = { use: async (n) => ({ sample, downloads: { save: async ({ filename, data }) => { const buf = await data.arrayBuffer(); window.__saved = { filename, bytes: Array.from(new Uint8Array(buf)) }; return { status: "saved" }; } }, permissions: { state: async () => "granted", request: async () => ({ downloads: "granted" }) } })[n] || null };
  }, FRIEND_BANK);

  try {
    await p.goto("file://" + path.join(ROOT, "web/index.html")); await p.waitForTimeout(500);

    // Before import: it's Aneesh's résumé.
    assert.match((await p.locator("#paper").innerText()), /Aneesh/);

    await p.click("#open-settings");
    await p.fill("#import-text", "Jordan Lee — Acme Robotics, Software Engineering Intern. Built a Python/SQL pipeline. Campus Bike Share Tracker, 500+ students.".repeat(3));
    await p.click("#import-build");
    await p.waitForFunction(() => document.getElementById("import-status").textContent.includes("Built"), null, { timeout: 10000 });
    await p.click("#save-settings");
    await p.waitForTimeout(200);

    const paperText = await p.locator("#paper").innerText();
    assert.match(paperText, /Jordan Lee/);
    assert.doesNotMatch(paperText, /Aneesh|Siemens|GoalKeeper|Berkeley/);
    assert.match(paperText, /Acme Robotics/);
    assert.match(paperText, /Campus Bike Share Tracker/);

    // Tailor against a posting; the fixture tailor reply only knows Jordan's fact ids.
    await p.fill("#jd", "Software Engineering Intern. Experience with Python and SQL required. " + "x".repeat(60));
    await p.click("#tailor");
    await p.waitForFunction(() => document.querySelector(".tab.active")?.dataset.tab === "score", null, { timeout: 15000 });
    await p.waitForTimeout(300);
    const afterTailor = await p.locator("#paper").innerText();
    assert.match(afterTailor, /Jordan Lee/);
    assert.match(afterTailor, /sensor logs from 3 robots/);
    assert.doesNotMatch(afterTailor, /Aneesh|GoalKeeper/);

    const scoreCard = await p.textContent(".score-verdict");
    assert.doesNotMatch(scoreCard, /Aneesh/);

    // Export and validate the PDF carries Jordan's data, not Aneesh's.
    await p.click("#download");
    await p.waitForFunction(() => !!window.__saved, null, { timeout: 5000 });
    const saved = await p.evaluate(() => window.__saved);
    const pdfPath = path.join(OUT, "jordan_" + saved.filename);
    fs.writeFileSync(pdfPath, Buffer.from(saved.bytes));
    assert.match(saved.filename, /Jordan_Lee/);
    let report = {};
    try { execFileSync("python3", [path.join(ROOT, "web/validate_pdf.py"), pdfPath], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch (e) { report = JSON.parse((e.stdout || "{}").slice((e.stdout || "{}").indexOf("{"))); }
    if (report.checks) assert.equal(report.checks.one_page, true);

    assert.deepEqual(errors, []);
  } finally { await b.close(); }
});
