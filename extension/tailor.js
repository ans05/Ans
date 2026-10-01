const MODEL = "claude-opus-5";

const SYSTEM_PROMPT = `You are a professional resume writer. Given a job description and a candidate's base resume bullets, you will:
1. Select the 3 most relevant bullets per experience (or rewrite them to better match the role — keep facts true, sharpen the language).
2. Adjust the Skills section to lead with keywords from the job description.
3. Return ONLY valid JSON in the exact schema provided. No extra text.`;

const $ = (id) => document.getElementById(id);
const els = {
  layout: $("layout"), inputPanel: $("input-panel"), collapseJob: $("collapse-job"), expandJob: $("expand-job"),
  company: $("company"), jd: $("jd"), jdSource: $("jd-source"),
  tailor: $("tailor"), useBase: $("use-base"), status: $("status"), saved: $("saved"),
  paper: $("paper"), pdf: $("pdf"), fit: $("fit"), download: $("download"), revert: $("revert"),
  settings: $("settings"), openSettings: $("open-settings"),
  apiKey: $("api-key"), baseResume: $("base-resume"),
  save: $("save-settings"), cancel: $("cancel-settings"),
  reset: $("reset-resume"), settingsStatus: $("settings-status"),
};

// state.doc is the full editable resume: profile, education, experience, projects, skills.
// skills is an ordered array of {cat, vals} so category names can be edited too.
let state = { base: DEFAULT_RESUME, apiKey: "", doc: null, claudeVersion: null, pdfUrl: null };

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

// ── Storage ──────────────────────────────────────────────────────────────

async function load() {
  const s = await chrome.storage.local.get(["apiKey", "baseResume", "pendingJob", "lastResult", "jobHidden"]);
  state.apiKey = s.apiKey || "";
  state.base = s.baseResume || DEFAULT_RESUME;
  if (s.jobHidden) setJobHidden(true);

  if (s.pendingJob) {
    els.jd.value = s.pendingJob.text || "";
    els.company.value = guessCompany(s.pendingJob.title, s.pendingJob.url);
    if (s.pendingJob.url) els.jdSource.textContent = `Grabbed from ${new URL(s.pendingJob.url).hostname}`;
    await chrome.storage.local.remove("pendingJob");
    setJobHidden(false);
  } else if (s.lastResult) {
    els.company.value = s.lastResult.company || "";
    els.jd.value = s.lastResult.jd || "";
    state.doc = s.lastResult.doc || null;
    state.claudeVersion = s.lastResult.claudeVersion || null;
    if (state.doc) { renderEditor(); refreshPdf(); }
  }

  if (!state.apiKey) setStatus("Add your API key in Settings to enable tailoring.");
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await chrome.storage.local.set({
      lastResult: { company: els.company.value.trim(), jd: els.jd.value, doc: state.doc, claudeVersion: state.claudeVersion },
    });
    els.saved.textContent = "Saved";
    setTimeout(() => { if (els.saved.textContent === "Saved") els.saved.textContent = ""; }, 1500);
  }, 300);
}

function guessCompany(title = "", url = "") {
  const parts = title.split(/\s+[-–|·]\s+|\s+at\s+|\s+@\s+/i).map((s) => s.trim()).filter(Boolean);
  for (const p of parts.slice().reverse()) {
    if (!/careers?|jobs?|hiring|greenhouse|lever|workday|linkedin/i.test(p) && p.length < 40) return p;
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const m = host.match(/(?:careers\.|jobs\.|boards\.greenhouse\.io\/)?([a-z0-9-]+)\./i);
    if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1);
  } catch (_) {}
  return "";
}

// ── Claude ───────────────────────────────────────────────────────────────

function userPrompt(jd) {
  return `Job Description:
${jd}

Return JSON with this exact schema:
{
  "experience": [{"org": "...", "role": "...", "location": "...", "dates": "...", "bullets": ["b1", "b2", "b3"]}],
  "projects": [{"name": "...", "tech": "...", "dates": "...", "bullets": ["b1", "b2"]}],
  "skills": {"Data & Analytics": "...", "Languages & Tools": "...", "Interests": "..."}
}

Rules:
- Keep all org/role/location/dates exactly as given in the base resume.
- 3 bullets per experience, 2 per project. Rewrite to match job keywords but keep every metric and fact true. Never add tools or experience not in the base resume.
- Lead the skills lines with the tools and methods most relevant to this job. You may rename the first skills category to fit the role (e.g. "Product & Analytics").
- Return only JSON, no markdown fences.`;
}

async function callClaude(jd) {
  const base = { experience: state.base.experience, projects: state.base.projects, skills: state.base.skills };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": state.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      // Base resume is identical across jobs, so it sits in the cached prefix.
      system: [{
        type: "text",
        text: `${SYSTEM_PROMPT}\n\nCandidate's base resume (JSON):\n${JSON.stringify(base, null, 2)}`,
        cache_control: { type: "ephemeral" },
      }],
      messages: [{ role: "user", content: userPrompt(jd) }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }
  const msg = await res.json();
  if (msg.stop_reason === "refusal") throw new Error("Claude declined this request.");
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Model returned no JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

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

  const exp = d.experience.map((e, i) => `
    <div class="r-row"><span class="l">${ed(`experience.${i}.org`, e.org)}</span><span class="r">${ed(`experience.${i}.dates`, e.dates)}</span></div>
    <div class="r-row sub"><span class="l">${ed(`experience.${i}.role`, e.role)}</span><span class="r">${ed(`experience.${i}.location`, e.location)}</span></div>
    ${bulletList(`experience.${i}.bullets`, e.bullets)}`).join("");

  const proj = d.projects.map((p, i) => `
    <div class="r-row"><span><span class="l">${ed(`projects.${i}.name`, p.name)}</span><span class="tech">| ${ed(`projects.${i}.tech`, p.tech)}</span></span><span class="r">${ed(`projects.${i}.dates`, p.dates)}</span></div>
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

  els.download.disabled = false;
  els.revert.hidden = !state.claudeVersion;
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
  cur[keys[keys.length - 1]] = value;
}
function getPath(obj, path) {
  return path.split(".").reduce((o, k) => o[k], obj);
}
const cleanText = (s) => s.replace(/\s+/g, " ").trim();

// Live edits: update the model on every keystroke, re-render PDF (debounced)
els.paper.addEventListener("input", (e) => {
  const el = e.target.closest("[data-path]");
  if (!el) return;
  setPath(state.doc, el.dataset.path, cleanText(el.textContent));
  scheduleRefresh();
  persist();
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
    renderEditor();
    focusPath(`${listPath}.${idx + 1}`);
    scheduleRefresh(); persist();
  } else if (e.key === "Backspace" && isBullet && el.textContent === "") {
    e.preventDefault();
    const [listPath, idx] = splitIndex(el.dataset.path);
    const list = getPath(state.doc, listPath);
    if (list.length <= 1) return;
    list.splice(idx, 1);
    renderEditor();
    focusPath(`${listPath}.${Math.max(0, idx - 1)}`, true);
    scheduleRefresh(); persist();
  }
});

els.paper.addEventListener("click", (e) => {
  const rm = e.target.closest("[data-rm]");
  const add = e.target.closest("[data-add]");
  if (rm) {
    const [listPath, idx] = splitIndex(rm.dataset.rm);
    getPath(state.doc, listPath).splice(idx, 1);
    renderEditor(); scheduleRefresh(); persist();
  } else if (add) {
    const list = getPath(state.doc, add.dataset.add);
    list.push("");
    renderEditor();
    focusPath(`${add.dataset.add}.${list.length - 1}`);
    scheduleRefresh(); persist();
  }
});

function splitIndex(path) {
  const i = path.lastIndexOf(".");
  return [path.slice(0, i), Number(path.slice(i + 1))];
}
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
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refreshPdf, 350);
}

function buildPdf() {
  const data = { ...state.doc, skills: skillsToObject(state.doc.skills) };
  return renderResumePDF(data);
}

function refreshPdf() {
  if (!state.doc) return;
  const { doc, overflow, scale } = buildPdf();
  if (state.pdfUrl) URL.revokeObjectURL(state.pdfUrl);
  state.pdfUrl = URL.createObjectURL(doc.output("blob"));
  els.pdf.src = `${state.pdfUrl}#toolbar=0&navpanes=0&view=FitH`;
  if (overflow) {
    els.fit.textContent = "Runs past one page — trim a bullet";
    els.fit.className = "fit warn";
  } else {
    els.fit.textContent = scale < 1 ? `Fits on one page · type at ${Math.round(scale * 100)}%` : "Fits on one page";
    els.fit.className = "fit ok";
  }
}

// ── Actions ──────────────────────────────────────────────────────────────

function setStatus(msg, kind = "") {
  els.status.textContent = msg;
  els.status.className = `status ${kind}`.trim();
}

function setJobHidden(hidden) {
  els.layout.classList.toggle("job-hidden", hidden);
  els.expandJob.hidden = !hidden;
  chrome.storage.local.set({ jobHidden: hidden });
}
els.collapseJob.addEventListener("click", () => setJobHidden(true));
els.expandJob.addEventListener("click", () => setJobHidden(false));

els.tailor.addEventListener("click", async () => {
  const jd = els.jd.value.trim();
  if (!state.apiKey) { setStatus("Add your API key in Settings first.", "error"); els.settings.showModal(); return; }
  if (jd.length < 80) { setStatus("Paste the full job description first.", "error"); return; }

  els.tailor.disabled = true;
  setStatus("Tailoring with Claude — about 15 seconds…", "busy");
  try {
    const tailored = await callClaude(jd);
    state.doc = docFromTailored(tailored);
    state.claudeVersion = clone(state.doc);
    renderEditor(); refreshPdf(); persist();
    setStatus("Done. Edit anything on the right; the PDF updates as you type.");
    setJobHidden(true);
  } catch (e) {
    setStatus(e.message, "error");
  } finally {
    els.tailor.disabled = false;
  }
});

els.useBase.addEventListener("click", () => {
  const b = state.base;
  state.doc = docFromTailored({
    experience: b.experience.map((e) => ({ ...e, bullets: e.bullets.slice(0, 3) })),
    projects: b.projects.map((p) => ({ ...p, bullets: p.bullets.slice(0, 2) })),
    skills: b.skills,
  });
  state.claudeVersion = null;
  renderEditor(); refreshPdf(); persist();
  setStatus("Editing your base resume (no AI). The PDF updates as you type.");
});

els.revert.addEventListener("click", () => {
  if (!state.claudeVersion) return;
  state.doc = clone(state.claudeVersion);
  renderEditor(); refreshPdf(); persist();
  setStatus("Reverted to Claude's version.");
});

els.download.addEventListener("click", () => {
  const { doc, overflow, scale } = buildPdf();
  const company = (els.company.value.trim() || "Resume").replace(/[^A-Za-z0-9_-]+/g, "_");
  const name = state.doc.profile.name.replace(/\s+/g, "_");
  doc.save(`${name}_${company}.pdf`);
  setStatus(overflow
    ? "Downloaded, but it still runs past one page — trim a bullet or two."
    : `Downloaded (one page${scale < 1 ? `, type scaled to ${Math.round(scale * 100)}%` : ""}).`);
});

els.company.addEventListener("input", persist);
els.jd.addEventListener("input", persist);
els.jd.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") els.tailor.click();
});

// ── Settings ─────────────────────────────────────────────────────────────

els.openSettings.addEventListener("click", () => {
  els.apiKey.value = state.apiKey;
  els.baseResume.value = JSON.stringify(state.base, null, 2);
  els.settingsStatus.textContent = "";
  els.settings.showModal();
});
els.cancel.addEventListener("click", () => els.settings.close());
els.reset.addEventListener("click", () => {
  els.baseResume.value = JSON.stringify(DEFAULT_RESUME, null, 2);
});
els.save.addEventListener("click", async () => {
  let base;
  try {
    base = JSON.parse(els.baseResume.value);
    for (const k of ["profile", "education", "experience", "projects", "skills"]) {
      if (!(k in base)) throw new Error(`Missing "${k}"`);
    }
  } catch (e) {
    els.settingsStatus.textContent = `Resume JSON is invalid: ${e.message}`;
    els.settingsStatus.className = "status error";
    return;
  }
  state.apiKey = els.apiKey.value.trim();
  state.base = base;
  await chrome.storage.local.set({ apiKey: state.apiKey, baseResume: base });
  els.settings.close();
  setStatus(state.apiKey ? "Settings saved." : "Saved. Add an API key to enable tailoring.");
});

load();
