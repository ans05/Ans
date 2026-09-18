const $ = (id) => document.getElementById(id);
const els = {
  layout: $("layout"), inputPanel: $("input-panel"), collapseJob: $("collapse-job"), expandJob: $("expand-job"),
  company: $("company"), jd: $("jd"),
  tailor: $("tailor"), useBase: $("use-base"), stop: $("stop"), status: $("status"), saved: $("saved"),
  paper: $("paper"), pdf: $("pdf"), fit: $("fit"), download: $("download"), revert: $("revert"), projectsFirst: $("projects-first"),
  settings: $("settings"), openSettings: $("open-settings"),
  baseResume: $("base-resume"), save: $("save-settings"), cancel: $("cancel-settings"),
  reset: $("reset-resume"), settingsStatus: $("settings-status"),
  rate: $("rate"), improve: $("improve"), scoreStatus: $("score-status"), scoreOut: $("score-out"),
  outreach: $("outreach"), outreachStatus: $("outreach-status"), outreachOut: $("outreach-out"),
};
const S = window.Scoring;
const BANK = EVIDENCE_BANK;

let state = {
  base: DEFAULT_RESUME, doc: null, claudeVersion: null, pdfUrl: null,
  sample: undefined, downloads: undefined, ctl: null,
  reqs: null,          // { key, items: [{statement, category, capabilities, keywords}] }
  result: null,        // canonical evaluation from Scoring.evaluate
  targets: null, names: {},
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const skillsToArray = (obj) => Array.isArray(obj) ? obj : Object.entries(obj).map(([cat, vals]) => ({ cat, vals }));
const skillsToObject = (arr) => Object.fromEntries(arr.filter((s) => s.cat).map((s) => [s.cat, s.vals]));
const currentResume = () => ({ ...state.doc, skills: skillsToObject(state.doc.skills) });
const bankEntry = (id) => BANK.entries.find((e) => e.id === id);
const bankFact = (id) => { for (const e of BANK.entries) { const f = e.facts.find((f) => f.id === id); if (f) return { fact: f, entry: e }; } return null; };
function hashStr(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return String(h >>> 0); }
const cacheKey = (jd) => `${hashStr(jd.trim())}|${S.SCORING_VERSION}|bank${BANK.version}`;

// ── Storage ──────────────────────────────────────────────────────────────

const store = {
  get(k) { try { const v = localStorage.getItem("rt:" + k); return v ? JSON.parse(v) : null; } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem("rt:" + k, JSON.stringify(v)); } catch (_) {} },
};

function load() {
  state.base = store.get("baseCustomized") ? (store.get("baseResume") || DEFAULT_RESUME) : DEFAULT_RESUME;
  if (store.get("jobHidden")) setJobHidden(true);
  const last = store.get("lastResult");
  if (last) {
    els.company.value = last.company || "";
    els.jd.value = last.jd || "";
    state.doc = last.doc || null;
    state.claudeVersion = last.claudeVersion || null;
    state.reqs = last.reqs && last.reqs.key === cacheKey(els.jd.value) ? last.reqs : null; // stale extraction is discarded
    state.targets = last.targets || null;
    state.names = last.names || {};
  }
  if (!state.doc) state.doc = baseDoc();
  if (!state.doc.sectionOrder) state.doc.sectionOrder = ["experience", "projects"];
  renderEditor(); refreshPdf(); rescore();
  if (state.targets) renderOutreach();
  showTab(store.get("tab") || "job");
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    store.set("lastResult", { company: els.company.value.trim(), jd: els.jd.value, doc: state.doc, claudeVersion: state.claudeVersion, reqs: state.reqs, targets: state.targets, names: state.names });
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
function hideClaudeButtons() { for (const b of [els.tailor, els.rate, els.outreach]) b.hidden = true; }

// ── Tailoring (select verified facts; the fact guard rejects anything new) ─

function bankForPrompt() {
  return BANK.entries.map((e) => ({
    id: e.id, kind: e.kind, org: e.org, role: e.role,
    facts: e.facts.map((f) => ({ id: f.id, text: f.text, tags: f.tags })),
  }));
}

function tailorPrompt(jd, ranked) {
  const priority = ranked.slice(0, 3).map((r) => `${r.name} (${r.hits.join(", ") || "general"})`).join("; ");
  return `You are tailoring a one-page early-career résumé to a job description. You may only SELECT, SHORTEN, REORDER, and lightly REPHRASE the verified facts below. You may not add any title, employer, date, tool, metric, audience size, stakeholder, experiment, deliverable, or result that is not in the fact you selected. If the job asks for something no fact supports, leave it out — do not fill the gap.

Verified evidence bank (each fact has an id):
${JSON.stringify(bankForPrompt(), null, 1)}

Skills the candidate may list (choose and reorder from these only):
${JSON.stringify(BANK.skills)}

Job description:
${jd.slice(0, 12000)}

Evidence ranking for this role (computed from the posting; strongest first): ${priority}

Reply with only JSON:
{
  "experience": [{"id": "<entry id>", "bullets": [{"factId": "<fact id>", "text": "<fact text, optionally shortened or rephrased>"}]}],
  "projects":   [{"id": "<entry id>", "bullets": [{"factId": "...", "text": "..."}]}],
  "skills": {"<category>": "<comma-separated items from the allowed skills>"},
  "omittedBecauseUnsupported": ["short notes on posting asks you could not evidence"]
}

Rules:
- Include every entry. Give the strongest entries for this role 3-4 bullets and the weakest 2. Pick each entry's bullets by relevance to the posting, not by their original order.
- Prefer facts whose tags match what the posting asks for. Avoid selecting two facts that say nearly the same thing (e.g. several LLM-evaluation facts).
- Rephrasing: natural résumé language, past tense, no label prefixes like "Keyword:", no copying the posting's sentences, no keyword stuffing, no exaggeration of scale or seniority. Keep every metric exactly as in the fact.
- Skills: lead each category with the items most relevant to this posting; do not add items that are not in the allowed list.`;
}
const validTailored = (t) => Array.isArray(t?.experience) && Array.isArray(t?.projects) && t?.skills && typeof t.skills === "object";

// Rebuild the document from the bank using the model's selections; anything unverifiable is replaced by the source fact.
function docFromSelection(sel) {
  const guardNotes = [];
  const build = (kind) => {
    const chosen = (kind === "experience" ? sel.experience : sel.projects) || [];
    const entries = BANK.entries.filter((e) => e.kind === kind);
    return entries.map((e) => {
      const pick = chosen.find((c) => c.id === e.id);
      let bullets = [];
      const seen = new Set();
      for (const b of pick?.bullets || []) {
        const src = bankFact(b.factId);
        if (!src || src.entry.id !== e.id || seen.has(b.factId)) continue;
        seen.add(b.factId);
        let text = String(b.text || src.fact.text).replace(/^[^:]{1,40}:\s*/, "").trim();
        const g = S.factGuard(text, src.fact, e);
        if (!g.ok) { guardNotes.push(`${e.org}: ${g.problems.join("; ")} — used the verified fact text instead`); text = src.fact.text; }
        bullets.push({ factId: b.factId, text });
      }
      if (!bullets.length) bullets = e.facts.slice(0, 2).map((f) => ({ factId: f.id, text: f.text }));
      const base = { id: e.id, dates: e.dates, bullets: bullets.map((b) => b.text), factIds: bullets.map((b) => b.factId) };
      return kind === "experience"
        ? { ...base, org: e.org, role: e.role, location: e.location }
        : { ...base, name: e.org, tech: `${e.role} | ${e.tech}` };
    });
  };
  // Skills: only items that appear in the bank's allowed skills text.
  const allowed = Object.values(BANK.skills).join(", ").split(/,\s*/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const skills = Object.entries(sel.skills || BANK.skills).map(([cat, vals]) => {
    const items = String(vals).split(/,\s*/).map((s) => s.trim()).filter((s) => s && allowed.some((a) => a === s.toLowerCase() || a.startsWith(s.toLowerCase() + " (")));
    return { cat, vals: items.join(", ") };
  }).filter((s) => s.vals);
  return { doc: { profile: clone(BANK.profile), education: clone(state.base.education), experience: build("experience"), projects: build("project"), skills: skills.length ? skills : skillsToArray(BANK.skills), sectionOrder: ["experience", "projects"] }, guardNotes };
}

// Deterministic emphasis: order entries by evidence for this posting; put Projects first when a project is the strongest evidence.
function applyRanking(doc) {
  const caps = scoredCapabilityIds();
  if (!caps.length) return false;
  const ranked = S.rankEntries(doc, caps, S.detectRoleType(els.jd.value));
  const order = (kind) => ranked.filter((r) => r.kind === kind).map((r) => r.id);
  const before = JSON.stringify([doc.experience.map((e) => e.id), doc.sectionOrder]);
  doc.experience.sort((a, b) => order("experience").indexOf(a.id) - order("experience").indexOf(b.id));
  doc.projects.sort((a, b) => order("project").indexOf(a.id) - order("project").indexOf(b.id));
  const top = ranked[0];
  doc.sectionOrder = top && top.kind === "project" && top.score > (ranked.find((r) => r.kind === "experience")?.score || 0) ? ["projects", "experience"] : ["experience", "projects"];
  return JSON.stringify([doc.experience.map((e) => e.id), doc.sectionOrder]) !== before;
}
function scoredCapabilityIds() {
  return [...new Set((state.reqs?.items || []).filter((i) => ["required_qualification", "preferred_qualification", "responsibility"].includes(S.classify(i))).flatMap((i) => i.capabilities || []))];
}

els.tailor.addEventListener("click", async () => {
  const jd = els.jd.value.trim();
  if (jd.length < 80) { setStatus("Paste the full job description first.", "error"); return; }
  const reqs = await ensureRequirements(jd);
  if (!reqs) return;
  const ranked = S.rankEntries(state.base, scoredCapabilityIds(), S.detectRoleType(jd));
  const sel = await ask(tailorPrompt(jd, ranked), { btn: els.tailor, statusEl: els.status, busyMsg: "Tailoring from your verified evidence bank — usually 15–40 seconds…", validate: validTailored });
  if (!sel) return;
  const { doc, guardNotes } = docFromSelection(sel);
  state.doc = doc;
  applyRanking(state.doc);
  state.claudeVersion = clone(state.doc);
  renderEditor(); refreshPdf(); rescore(); persist();
  const omitted = (sel.omittedBecauseUnsupported || []).filter(Boolean);
  const r = state.result;
  toast(`Tailored. Evidence Match Score ${r ? r.score : "—"}/100.${guardNotes.length ? ` Fact guard replaced ${guardNotes.length} unverifiable rewrite${guardNotes.length > 1 ? "s" : ""}.` : ""}${omitted.length ? ` Left out (no evidence): ${omitted.slice(0, 3).join("; ")}.` : ""}`, "ok");
  setStatus("Done. Edit anything in the middle; the PDF and score update as you type.");
  showTab("score");
});

// ── Score (canonical evaluation; extraction is the only model call) ──────

const CAP_LIST = Object.entries(S.CAPABILITIES).map(([id, c]) => `${id} — ${c.label}`).join("\n");

function extractPrompt(jd) {
  return `Extract every distinct statement from this job posting that describes the candidate or the job, and classify each. Reply with only JSON:
{"items": [{"statement": "quoted or closely paraphrased from the posting", "category": "required_qualification" | "preferred_qualification" | "responsibility" | "company_language" | "logistics" | "subjective_trait", "capabilities": ["ids from the list below"], "keywords": ["2-4 concrete terms"]}]}

Categories:
- required_qualification: what the candidate must have ("you have", requirements, basic qualifications)
- preferred_qualification: nice-to-have / bonus / "exceptional candidates"
- responsibility: what the intern will do ("you will", "what you'll do")
- company_language: mission, culture, "every day millions of people…"
- logistics: visa/work authorization, location, hours, pay, dates
- subjective_trait: passion, curiosity, enthusiasm, "delight users" — traits that cannot be verified from a résumé

Rules: split compound statements so that each capability is its own item (e.g. "write specifications, experimentation plans and go-to-market briefs" → three items). A degree/field requirement is required_qualification with capability degree_related_field. Use only capability ids from this list; if none fits, leave capabilities empty and rely on keywords:
${CAP_LIST}

Job posting:
${jd.slice(0, 12000)}`;
}
const validExtract = (o) => Array.isArray(o?.items) && o.items.every((i) => i && typeof i.statement === "string");

async function ensureRequirements(jd) {
  const key = cacheKey(jd);
  if (state.reqs?.key === key) return state.reqs.items;
  const out = await ask(extractPrompt(jd), { btn: els.rate, statusEl: els.scoreStatus, busyMsg: "Reading the posting's qualifications and responsibilities (one-time per job)…", validate: validExtract });
  if (!out) return null;
  const known = new Set(Object.keys(S.CAPABILITIES));
  state.reqs = { key, items: out.items.map((i) => ({
    statement: i.statement.trim(),
    category: S.CATEGORIES.includes(i.category) ? i.category : "responsibility",
    capabilities: (i.capabilities || []).map(String).filter((c) => known.has(c)),
    keywords: (i.keywords || []).map(String),
  })) };
  persist();
  return state.reqs.items;
}

// Recomputed from the current document on every edit; no model call.
function rescore() {
  if (!state.reqs?.items || !state.doc) { state.result = null; renderScore(); return; }
  state.result = S.evaluate(state.reqs.items, currentResume(), { roleType: S.detectRoleType(els.jd.value) });
  renderScore();
}

els.rate.addEventListener("click", async () => {
  const jd = els.jd.value.trim();
  if (jd.length < 80) { setText(els.scoreStatus, "Paste the job description in the Job tab first.", "error"); return; }
  const items = await ensureRequirements(jd);
  if (!items) return;
  rescore(); persist();
  setText(els.scoreStatus, `Scored ${state.result.counts.scorable} evidence items; ${state.result.counts.not_scorable} not scorable.`);
});

// Add bank facts that evidence a missing capability (never invents; only surfaces verified facts not currently on the page).
function bankFactsFor(capId) {
  const out = [];
  for (const e of BANK.entries) for (const f of e.facts) {
    const units = S.resumeUnits({ experience: [{ org: e.org, bullets: [f.text] }], projects: [], education: {}, skills: {} });
    const r = S.evaluateCapability(capId, units);
    if (r.status === "matched") out.push({ entry: e, fact: f });
  }
  return out;
}
function onPage(factId) { return [...state.doc.experience, ...state.doc.projects].some((en) => (en.factIds || []).includes(factId)); }

els.improve.addEventListener("click", () => {
  if (!state.result) return;
  let added = 0;
  for (const item of [...state.result.missing, ...state.result.partial]) {
    if (!item.capability) continue;
    const cands = bankFactsFor(item.capability).filter((c) => !onPage(c.fact.id));
    if (!cands.length) continue;
    const { entry, fact } = cands[0];
    const target = entry.kind === "experience" ? state.doc.experience.find((e) => e.id === entry.id) : state.doc.projects.find((p) => p.id === entry.id);
    if (!target) continue;
    const cap = entry.kind === "experience" ? 4 : 3;
    if (target.bullets.length >= cap) { const i = weakestIndex(target); target.bullets[i] = fact.text; target.factIds[i] = fact.id; }
    else { target.bullets.push(fact.text); target.factIds.push(fact.id); }
    added++;
  }
  if (added) { applyRanking(state.doc); renderEditor(); refreshPdf(); rescore(); persist(); }
  setText(els.scoreStatus, added ? `Added ${added} verified fact${added > 1 ? "s" : ""} from your evidence bank.` : "No unused verified fact evidences the missing items — they need confirmation from you.");
});

function weakestIndex(entry) {
  const caps = scoredCapabilityIds();
  const scored = entry.bullets.map((b, i) => {
    const units = S.resumeUnits({ experience: [{ org: "x", bullets: [b] }], projects: [], education: {}, skills: {} });
    const hits = caps.filter((c) => S.evaluateCapability(c, units).status !== "missing").length;
    const q = S.bulletQuality(b).pass ? 1 : 0;
    return { i, hits, q, len: b.length };
  }).sort((a, b) => a.hits - b.hits || a.q - b.q || b.len - a.len);
  return scored[0].i;
}

function renderScore() {
  const r = state.result;
  if (!r) { els.scoreOut.innerHTML = state.reqs ? "" : `<p class="hint">Click <b>Rate match</b> to read the posting and score the current résumé.</p>`; els.improve.hidden = true; return; }
  const tone = r.score >= 80 ? "good" : r.score >= 60 ? "mid" : "low";
  const C = r.components;
  const compRows = Object.entries(C).filter(([, c]) => c.weight > 0).map(([k, c]) => `
    <div class="formula-row"><span>${{ required: "Required qualifications", preferred: "Preferred qualifications", responsibility: "Responsibilities / capabilities", quality: "Bullet quality", ordering: "Evidence ordering" }[k]}<span class="ev">${esc(c.label)}</span></span><span>${c.weight.toFixed(0)} × ${c.value.toFixed(2)}</span><b>${c.points.toFixed(1)}</b></div>`).join("");

  const statusMark = { matched: "✓", partially_matched: "◐", missing: "✗", not_scorable: "—" };
  const li = (i) => `
    <li class="${i.status === "matched" ? "ok" : i.status === "partially_matched" ? "part" : i.status === "missing" ? "miss" : "na"}">
      <span class="mark">${statusMark[i.status]}</span>
      <span class="req">
        <span>${esc(i.label || i.statement)}${i.label && i.label !== i.statement ? ` <span class="ev">— from “${esc(i.statement)}”</span>` : ""}</span>
        ${i.status === "not_scorable" ? `<span class="ev">${esc(i.reason)}</span>` : i.status === "missing"
          ? `<span class="ev">${esc(i.reason)}.${i.evidence ? ` Closest: ${esc(i.evidence)}.` : ""}</span>`
          : `<span class="ev"><b>${i.status === "matched" ? "Evidence" : "Partial evidence"}</b> (${esc(i.evidenceType)}, ${esc(i.confidence)} confidence): “${esc(i.evidence)}” — ${esc(i.where)}. ${esc(i.reason)}.</span>`}
      </span>
    </li>`;
  const group = (title, arr) => arr.length ? `<div class="sub-label">${title} (${arr.length})</div><ul class="checks">${arr.map(li).join("")}</ul>` : "";
  const byCat = (cat) => r.items.filter((i) => i.category === cat);

  const missingList = r.missing.length ? `
    <div class="sub-label">Missing — needs your confirmation (${r.missing.length})</div>
    <ul class="checks">${r.missing.map((i) => `<li class="miss"><span class="mark">?</span><span class="req"><span>${esc(i.label || i.statement)}</span><span class="ev">Nothing in your verified evidence bank demonstrates this. If you have done it, tell Claude the specific facts (what, where, when, any numbers) so it can be added to the bank — the tool will not fill this gap on its own.</span></span></li>`).join("")}</ul>` : "";

  els.scoreOut.innerHTML = `
    <div class="score-card"><div class="score-big ${tone}">${r.score}<span class="score-of">/100</span></div>
      <div class="score-verdict"><b>Evidence Match Score</b> — ${r.counts.matched} matched · ${r.counts.partially_matched} partial · ${r.counts.missing} missing of ${r.counts.scorable} scorable items; ${r.counts.not_scorable} not scorable. Internal evidence-coverage estimate, not a prediction of an employer's ATS or interview decision. Recomputed on every edit.</div></div>
    <div class="formula">${compRows}<div class="formula-row total"><span>Score</span><span></span><b>${r.score}</b></div></div>
    ${group("Required qualifications", byCat("required_qualification"))}
    ${group("Preferred qualifications", byCat("preferred_qualification"))}
    ${group("Responsibilities and capabilities", byCat("responsibility"))}
    ${missingList}
    ${r.notScorable.length ? `<div class="sub-label">Not scored (${r.notScorable.length})</div><ul class="checks">${r.notScorable.map(li).join("")}</ul>` : ""}
    <div class="sub-label">Bullet quality (${r.bullets.filter((b) => b.pass).length}/${r.bullets.length} pass)</div>
    ${r.bullets.some((b) => !b.pass) ? `<ul class="checks">${r.bullets.filter((b) => !b.pass).map((b) => `<li class="miss"><span class="mark">✗</span><span class="req"><span>${esc(b.where)}</span><span class="ev">${esc(b.notes.join(" · "))}</span></span></li>`).join("")}</ul>` : `<div class="hint">Every bullet opens with a strong verb and carries either a metric or a concrete scope with an outcome.</div>`}
    <div class="sub-label">Evidence ordering</div><div class="hint">${esc(C.ordering.label)}${C.ordering.value < 1 ? ` <button class="btn tiny" type="button" id="apply-order">Reorder by evidence</button>` : ""}</div>`;
  const bankable = [...r.missing, ...r.partial].some((i) => i.capability && bankFactsFor(i.capability).some((c) => !onPage(c.fact.id)));
  els.improve.hidden = !bankable;
  document.getElementById("apply-order")?.addEventListener("click", () => { applyRanking(state.doc); renderEditor(); refreshPdf(); rescore(); persist(); });
}

// ── Outreach ─────────────────────────────────────────────────────────────

const AUDIENCES = [
  { key: "recruiter", role: "University / early-career recruiter", tone: "brief and low-pressure; do not ask for a call or a referral; ask nothing beyond connecting and a one-line note that the application is in" },
  { key: "pm", role: "Product manager on the team", tone: "peer-to-peer and specific about the product work; ask for their perspective on the role in one sentence, no call request" },
  { key: "alum", role: "UC Berkeley alum at the company", tone: "warm Berkeley connection; ask one question about their path or the team, no call request" },
];

function outreachPrompt(company, jd) {
  const p = BANK.profile;
  const resume = currentResume();
  return `Write LinkedIn outreach for a UC Berkeley Data Science student (${p.name}, expected graduation Dec 2027) applying to this role. Do NOT invent or guess any real person's name, email, or profile. Use only facts from the résumé. Do not claim the recipient can flag or forward the application, do not ask for a call, coffee, or "15 minutes", do not claim interest in the company's domain unless it is in the résumé.

Résumé (JSON):
${JSON.stringify(resume, null, 1)}

Company: ${company || "the company in the posting"}
Job description:
${jd.slice(0, 8000)}

Strongest product-management evidence to lead with: Project GoalKeeper — founded and built an iOS app for 100+ athletes, ran A/B tests that increased session duration 30%, led product strategy and user research. Mention the recommendation-system work only if the role is data-heavy.

For each audience write:
- "note": a connection-request note under 260 characters. Start with "Hi {{name}}," and write it so it still reads well if {{name}} is removed. One specific true thing from the résumé, one specific thing about the role.
- "followUp": 3-4 sentences for after they accept: why the candidate fits (evidence), one small ask matching the audience, and an easy out.
- "linkedinQuery": exact LinkedIn people-search words to find this kind of person at the company.

Audiences: ${AUDIENCES.map((a) => `${a.key} = ${a.role} (${a.tone})`).join("; ")}

Reply with only JSON: {"targets": [{"audience": "recruiter"|"pm"|"alum", "role": "...", "why": "...", "linkedinQuery": "...", "note": "...", "followUp": "..."}]}`;
}
const validTargets = (o) => Array.isArray(o?.targets) && o.targets.length > 0;

els.outreach.addEventListener("click", async () => {
  const jd = els.jd.value.trim();
  if (jd.length < 80) { setText(els.outreachStatus, "Paste the job description in the Job tab first.", "error"); return; }
  const o = await ask(outreachPrompt(els.company.value.trim(), jd), { btn: els.outreach, statusEl: els.outreachStatus, busyMsg: "Writing outreach for this role — usually 15–40 seconds…", validate: validTargets });
  if (!o) return;
  state.targets = o.targets.map((t) => ({ ...t, audience: AUDIENCES.some((a) => a.key === t.audience) ? t.audience : "pm" }));
  renderOutreach(); persist();
});

function composed(t, i) {
  const name = state.names[i] || "";
  const note = S.validateNote(t.note, { name });
  const follow = S.validateNote(t.followUp, { name, limit: 1200 });
  return { note, follow };
}

function renderOutreach() {
  const t = state.targets;
  if (!t) { els.outreachOut.innerHTML = ""; return; }
  els.outreachOut.innerHTML = t.map((x, i) => {
    const { note, follow } = composed(x, i);
    const q = encodeURIComponent(x.linkedinQuery || `${els.company.value.trim()} ${x.role}`);
    const over = note.length > S.NOTE_LIMIT;
    return `
    <div class="target" data-i="${i}">
      <div class="target-head">
        <div class="target-role">${i + 1}. ${esc(x.role)} <span class="hint">(${esc(x.audience)})</span></div>
        <a class="btn tiny" href="https://www.linkedin.com/search/results/people/?keywords=${q}" target="_blank" rel="noopener">Search on LinkedIn</a>
      </div>
      <div class="target-why">${esc(x.why || "")}</div>
      <label class="field"><span class="label">Recipient's first name <span class="hint">(leave blank for a name-free version)</span></span><input type="text" class="name-in" data-i="${i}" value="${esc(state.names[i] || "")}" placeholder="e.g. Priya"></label>
      <div class="sub-label">Connection note <span class="hint counter ${over ? "over" : ""}">${note.length}/${S.NOTE_LIMIT}</span>${note.issues.length ? ` <span class="hint">· ${esc(note.issues.join("; "))}</span>` : ""}</div>
      <div class="msg">${esc(note.text)}<button class="btn tiny copy" type="button" data-copy="${esc(note.text)}" ${note.ok ? "" : "disabled"}>Copy</button></div>
      <div class="sub-label">After they accept <span class="hint">${follow.length} chars</span></div>
      <div class="msg">${esc(follow.text)}<button class="btn tiny copy" type="button" data-copy="${esc(follow.text)}">Copy</button></div>
    </div>`;
  }).join("");
}

els.outreachOut.addEventListener("input", (e) => {
  const inp = e.target.closest(".name-in");
  if (!inp) return;
  state.names[inp.dataset.i] = inp.value;
  const card = inp.closest(".target"); const i = Number(card.dataset.i);
  const { note, follow } = composed(state.targets[i], i);
  card.querySelector(".counter").textContent = `${note.length}/${S.NOTE_LIMIT}`;
  card.querySelector(".counter").classList.toggle("over", note.length > S.NOTE_LIMIT);
  const msgs = card.querySelectorAll(".msg");
  msgs[0].firstChild.textContent = note.text; msgs[0].querySelector(".copy").dataset.copy = note.text; msgs[0].querySelector(".copy").disabled = !note.ok;
  msgs[1].firstChild.textContent = follow.text; msgs[1].querySelector(".copy").dataset.copy = follow.text;
  persist();
});

els.outreachOut.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-copy]");
  if (!b || b.disabled) return;
  const text = b.dataset.copy;
  try { await navigator.clipboard.writeText(text); }
  catch (_) { const ta = document.createElement("textarea"); ta.value = text; document.body.append(ta); ta.select(); try { document.execCommand("copy"); } catch (_) {} ta.remove(); }
  b.textContent = "Copied"; setTimeout(() => { b.textContent = "Copy"; }, 1200);
});

// ── Editor ───────────────────────────────────────────────────────────────

function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
const ed = (path, val, cls = "", ph = "") => `<span contenteditable="plaintext-only" data-path="${esc(path)}" data-ph="${esc(ph)}" class="${cls}">${esc(val)}</span>`;

function bulletList(pathPrefix, items) {
  const rows = items.map((b, j) => `
    <div class="bl"><span class="dot">•</span>${ed(`${pathPrefix}.${j}`, b, "txt", "New bullet")}<button class="rm" type="button" data-rm="${esc(pathPrefix)}.${j}" title="Remove bullet">×</button></div>`).join("");
  return `<div class="bl-list">${rows}</div><button class="add-bl" type="button" data-add="${esc(pathPrefix)}">+ Add bullet</button>`;
}

function renderEditor() {
  const d = state.doc;
  if (!d) return;
  const mover = (list, i, n) => `<span class="mover"><button type="button" class="mv" data-move="${list}.${i}.-1" title="Move up" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" class="mv" data-move="${list}.${i}.1" title="Move down" ${i === n - 1 ? "disabled" : ""}>↓</button></span>`;
  const exp = `<div class="r-sec">Experience</div>` + d.experience.map((e, i) => `
    <div class="r-row entry"><span class="l">${mover("experience", i, d.experience.length)}${ed(`experience.${i}.org`, e.org)}</span><span class="r">${ed(`experience.${i}.dates`, e.dates)}</span></div>
    <div class="r-row sub"><span class="l">${ed(`experience.${i}.role`, e.role)}</span><span class="r">${ed(`experience.${i}.location`, e.location)}</span></div>
    ${bulletList(`experience.${i}.bullets`, e.bullets)}`).join("");
  const proj = `<div class="r-sec">Projects</div>` + d.projects.map((p, i) => `
    <div class="r-row entry"><span>${mover("projects", i, d.projects.length)}<span class="l">${ed(`projects.${i}.name`, p.name)}</span><span class="tech">| ${ed(`projects.${i}.tech`, p.tech)}</span></span><span class="r">${ed(`projects.${i}.dates`, p.dates)}</span></div>
    ${bulletList(`projects.${i}.bullets`, p.bullets)}`).join("");
  const skills = d.skills.map((s, i) => `<div class="r-line"><b>${ed(`skills.${i}.cat`, s.cat)}:</b> ${ed(`skills.${i}.vals`, s.vals)}</div>`).join("");
  const order = d.sectionOrder?.[0] === "projects" ? proj + exp : exp + proj;

  els.paper.innerHTML = `
    <div class="r-name">${ed("profile.name", d.profile.name)}</div>
    <div class="r-contact">${ed("profile.phone", d.profile.phone)} &nbsp;|&nbsp; ${ed("profile.email", d.profile.email)} &nbsp;|&nbsp; ${ed("profile.linkedin", d.profile.linkedin)}</div>
    <div class="r-sec">Education</div>
    <div class="r-row"><span class="l">${ed("education.school", d.education.school)}</span><span class="r">${ed("education.grad", d.education.grad)}</span></div>
    <div class="r-line italic">${ed("education.degree", d.education.degree)}</div>
    <div class="r-line"><b>Relevant Coursework:</b> ${ed("education.coursework", d.education.coursework)}</div>
    ${order}
    <div class="r-sec">Skills</div>${skills}`;
  els.revert.hidden = !state.claudeVersion;
  els.projectsFirst.checked = d.sectionOrder?.[0] === "projects";
}

function setPath(obj, path, value) { const k = path.split("."); let c = obj; for (let i = 0; i < k.length - 1; i++) c = c[k[i]]; c[k[k.length - 1]] = value; }
const getPath = (obj, path) => path.split(".").reduce((o, k) => o[k], obj);
const cleanText = (s) => s.replace(/\s+/g, " ").trim();
const afterEdit = () => { scheduleRefresh(); rescore(); persist(); };

els.paper.addEventListener("input", (e) => {
  const el = e.target.closest("[data-path]");
  if (!el) return;
  setPath(state.doc, el.dataset.path, cleanText(el.textContent));
  afterEdit();
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
    factIdsFor(listPath)?.splice(idx + 1, 0, null);
    renderEditor(); focusPath(`${listPath}.${idx + 1}`); afterEdit();
  } else if (e.key === "Backspace" && isBullet && el.textContent === "") {
    e.preventDefault();
    const [listPath, idx] = splitIndex(el.dataset.path);
    const list = getPath(state.doc, listPath);
    if (list.length <= 1) return;
    list.splice(idx, 1); factIdsFor(listPath)?.splice(idx, 1);
    renderEditor(); focusPath(`${listPath}.${Math.max(0, idx - 1)}`, true); afterEdit();
  }
});
function factIdsFor(listPath) { const m = /^(experience|projects)\.(\d+)\.bullets$/.exec(listPath); return m ? state.doc[m[1]][m[2]].factIds : null; }

els.paper.addEventListener("click", (e) => {
  const rm = e.target.closest("[data-rm]"), add = e.target.closest("[data-add]"), mv = e.target.closest("[data-move]");
  if (mv) {
    const [list, i, dir] = mv.dataset.move.split("."); const arr = state.doc[list]; const from = Number(i), to = from + Number(dir);
    if (to < 0 || to >= arr.length) return;
    [arr[from], arr[to]] = [arr[to], arr[from]];
    renderEditor(); afterEdit(); return;
  }
  if (rm) { const [listPath, idx] = splitIndex(rm.dataset.rm); getPath(state.doc, listPath).splice(idx, 1); factIdsFor(listPath)?.splice(idx, 1); renderEditor(); afterEdit(); }
  else if (add) { const list = getPath(state.doc, add.dataset.add); list.push(""); factIdsFor(add.dataset.add)?.push(null); renderEditor(); focusPath(`${add.dataset.add}.${list.length - 1}`); afterEdit(); }
});
els.projectsFirst.addEventListener("change", () => { state.doc.sectionOrder = els.projectsFirst.checked ? ["projects", "experience"] : ["experience", "projects"]; renderEditor(); afterEdit(); });

function splitIndex(path) { const i = path.lastIndexOf("."); return [path.slice(0, i), Number(path.slice(i + 1))]; }
function focusPath(path, atEnd = false) {
  const el = els.paper.querySelector(`[data-path="${CSS.escape(path)}"]`);
  if (!el) return;
  el.focus();
  if (atEnd && el.firstChild) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
}

// ── PDF ──────────────────────────────────────────────────────────────────

let refreshTimer = null;
function scheduleRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(refreshPdf, 350); }
function buildPdf() { return renderResumePDF(currentResume()); }

function refreshPdf() {
  if (!state.doc) return;
  if (!window.jspdf) { els.fit.textContent = "PDF engine failed to load — reload the page"; els.fit.className = "fit warn"; return; }
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
function setJobHidden(hidden) { els.layout.classList.toggle("job-hidden", hidden); els.expandJob.hidden = !hidden; store.set("jobHidden", hidden); }
els.collapseJob.addEventListener("click", () => setJobHidden(true));
els.expandJob.addEventListener("click", () => setJobHidden(false));

function baseDoc() {
  const b = state.base;
  return {
    profile: clone(b.profile), education: clone(b.education),
    experience: b.experience.map((e) => ({ ...clone(e), bullets: e.bullets.slice(0, 3), factIds: (e.factIds || []).slice(0, 3) })),
    projects: b.projects.map((p) => ({ ...clone(p), bullets: p.bullets.slice(0, 2), factIds: (p.factIds || []).slice(0, 2) })),
    skills: skillsToArray(clone(b.skills)), sectionOrder: ["experience", "projects"],
  };
}
els.useBase.addEventListener("click", () => { state.doc = baseDoc(); state.claudeVersion = null; renderEditor(); refreshPdf(); rescore(); persist(); setStatus("Editing your base résumé (no AI). The PDF and score update as you type."); });
els.revert.addEventListener("click", () => { if (!state.claudeVersion) return; state.doc = clone(state.claudeVersion); renderEditor(); refreshPdf(); rescore(); persist(); setStatus("Reverted to Claude's version."); });

els.download.addEventListener("click", async () => {
  els.download.disabled = true;
  try {
    const { doc, overflow, scale } = buildPdf();
    const company = (els.company.value.trim() || "Resume").replace(/[^A-Za-z0-9_-]+/g, "_");
    const filename = `${state.doc.profile.name.replace(/\s+/g, "_")}_${company}.pdf`;
    const fitNote = overflow ? " Note: it still runs past one page — trim a bullet or two." : "";
    if (!window.claude?.use) { toast("This page isn't inside the claude.ai viewer, so it can't save files. Open it from claude.ai.", "error"); return; }
    if (state.downloads === undefined) state.downloads = await claude.use("downloads");
    const perms = await claude.use("permissions");
    let pstate = "unknown";
    if (perms) { pstate = await perms.state("downloads"); if (pstate === "prompt") { toast("claude.ai is asking for permission to save files — choose Allow.", "busy"); pstate = (await perms.request(["downloads"])).downloads; } }
    if (pstate === "denied") { toast("You declined file saving for this page load. Reload the page and choose Allow when asked.", "error"); return; }
    if (!state.downloads || pstate === "unavailable") { toast(`Saving isn't available in this view (downloads: ${pstate}). Open the page from claude.ai in a desktop browser.`, "error"); return; }
    toast("Preparing the PDF — confirm the save when claude.ai asks…", "busy");
    const res = await state.downloads.save({ filename, data: doc.output("blob") });
    toast(res?.status === "delivered" ? `Delivered ${filename}.` : `Saved ${filename}.${fitNote}`, "ok");
  } catch (e) {
    const code = e?.code || (e?.message ? `error: ${e.message}` : "unknown");
    const copy = { declined: "Download cancelled — click Download PDF again and choose Save when claude.ai asks.", rate_limited: "A save prompt is already open — finish that one first.", too_large: "The PDF was rejected as too large — remove a bullet and try again.", not_granted: "File saving hasn't been allowed for this page — reload and choose Allow when asked.", unavailable: "Saving isn't available in this view — open the page from claude.ai in a desktop browser." }[code];
    toast(copy || `Couldn't save the PDF (${code}). Tell Claude this code and it can fix it.`, "error");
  } finally { els.download.disabled = false; }
});

let toastTimer = null;
function toast(msg, kind = "") {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = `toast ${kind}`.trim(); t.hidden = false;
  clearTimeout(toastTimer);
  if (kind !== "busy") toastTimer = setTimeout(() => { t.hidden = true; }, kind === "error" ? 12000 : 8000);
  setStatus(msg, kind === "error" ? "error" : "");
}

els.company.addEventListener("input", persist);
els.jd.addEventListener("input", () => { if (state.reqs && state.reqs.key !== cacheKey(els.jd.value)) { state.reqs = null; state.result = null; renderScore(); } persist(); });
els.jd.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") els.tailor.click(); });

// ── Base résumé settings ─────────────────────────────────────────────────

els.openSettings.addEventListener("click", () => { els.baseResume.value = JSON.stringify(state.base, null, 2); els.settingsStatus.textContent = ""; els.settings.showModal(); });
els.cancel.addEventListener("click", () => els.settings.close());
els.reset.addEventListener("click", () => { els.baseResume.value = JSON.stringify(DEFAULT_RESUME, null, 2); });
els.save.addEventListener("click", () => {
  let base;
  try { base = JSON.parse(els.baseResume.value); for (const k of ["profile", "education", "experience", "projects", "skills"]) if (!(k in base)) throw new Error(`Missing "${k}"`); }
  catch (e) { els.settingsStatus.textContent = `Résumé JSON is invalid: ${e.message}`; els.settingsStatus.className = "status error"; return; }
  const customized = JSON.stringify(base) !== JSON.stringify(DEFAULT_RESUME);
  state.base = base; store.set("baseResume", base); store.set("baseCustomized", customized);
  els.settings.close();
  setStatus(customized ? "Base résumé saved. It will keep your version over future updates." : "Base résumé reset to the built-in default.");
});

// ── Capabilities light up when the viewer runtime answers ────────────────

load();
(async () => {
  if (!window.claude?.use) { state.sample = null; state.downloads = null; hideClaudeButtons(); setStatus("Open this page inside claude.ai to use Claude. Editing and the PDF preview work here."); return; }
  const [sample, downloads] = await Promise.all([claude.use("sample"), claude.use("downloads")]);
  state.sample = sample; state.downloads = downloads;
  const off = [];
  if (!sample) { hideClaudeButtons(); off.push("Claude tailoring"); }
  if (!downloads) off.push("file saving");
  if (off.length) setStatus(`${off.join(" and ")} ${off.length > 1 ? "aren't" : "isn't"} available in this view — usually because the page was opened outside the claude.ai viewer. Editing works.`);
  else if (!els.status.textContent) setStatus("Paste a job description and click Tailor with Claude.");
})();
