const $ = (id) => document.getElementById(id);
const els = {
  layout: $("layout"), inputPanel: $("input-panel"), collapseJob: $("collapse-job"), expandJob: $("expand-job"),
  company: $("company"), jd: $("jd"),
  tailor: $("tailor"), useBase: $("use-base"), stop: $("stop"), status: $("status"), saved: $("saved"),
  paper: $("paper"), pdf: $("pdf"), fit: $("fit"), download: $("download"), revert: $("revert"),
  settings: $("settings"), openSettings: $("open-settings"),
  baseResume: $("base-resume"), save: $("save-settings"), cancel: $("cancel-settings"),
  reset: $("reset-resume"), settingsStatus: $("settings-status"),
  rate: $("rate"), improve: $("improve"), scoreStatus: $("score-status"), scoreOut: $("score-out"),
  outreach: $("outreach"), outreachStatus: $("outreach-status"), outreachOut: $("outreach-out"),
};

let state = {
  base: DEFAULT_RESUME, doc: null, claudeVersion: null, pdfUrl: null,
  sample: undefined, downloads: undefined, ctl: null,
  score: null, reqs: null, suggestions: null, targets: null,
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const skillsToArray = (obj) => Object.entries(obj).map(([cat, vals]) => ({ cat, vals }));
const skillsToObject = (arr) => Object.fromEntries(arr.filter((s) => s.cat).map((s) => [s.cat, s.vals]));

function docFromTailored(t) {
  return {
    profile: clone(state.base.profile),
    education: clone(state.base.education),
    experience: clone(t.experience),
    projects: clone(t.projects),
    skills: Array.isArray(t.skills) ? clone(t.skills) : skillsToArray(t.skills),
  };
}
const currentResume = () => ({ ...state.doc, skills: skillsToObject(state.doc.skills) });

// ── Storage (per-viewer, this browser only) ──────────────────────────────

const store = {
  get(k) { try { const v = localStorage.getItem("rt:" + k); return v ? JSON.parse(v) : null; } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem("rt:" + k, JSON.stringify(v)); } catch (_) {} },
};

function load() {
  state.base = store.get("baseResume") || DEFAULT_RESUME;
  if (store.get("jobHidden")) setJobHidden(true);
  const last = store.get("lastResult");
  if (last) {
    els.company.value = last.company || "";
    els.jd.value = last.jd || "";
    state.doc = last.doc || null;
    state.claudeVersion = last.claudeVersion || null;
    state.reqs = last.reqs || null;
    state.suggestions = last.suggestions || null;
    state.targets = last.targets || null;
  }
  if (!state.doc) state.doc = baseDoc();
  renderEditor(); refreshPdf();
  rescore();
  if (state.targets) renderOutreach();
  showTab(store.get("tab") || "job");
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    store.set("lastResult", {
      company: els.company.value.trim(), jd: els.jd.value, doc: state.doc, claudeVersion: state.claudeVersion,
      reqs: state.reqs, suggestions: state.suggestions, targets: state.targets,
    });
    els.saved.textContent = "Saved";
    setTimeout(() => { if (els.saved.textContent === "Saved") els.saved.textContent = ""; }, 1500);
  }, 300);
}

// ── Tabs ─────────────────────────────────────────────────────────────────

function showTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".tabpane").forEach((p) => { p.hidden = p.id !== `tab-${name}`; });
  store.set("tab", name);
}
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));

// ── Claude (via the viewer's own claude.ai account) ──────────────────────

const ERROR_COPY = {
  not_granted: "Claude access wasn't allowed for this page. Editing and download still work.",
  sampling_disabled: "Claude isn't available on this account. Editing and download still work.",
  rate_limited: "Too many requests right now — try again in a minute.",
  session_expired: "Your claude.ai session expired — sign in again and retry.",
  prompt_too_large: "That job description is too long — paste just the role and requirements.",
  invalid_json: "Claude's reply wasn't usable — try again.",
  refused: "Claude declined this request — try a shorter job description.",
  empty_completion: "Claude returned nothing — try again.",
  cancelled: "Stopped.",
};
const HIDE_ON = new Set(["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"]);

// Runs one Claude JSON call with shared busy/error handling.
async function ask(prompt, { btn, statusEl, busyMsg, validate }) {
  if (!state.sample) { setText(statusEl, "Claude isn't available in this view.", "error"); return null; }
  state.ctl = new AbortController();
  btn.disabled = true; els.stop.hidden = false;
  setText(statusEl, busyMsg, "busy");
  try {
    const out = await state.sample.json(prompt, { signal: state.ctl.signal, cache: false });
    if (validate && !validate(out)) throw { code: "invalid_json", message: "missing fields" };
    setText(statusEl, "");
    return out;
  } catch (e) {
    const code = e?.code || "upstream_error";
    if (HIDE_ON.has(code)) { state.sample = null; hideClaudeButtons(); }
    setText(statusEl, ERROR_COPY[code] ?? "Something went wrong reaching Claude — try again.", code === "cancelled" ? "" : "error");
    return null;
  } finally {
    btn.disabled = false; els.stop.hidden = true; state.ctl = null;
  }
}
els.stop.addEventListener("click", () => state.ctl?.abort());
function hideClaudeButtons() { for (const b of [els.tailor, els.rate, els.improve, els.outreach]) b.hidden = true; }

function baseJSON() {
  return JSON.stringify({ experience: state.base.experience, projects: state.base.projects, skills: state.base.skills }, null, 2);
}
const SCHEMA = `{
  "experience": [{"org": "...", "role": "...", "location": "...", "dates": "...", "bullets": ["b1", "b2", "b3"]}],
  "projects": [{"name": "...", "tech": "...", "dates": "...", "bullets": ["b1", "b2"]}],
  "skills": {"Data & Analytics": "...", "Languages & Tools": "...", "Interests": "..."}
}`;
const RULES = `Rules:
- ATS first. Applicant-tracking systems match on exact wording, so use the job description's own terms verbatim wherever they are truthfully applicable (e.g. if it says "experimentation" and "customer-journey data", write those exact words, not synonyms). Every required qualification in the posting that the candidate genuinely meets must be visibly evidenced by at least one bullet or skills entry.
- ORDER experiences by relevance to this job, most relevant first — recruiters read top-down and rarely reach the bottom. Do the same for projects. Reorder freely; only include entries that exist in the base resume.
- Keep every org/role/location/dates exactly as given (never change facts).
- 3 bullets per experience, 2 per project, most relevant bullet first. Rewrite to match the job's language, but keep every metric and fact true. Never add tools, titles, or experience that are not in the base resume.
- Lead the skills lines with the exact tools and methods this posting names, then the rest. You may rename the first skills category to fit the role (e.g. "Product & Analytics").`;

function tailorPrompt(jd) {
  return `You are a professional resume writer for early-career (internship and new-grad) candidates who optimizes for applicant-tracking systems (ATS) first and human readers second. Tailor the candidate's resume to the job description below so it ranks as highly as possible in ATS keyword matching while staying completely truthful.

Candidate's base resume (JSON) — the only source of truth:
${baseJSON()}

Job Description:
${jd.slice(0, 12000)}

Reply with only a JSON object in this exact schema:
${SCHEMA}

${RULES}`;
}

const validTailored = (t) => Array.isArray(t?.experience) && Array.isArray(t?.projects) && t?.skills && typeof t.skills === "object";

function applyTailored(t, msg) {
  state.doc = docFromTailored(t);
  state.claudeVersion = clone(state.doc);
  markScoreStale();
  renderEditor(); refreshPdf(); persist();
  setStatus(msg);
}

els.tailor.addEventListener("click", async () => {
  const jd = els.jd.value.trim();
  if (jd.length < 80) { setStatus("Paste the full job description first.", "error"); return; }
  const t = await ask(tailorPrompt(jd), { btn: els.tailor, statusEl: els.status, busyMsg: "Tailoring with Claude — usually 15–40 seconds…", validate: validTailored });
  if (!t) return;
  applyTailored(t, "Done. Edit anything in the middle; the PDF on the right updates as you type. Then check the Score tab.");
  setJobHidden(true);
});

// ── Score (deterministic; one narrow model call for suggestions) ─────────
//
// score = 50% required coverage + 15% preferred coverage
//       + 20% bullet-quality pass rate + 15% ordering
// If the posting lists no preferred qualifications, that 15% goes to required.

const WEIGHTS = { required: 50, preferred: 15, quality: 20, ordering: 15 };
const WEAK = /\b(responsible for|helped|worked on|assisted with|various|participated in)\b/i;
const IRREGULAR_VERBS = new Set(["built", "led", "ran", "drove", "grew", "wrote", "cut", "set", "won", "made", "met", "taught", "brought", "sold", "held", "kept", "chose", "began", "saw", "found", "oversaw", "spearheaded", "shipped", "co-designed", "codesigned"]);

function hashJD(jd) { let h = 0; for (const c of jd) h = (h * 31 + c.charCodeAt(0)) | 0; return String(h); }

function stem(w) {
  w = w.toLowerCase().replace(/[^a-z0-9+#/.-]/g, "");
  if (w.length <= 3) return w;
  return w.replace(/(ations?|ization|izing|ising|ings?|ies|ied|ers?|ed|es|s)$/, (m) => (m === "ies" || m === "ied" ? "y" : ""));
}
const tokens = (t) => String(t).split(/[\s,;()|/]+/).map(stem).filter(Boolean);

// A keyword matches when every one of its stemmed words appears in the text.
function keywordHits(keyword, tokSet) {
  const ks = tokens(keyword);
  return ks.length > 0 && ks.every((k) => tokSet.has(k));
}

function resumeUnits(doc) {
  const units = [];
  doc.experience.forEach((e, i) => e.bullets.forEach((b, j) => units.push({ text: b, where: `${e.org}, bullet ${j + 1}`, section: "experience", i, j })));
  doc.projects.forEach((p, i) => {
    units.push({ text: p.tech, where: `${p.name}, tech line`, section: "projects", i, j: -1 });
    p.bullets.forEach((b, j) => units.push({ text: b, where: `${p.name}, bullet ${j + 1}`, section: "projects", i, j }));
  });
  doc.skills.forEach((s) => units.push({ text: `${s.cat}: ${s.vals}`, where: `Skills — ${s.cat}`, section: "skills", i: -1, j: -1 }));
  units.push({ text: doc.education.coursework, where: "Coursework", section: "education", i: -1, j: -1 });
  for (const u of units) u.toks = new Set(tokens(u.text));
  return units;
}

function bulletQuality(text) {
  const body = text.replace(/^[^:]{1,40}:\s*/, "");
  const first = body.split(/\s+/)[0]?.toLowerCase() || "";
  const verb = /ed$/.test(first) || IRREGULAR_VERBS.has(first);
  const number = /\d|%/.test(text);
  const length = text.length <= 200;
  const strong = !WEAK.test(text);
  return { verb, number, length, strong, pass: verb && number && length && strong };
}

function analyze(reqs, doc) {
  const units = resumeUnits(doc);
  const items = reqs.map((r) => {
    let hit = null, kw = null;
    for (const k of r.keywords || []) {
      const u = units.find((u) => keywordHits(k, u.toks));
      if (u) { hit = u; kw = k; break; }
    }
    return { ...r, matched: !!hit, matchedKeyword: kw, matchedWhere: hit?.where || null, matchedText: hit?.text || null };
  });
  const req = items.filter((r) => r.type === "required"), pref = items.filter((r) => r.type !== "required");
  const reqCov = req.length ? req.filter((r) => r.matched).length / req.length : 1;
  const prefCov = pref.length ? pref.filter((r) => r.matched).length / pref.length : null;

  const bullets = units.filter((u) => u.j >= 0).map((u) => ({ where: u.where, text: u.text, ...bulletQuality(u.text) }));
  const quality = bullets.length ? bullets.filter((b) => b.pass).length / bullets.length : 1;

  // Ordering: the experience matching the most required keywords should be first.
  const reqKeywords = req.flatMap((r) => r.keywords || []);
  const expScores = doc.experience.map((e, i) => {
    const toks = new Set(tokens(e.bullets.join(" ")));
    return { i, org: e.org, hits: reqKeywords.filter((k) => keywordHits(k, toks)).length };
  });
  const bestHits = Math.max(0, ...expScores.map((x) => x.hits));
  const best = expScores.find((x) => x.hits === bestHits);
  const ordering = bestHits === 0 || expScores[0].hits === bestHits ? 1 : expScores[1]?.hits === bestHits ? 0.5 : 0;

  const w = { ...WEIGHTS };
  if (prefCov === null) { w.required += w.preferred; w.preferred = 0; }
  const parts = {
    required: { weight: w.required, value: reqCov, points: w.required * reqCov, label: `${req.filter((r) => r.matched).length}/${req.length} required qualifications matched` },
    preferred: { weight: w.preferred, value: prefCov ?? 0, points: w.preferred * (prefCov ?? 0), label: pref.length ? `${pref.filter((r) => r.matched).length}/${pref.length} preferred matched` : "no preferred qualifications in posting" },
    quality: { weight: w.quality, value: quality, points: w.quality * quality, label: `${bullets.filter((b) => b.pass).length}/${bullets.length} bullets pass all checks` },
    ordering: { weight: w.ordering, value: ordering, points: w.ordering * ordering, label: ordering === 1 ? "strongest experience is first" : `${best?.org} matches the most required keywords (${bestHits}) but is not first` },
  };
  const score = Math.round(Object.values(parts).reduce((a, p) => a + p.points, 0));
  return { score, parts, items, bullets, expScores, bestOrg: best?.org || null, ordering };
}

function extractPrompt(jd) {
  return `Extract the qualifications from this job posting. Reply with only a JSON object:
{"requirements": [{"requirement": "one qualification, quoted or closely paraphrased from the posting", "type": "required" | "preferred", "keywords": ["2-5 short terms an ATS would match for it, as they'd appear on a resume, e.g. \\"SQL\\", \\"A/B testing\\", \\"statistical modeling\\""]}]}
Rules: "required" = listed under must-have / basic / minimum / "you have"; "preferred" = nice-to-have / bonus / "exceptional candidates". Skip degree-in-progress, graduation-date, location, and personality traits (curiosity, communication) — only skills, tools, methods, and experience. 5-15 items. Keywords must be concrete terms, never sentences.

Job posting:
${jd.slice(0, 12000)}`;
}
const validReqs = (o) => Array.isArray(o?.requirements) && o.requirements.every((r) => r && typeof r.requirement === "string" && Array.isArray(r.keywords));

function suggestPrompt(missing) {
  return `A candidate's resume is missing evidence for the qualifications below. For each, decide whether it can be TRUTHFULLY evidenced from the candidate's base resume (the only source of truth). If yes, write one resume bullet (under 200 characters, starting with the matching keyword, then a past-tense verb, then what/how/result) using only facts already in the base resume, and name the org it belongs under. If it cannot be evidenced without inventing anything, answer NO.

Base resume (JSON):
${baseJSON()}

Missing qualifications:
${missing.map((m, i) => `${i + 1}. ${m.requirement} (keywords: ${(m.keywords || []).join(", ")})`).join("\n")}

Reply with only JSON: {"suggestions": [{"requirement": "...", "evidenced": true|false, "org": "exact org or project name from the base resume, or null", "bullet": "the bullet, or null"}]}`;
}
const validSugg = (o) => Array.isArray(o?.suggestions);

async function ensureRequirements(jd) {
  const h = hashJD(jd);
  if (state.reqs?.hash === h) return state.reqs.items;
  const out = await ask(extractPrompt(jd), { btn: els.rate, statusEl: els.scoreStatus, busyMsg: "Reading the posting's qualifications (one-time per job)…", validate: validReqs });
  if (!out) return null;
  state.reqs = { hash: h, items: out.requirements.map((r) => ({ requirement: r.requirement, type: r.type === "preferred" ? "preferred" : "required", keywords: r.keywords.map(String) })) };
  return state.reqs.items;
}

function rescore() {
  if (!state.reqs?.items) return;
  state.score = analyze(state.reqs.items, state.doc);
  renderScore();
}

els.rate.addEventListener("click", async () => {
  const jd = els.jd.value.trim();
  if (jd.length < 80) { setText(els.scoreStatus, "Paste the job description in the Job tab first.", "error"); return; }
  const reqs = await ensureRequirements(jd);
  if (!reqs) return;
  state.suggestions = null;
  rescore(); persist();
  const missing = state.score.items.filter((r) => r.type === "required" && !r.matched);
  if (!missing.length) { setText(els.scoreStatus, "Every required qualification is evidenced."); return; }
  const out = await ask(suggestPrompt(missing), { btn: els.rate, statusEl: els.scoreStatus, busyMsg: `Checking whether the ${missing.length} missing qualification${missing.length > 1 ? "s" : ""} can be evidenced truthfully…`, validate: validSugg });
  if (!out) return;
  state.suggestions = out.suggestions.filter((s) => s && typeof s.requirement === "string");
  renderScore(); persist();
});

els.improve.addEventListener("click", () => {
  const usable = (state.suggestions || []).filter((s) => s.evidenced && s.bullet && s.org);
  if (!usable.length) return;
  let applied = 0;
  for (const s of usable) {
    const target = findEntry(s.org);
    if (!target) continue;
    const bullet = String(s.bullet).trim();
    if (target.bullets.some((b) => b === bullet)) continue;
    const cap = target.kind === "experience" ? 3 : 2;
    if (target.bullets.length < cap) target.bullets.push(bullet);
    else target.bullets[weakestIndex(target.bullets)] = bullet;
    applied++;
  }
  state.suggestions = null;
  renderEditor(); refreshPdf(); rescore(); persist();
  setText(els.scoreStatus, applied ? `Inserted ${applied} bullet${applied > 1 ? "s" : ""}. Score recomputed.` : "Nothing to apply.");
});

function findEntry(name) {
  const n = String(name).trim().toLowerCase();
  const e = state.doc.experience.find((x) => x.org.trim().toLowerCase() === n || n.includes(x.org.trim().toLowerCase()) || x.org.trim().toLowerCase().includes(n));
  if (e) return { kind: "experience", bullets: e.bullets };
  const p = state.doc.projects.find((x) => x.name.trim().toLowerCase() === n || n.includes(x.name.trim().toLowerCase()) || x.name.trim().toLowerCase().includes(n));
  return p ? { kind: "projects", bullets: p.bullets } : null;
}

// Weakest = fewest quality checks passed, then fewest required-keyword hits, then longest.
function weakestIndex(bullets) {
  const reqKeywords = (state.reqs?.items || []).filter((r) => r.type === "required").flatMap((r) => r.keywords || []);
  const scored = bullets.map((b, i) => {
    const q = bulletQuality(b); const toks = new Set(tokens(b));
    const passes = [q.verb, q.number, q.length, q.strong].filter(Boolean).length;
    const hits = reqKeywords.filter((k) => keywordHits(k, toks)).length;
    return { i, passes, hits, len: b.length };
  });
  scored.sort((a, b) => a.passes - b.passes || a.hits - b.hits || b.len - a.len);
  return scored[0].i;
}

function renderScore() {
  const s = state.score;
  if (!s) { els.scoreOut.innerHTML = ""; els.improve.hidden = true; return; }
  const tone = s.score >= 80 ? "good" : s.score >= 60 ? "mid" : "low";
  const P = s.parts;
  const formula = `<div class="formula">
    <div class="formula-row"><span>Required qualifications</span><span>${P.required.weight} × ${P.required.value.toFixed(2)}</span><b>${P.required.points.toFixed(1)}</b></div>
    ${P.preferred.weight ? `<div class="formula-row"><span>Preferred qualifications</span><span>${P.preferred.weight} × ${P.preferred.value.toFixed(2)}</span><b>${P.preferred.points.toFixed(1)}</b></div>` : ""}
    <div class="formula-row"><span>Bullet quality</span><span>${P.quality.weight} × ${P.quality.value.toFixed(2)}</span><b>${P.quality.points.toFixed(1)}</b></div>
    <div class="formula-row"><span>Ordering</span><span>${P.ordering.weight} × ${P.ordering.value.toFixed(2)}</span><b>${P.ordering.points.toFixed(1)}</b></div>
    <div class="formula-row total"><span>Score</span><span></span><b>${s.score}</b></div>
  </div>`;

  const reqList = (type, title) => {
    const rows = s.items.filter((r) => r.type === type);
    if (!rows.length) return "";
    return `<div class="sub-label">${title} (${rows.filter((r) => r.matched).length}/${rows.length})</div>
    <ul class="checks">${rows.map((r) => `
      <li class="${r.matched ? "ok" : "miss"}">
        <span class="mark">${r.matched ? "✓" : "✗"}</span>
        <span class="req"><span>${esc(r.requirement)}</span>
          ${r.matched ? `<span class="ev">matched “${esc(r.matchedKeyword)}” in ${esc(r.matchedWhere)}</span>` : `<span class="ev">looked for: ${(r.keywords || []).map(esc).join(", ")}</span>`}
        </span>
      </li>`).join("")}</ul>`;
  };

  const failing = s.bullets.filter((b) => !b.pass);
  const quality = `<div class="sub-label">Bullet quality (${s.bullets.length - failing.length}/${s.bullets.length} pass)</div>
    ${failing.length ? `<ul class="checks">${failing.map((b) => `
      <li class="miss"><span class="mark">✗</span><span class="req"><span>${esc(b.where)}</span>
        <span class="ev">${[!b.verb && "no past-tense verb after the label", !b.number && "no number or %", !b.length && `${b.text.length} chars (max 200)`, !b.strong && "weak phrase"].filter(Boolean).join(" · ")}</span></span></li>`).join("")}</ul>`
      : `<div class="hint">Every bullet starts with a verb, has a number, is under 200 characters, and avoids weak phrases.</div>`}`;

  const ordering = `<div class="sub-label">Ordering</div><div class="hint">${esc(P.ordering.label)}${s.ordering < 1 && s.bestOrg ? ` <button class="btn tiny" type="button" id="apply-order">Move ${esc(s.bestOrg)} to top</button>` : ""}</div>`;

  const sg = state.suggestions;
  const usable = (sg || []).filter((x) => x.evidenced && x.bullet);
  const sugg = sg ? `<div class="sub-label">Missing required qualifications</div><ul class="checks">${sg.map((x) => `
      <li class="${x.evidenced ? "ok" : "miss"}"><span class="mark">${x.evidenced ? "+" : "—"}</span><span class="req"><span>${esc(x.requirement)}</span>
        <span class="ev">${x.evidenced && x.bullet ? `add under ${esc(x.org)}: “${esc(x.bullet)}”` : "cannot be evidenced from your base resume without inventing something — leave it out"}</span></span></li>`).join("")}</ul>` : "";

  els.scoreOut.innerHTML = `
    <div class="score-card"><div class="score-big ${tone}">${s.score}<span class="score-of">/100</span></div><div class="score-verdict">Recomputed on every edit. Every point is traceable below.</div></div>
    ${formula}${reqList("required", "Required qualifications")}${reqList("preferred", "Preferred qualifications")}${quality}${ordering}${sugg}`;
  els.improve.hidden = !usable.length;
  els.improve.textContent = usable.length ? `Insert ${usable.length} evidenced bullet${usable.length > 1 ? "s" : ""}` : "Apply suggestions";
  document.getElementById("apply-order")?.addEventListener("click", () => {
    const i = state.doc.experience.findIndex((e) => e.org === s.bestOrg);
    if (i > 0) { const [e] = state.doc.experience.splice(i, 1); state.doc.experience.unshift(e); }
    renderEditor(); refreshPdf(); rescore(); persist();
  });
}

// Live: every edit recomputes the deterministic score (no model call).
function markScoreStale() { rescore(); }

// ── Outreach ─────────────────────────────────────────────────────────────

function outreachPrompt(company, jd) {
  const p = state.base.profile;
  return `You are a career coach helping a UC Berkeley Data Science student (expected graduation Dec 2027) get noticed for a specific role. Do NOT invent or guess any real person's name, email, or profile — describe people by role only.

Candidate: ${p.name}. Resume (JSON):
${JSON.stringify(currentResume(), null, 2)}

Company: ${company || "the company in the job description"}
Job Description:
${jd.slice(0, 10000)}

Suggest the 5 most useful kinds of people to contact about this role, most useful first — typically a university or early-career recruiter, the hiring manager or team lead for this team, a current intern or recent new-grad on the team, a UC Berkeley alum at the company, and one more that fits this company. For each give:
- "role": the job title to look for (specific to this company and team)
- "why": one sentence on why this person matters and what to ask them
- "linkedinQuery": the exact words to type into LinkedIn people search to find them (company name plus title keywords; add "Berkeley" for the alum)
- "note": a LinkedIn connection-request note under 280 characters, addressed to [Name], that mentions one specific true thing from the resume relevant to the role and one specific thing about the role or company. Warm, plain, no "I hope this finds you well", no flattery.
- "followUp": a 3-4 sentence message for after they accept (or for email/InMail): a bit more about why the candidate fits, one concrete ask (a 15-minute chat, a referral, or advice on the process), and an easy out.

Reply with only a JSON object: {"targets": [{"role": "...", "why": "...", "linkedinQuery": "...", "note": "...", "followUp": "..."}]}`;
}
const validTargets = (o) => Array.isArray(o?.targets) && o.targets.length > 0;

els.outreach.addEventListener("click", async () => {
  const jd = els.jd.value.trim();
  if (jd.length < 80) { setText(els.outreachStatus, "Paste the job description in the Job tab first.", "error"); return; }
  const o = await ask(outreachPrompt(els.company.value.trim(), jd), { btn: els.outreach, statusEl: els.outreachStatus, busyMsg: "Writing outreach for this role — usually 15–40 seconds…", validate: validTargets });
  if (!o) return;
  state.targets = o.targets;
  renderOutreach(); persist();
});

function renderOutreach() {
  const t = state.targets;
  if (!t) { els.outreachOut.innerHTML = ""; return; }
  els.outreachOut.innerHTML = t.map((x, i) => {
    const q = encodeURIComponent(x.linkedinQuery || `${els.company.value.trim()} ${x.role}`);
    return `
    <div class="target">
      <div class="target-head">
        <div class="target-role">${i + 1}. ${esc(x.role)}</div>
        <a class="btn tiny" href="https://www.linkedin.com/search/results/people/?keywords=${q}" target="_blank" rel="noopener">Search on LinkedIn</a>
      </div>
      <div class="target-why">${esc(x.why)}</div>
      <div class="sub-label">Connection note <span class="hint">(${(x.note || "").length}/300)</span></div>
      <div class="msg">${esc(x.note)}<button class="btn tiny copy" type="button" data-copy="${esc(x.note)}">Copy</button></div>
      <div class="sub-label">After they accept</div>
      <div class="msg">${esc(x.followUp)}<button class="btn tiny copy" type="button" data-copy="${esc(x.followUp)}">Copy</button></div>
    </div>`;
  }).join("");
}

els.outreachOut.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-copy]");
  if (!b) return;
  const text = b.dataset.copy;
  try { await navigator.clipboard.writeText(text); }
  catch (_) {
    const ta = document.createElement("textarea"); ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand("copy"); } catch (_) {}
    ta.remove();
  }
  b.textContent = "Copied"; setTimeout(() => { b.textContent = "Copy"; }, 1200);
});

// ── Editor ───────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const ed = (path, val, cls = "", ph = "") =>
  `<span contenteditable="plaintext-only" data-path="${esc(path)}" data-ph="${esc(ph)}" class="${cls}">${esc(val)}</span>`;

function bulletList(pathPrefix, items) {
  const rows = items.map((b, j) => `
    <div class="bl">
      <span class="dot">•</span>
      ${ed(`${pathPrefix}.${j}`, b, "txt", "New bullet")}
      <button class="rm" type="button" data-rm="${esc(pathPrefix)}.${j}" title="Remove bullet">×</button>
    </div>`).join("");
  return `<div class="bl-list">${rows}</div><button class="add-bl" type="button" data-add="${esc(pathPrefix)}">+ Add bullet</button>`;
}

function renderEditor() {
  const d = state.doc;
  if (!d) return;
  const mover = (list, i, n) => `<span class="mover"><button type="button" class="mv" data-move="${list}.${i}.-1" title="Move up" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" class="mv" data-move="${list}.${i}.1" title="Move down" ${i === n - 1 ? "disabled" : ""}>↓</button></span>`;
  const exp = d.experience.map((e, i) => `
    <div class="r-row entry"><span class="l">${mover("experience", i, d.experience.length)}${ed(`experience.${i}.org`, e.org)}</span><span class="r">${ed(`experience.${i}.dates`, e.dates)}</span></div>
    <div class="r-row sub"><span class="l">${ed(`experience.${i}.role`, e.role)}</span><span class="r">${ed(`experience.${i}.location`, e.location)}</span></div>
    ${bulletList(`experience.${i}.bullets`, e.bullets)}`).join("");
  const proj = d.projects.map((p, i) => `
    <div class="r-row entry"><span>${mover("projects", i, d.projects.length)}<span class="l">${ed(`projects.${i}.name`, p.name)}</span><span class="tech">| ${ed(`projects.${i}.tech`, p.tech)}</span></span><span class="r">${ed(`projects.${i}.dates`, p.dates)}</span></div>
    ${bulletList(`projects.${i}.bullets`, p.bullets)}`).join("");
  const skills = d.skills.map((s, i) =>
    `<div class="r-line"><b>${ed(`skills.${i}.cat`, s.cat)}:</b> ${ed(`skills.${i}.vals`, s.vals)}</div>`).join("");

  els.paper.innerHTML = `
    <div class="r-name">${ed("profile.name", d.profile.name)}</div>
    <div class="r-contact">${ed("profile.phone", d.profile.phone)} &nbsp;|&nbsp; ${ed("profile.email", d.profile.email)} &nbsp;|&nbsp; ${ed("profile.linkedin", d.profile.linkedin)}</div>
    <div class="r-sec">Education</div>
    <div class="r-row"><span class="l">${ed("education.school", d.education.school)}</span><span class="r">${ed("education.grad", d.education.grad)}</span></div>
    <div class="r-line italic">${ed("education.degree", d.education.degree)}</div>
    <div class="r-line"><b>Relevant Coursework:</b> ${ed("education.coursework", d.education.coursework)}</div>
    <div class="r-sec">Experience</div>${exp}
    <div class="r-sec">Projects</div>${proj}
    <div class="r-sec">Technical Skills</div>${skills}`;
  els.revert.hidden = !state.claudeVersion;
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
  cur[keys[keys.length - 1]] = value;
}
const getPath = (obj, path) => path.split(".").reduce((o, k) => o[k], obj);
const cleanText = (s) => s.replace(/\s+/g, " ").trim();

els.paper.addEventListener("input", (e) => {
  const el = e.target.closest("[data-path]");
  if (!el) return;
  setPath(state.doc, el.dataset.path, cleanText(el.textContent));
  markScoreStale(); scheduleRefresh(); persist();
});

els.paper.addEventListener("keydown", (e) => {
  const el = e.target.closest("[data-path]");
  if (!el) return;
  const isBullet = el.classList.contains("txt");
  if (e.key === "Enter") {
    e.preventDefault();
    if (!isBullet) { el.blur(); return; }
    const [listPath, idx] = splitIndex(el.dataset.path);
    getPath(state.doc, listPath).splice(idx + 1, 0, "");
    renderEditor(); focusPath(`${listPath}.${idx + 1}`); markScoreStale(); scheduleRefresh(); persist();
  } else if (e.key === "Backspace" && isBullet && el.textContent === "") {
    e.preventDefault();
    const [listPath, idx] = splitIndex(el.dataset.path);
    const list = getPath(state.doc, listPath);
    if (list.length <= 1) return;
    list.splice(idx, 1);
    renderEditor(); focusPath(`${listPath}.${Math.max(0, idx - 1)}`, true); markScoreStale(); scheduleRefresh(); persist();
  }
});

els.paper.addEventListener("click", (e) => {
  const rm = e.target.closest("[data-rm]");
  const add = e.target.closest("[data-add]");
  const mv = e.target.closest("[data-move]");
  if (mv) {
    const [list, i, dir] = mv.dataset.move.split(".");
    const arr = state.doc[list]; const from = Number(i), to = from + Number(dir);
    if (to < 0 || to >= arr.length) return;
    [arr[from], arr[to]] = [arr[to], arr[from]];
    renderEditor(); markScoreStale(); scheduleRefresh(); persist();
    return;
  }
  if (rm) {
    const [listPath, idx] = splitIndex(rm.dataset.rm);
    getPath(state.doc, listPath).splice(idx, 1);
    renderEditor(); markScoreStale(); scheduleRefresh(); persist();
  } else if (add) {
    const list = getPath(state.doc, add.dataset.add);
    list.push("");
    renderEditor(); focusPath(`${add.dataset.add}.${list.length - 1}`); markScoreStale(); scheduleRefresh(); persist();
  }
});

function splitIndex(path) { const i = path.lastIndexOf("."); return [path.slice(0, i), Number(path.slice(i + 1))]; }
function focusPath(path, atEnd = false) {
  const el = els.paper.querySelector(`[data-path="${CSS.escape(path)}"]`);
  if (!el) return;
  el.focus();
  if (atEnd && el.firstChild) {
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
}

// ── PDF ──────────────────────────────────────────────────────────────────

let refreshTimer = null;
function scheduleRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(refreshPdf, 350); }
function buildPdf() { return renderResumePDF(currentResume()); }

function refreshPdf() {
  if (!state.doc || !window.jspdf) return;
  const { doc, overflow, scale } = buildPdf();
  if (state.pdfUrl) URL.revokeObjectURL(state.pdfUrl);
  state.pdfUrl = URL.createObjectURL(doc.output("blob"));
  els.pdf.src = `${state.pdfUrl}#navpanes=0&view=FitH`;
  if (overflow) { els.fit.textContent = "Runs past one page — trim a bullet"; els.fit.className = "fit warn"; }
  else { els.fit.textContent = scale < 1 ? `Fits on one page · type at ${Math.round(scale * 100)}%` : "Fits on one page"; els.fit.className = "fit ok"; }
}

// ── Actions ──────────────────────────────────────────────────────────────

function setText(el, msg, kind = "") { el.textContent = msg; el.className = `status ${kind}`.trim(); }
function setStatus(msg, kind = "") { setText(els.status, msg, kind); }
function setJobHidden(hidden) {
  els.layout.classList.toggle("job-hidden", hidden);
  els.expandJob.hidden = !hidden;
  store.set("jobHidden", hidden);
}
els.collapseJob.addEventListener("click", () => setJobHidden(true));
els.expandJob.addEventListener("click", () => setJobHidden(false));

function baseDoc() {
  const b = state.base;
  return docFromTailored({
    experience: b.experience.map((e) => ({ ...e, bullets: e.bullets.slice(0, 3) })),
    projects: b.projects.map((p) => ({ ...p, bullets: p.bullets.slice(0, 2) })),
    skills: b.skills,
  });
}
els.useBase.addEventListener("click", () => {
  state.doc = baseDoc(); state.claudeVersion = null;
  markScoreStale(); renderEditor(); refreshPdf(); persist();
  setStatus("Editing your base resume (no AI). The PDF updates as you type.");
});
els.revert.addEventListener("click", () => {
  if (!state.claudeVersion) return;
  state.doc = clone(state.claudeVersion);
  markScoreStale(); renderEditor(); refreshPdf(); persist();
  setStatus("Reverted to Claude's version.");
});

els.download.addEventListener("click", async () => {
  const { doc, overflow, scale } = buildPdf();
  const company = (els.company.value.trim() || "Resume").replace(/[^A-Za-z0-9_-]+/g, "_");
  const name = state.doc.profile.name.replace(/\s+/g, "_");
  const filename = `${name}_${company}.pdf`;
  const fitNote = overflow ? " It still runs past one page — trim a bullet or two." : "";

  if (state.downloads === undefined) { setStatus("Still connecting to claude.ai — try again in a second."); return; }
  if (!state.downloads) { fallbackDownload(filename); return; }

  els.download.disabled = true;
  try {
    await state.downloads.save({ filename, data: doc.output("blob") });
    setStatus(`Saved ${filename}.${fitNote}`);
  } catch (e) {
    const code = e?.code;
    if (code === "declined") setStatus("Download cancelled — click Download PDF again and choose Save when claude.ai asks.");
    else if (code === "rate_limited") setStatus("A save prompt is already open — finish that one first.", "error");
    else fallbackDownload(filename, code);
  } finally {
    els.download.disabled = false;
  }
});

// When claude.ai can't save for us: open the PDF in its own tab, where the browser's
// PDF viewer has a working Save button; the preview pane's toolbar has one too.
function fallbackDownload(filename, code) {
  let opened = null;
  try { opened = window.open(state.pdfUrl, "_blank"); } catch (_) {}
  const why = code ? ` (claude.ai save failed: ${code})` : "";
  setStatus(opened
    ? `Opened the PDF in a new tab — use its Save/Download button and name it ${filename}.${why}`
    : `Use the download icon in the PDF pane's toolbar (top right of the preview) and name it ${filename}.${why}`,
    "error");
}

els.company.addEventListener("input", persist);
els.jd.addEventListener("input", persist);
els.jd.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") els.tailor.click(); });

// ── Base resume settings ─────────────────────────────────────────────────

els.openSettings.addEventListener("click", () => {
  els.baseResume.value = JSON.stringify(state.base, null, 2);
  els.settingsStatus.textContent = "";
  els.settings.showModal();
});
els.cancel.addEventListener("click", () => els.settings.close());
els.reset.addEventListener("click", () => { els.baseResume.value = JSON.stringify(DEFAULT_RESUME, null, 2); });
els.save.addEventListener("click", () => {
  let base;
  try {
    base = JSON.parse(els.baseResume.value);
    for (const k of ["profile", "education", "experience", "projects", "skills"]) if (!(k in base)) throw new Error(`Missing "${k}"`);
  } catch (e) {
    els.settingsStatus.textContent = `Resume JSON is invalid: ${e.message}`;
    els.settingsStatus.className = "status error";
    return;
  }
  state.base = base; store.set("baseResume", base);
  els.settings.close();
  setStatus("Base resume saved.");
});

// ── Capabilities light up when the viewer runtime answers ────────────────

load();
(async () => {
  if (!window.claude?.use) {
    state.sample = null; state.downloads = null;
    hideClaudeButtons();
    setStatus("Open this page inside claude.ai to use Claude. Editing and the PDF preview work here; download via the PDF pane's toolbar.");
    return;
  }
  const [sample, downloads] = await Promise.all([claude.use("sample"), claude.use("downloads")]);
  state.sample = sample; state.downloads = downloads;
  const off = [];
  if (!sample) { hideClaudeButtons(); off.push("Claude tailoring"); }
  if (!downloads) off.push("one-click save");
  if (off.length) setStatus(`${off.join(" and ")} ${off.length > 1 ? "aren't" : "isn't"} available in this view — usually because the page was opened outside the claude.ai viewer. Editing works; download via the PDF pane's toolbar.`);
  else if (!els.status.textContent) setStatus("Paste a job description and click Tailor with Claude.");
})();
