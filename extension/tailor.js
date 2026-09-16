const MODEL = "claude-opus-5";

const SYSTEM_PROMPT = `You are a professional resume writer. Given a job description and a candidate's base resume bullets, you will:
1. Select the 3 most relevant bullets per experience (or rewrite them to better match the role — keep facts true, sharpen the language).
2. Adjust the Skills section to lead with keywords from the job description.
3. Return ONLY valid JSON in the exact schema provided. No extra text.`;

const $ = (id) => document.getElementById(id);
const els = {
  company: $("company"), jd: $("jd"), jdSource: $("jd-source"),
  tailor: $("tailor"), useBase: $("use-base"), status: $("status"),
  paper: $("paper"), download: $("download"),
  settings: $("settings"), openSettings: $("open-settings"),
  apiKey: $("api-key"), baseResume: $("base-resume"),
  save: $("save-settings"), cancel: $("cancel-settings"),
  reset: $("reset-resume"), settingsStatus: $("settings-status"),
};

let state = { base: DEFAULT_RESUME, apiKey: "", tailored: null };

// ── Storage ──────────────────────────────────────────────────────────────

async function load() {
  const s = await chrome.storage.local.get(["apiKey", "baseResume", "pendingJob", "lastResult"]);
  state.apiKey = s.apiKey || "";
  state.base = s.baseResume || DEFAULT_RESUME;

  if (s.pendingJob) {
    els.jd.value = s.pendingJob.text || "";
    els.company.value = guessCompany(s.pendingJob.title, s.pendingJob.url);
    if (s.pendingJob.url) els.jdSource.textContent = `Grabbed from ${new URL(s.pendingJob.url).hostname}`;
    await chrome.storage.local.remove("pendingJob");
  } else if (s.lastResult) {
    els.company.value = s.lastResult.company || "";
    els.jd.value = s.lastResult.jd || "";
    state.tailored = s.lastResult.tailored;
    renderPreview();
  }

  if (!state.apiKey) setStatus("Add your API key in Settings to enable tailoring.");
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

// ── Preview ──────────────────────────────────────────────────────────────

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderPreview() {
  const t = state.tailored;
  const { profile, education } = state.base;
  if (!t) return;

  const exp = t.experience.map((e, i) => `
    <div class="r-row"><span class="l">${esc(e.org)}</span><span class="r">${esc(e.dates)}</span></div>
    <div class="r-row sub"><span class="l">${esc(e.role)}</span><span class="r">${esc(e.location)}</span></div>
    <ul>${e.bullets.map((b, j) => `<li contenteditable="true" data-kind="exp" data-i="${i}" data-j="${j}">${esc(b)}</li>`).join("")}</ul>`).join("");

  const proj = t.projects.map((p, i) => `
    <div class="r-row"><span><span class="l">${esc(p.name)}</span><span class="tech" contenteditable="true" data-kind="tech" data-i="${i}">| ${esc(p.tech)}</span></span><span class="r">${esc(p.dates)}</span></div>
    <ul>${p.bullets.map((b, j) => `<li contenteditable="true" data-kind="proj" data-i="${i}" data-j="${j}">${esc(b)}</li>`).join("")}</ul>`).join("");

  const skills = Object.entries(t.skills).map(([cat, vals]) =>
    `<div class="r-line"><b>${esc(cat)}:</b> <span contenteditable="true" data-kind="skill" data-cat="${esc(cat)}">${esc(vals)}</span></div>`).join("");

  els.paper.innerHTML = `
    <div class="r-name">${esc(profile.name)}</div>
    <div class="r-contact">${esc(profile.phone)} &nbsp;|&nbsp; ${esc(profile.email)} &nbsp;|&nbsp; ${esc(profile.linkedin)}</div>
    <div class="r-sec">Education</div>
    <div class="r-row"><span class="l">${esc(education.school)}</span><span class="r">${esc(education.grad)}</span></div>
    <div class="r-line italic">${esc(education.degree)}</div>
    <div class="r-line"><b>Relevant Coursework:</b> ${esc(education.coursework)}</div>
    <div class="r-sec">Experience</div>${exp}
    <div class="r-sec">Projects</div>${proj}
    <div class="r-sec">Technical Skills</div>${skills}`;

  els.download.disabled = false;
}

// Pull any edits the user made in the preview back into state.tailored
function collectEdits() {
  const t = state.tailored;
  els.paper.querySelectorAll("[contenteditable]").forEach((el) => {
    const v = el.textContent.trim();
    const { kind, i, j, cat } = el.dataset;
    if (kind === "exp") t.experience[i].bullets[j] = v;
    else if (kind === "proj") t.projects[i].bullets[j] = v;
    else if (kind === "tech") t.projects[i].tech = v.replace(/^\|\s*/, "");
    else if (kind === "skill") t.skills[cat] = v;
  });
  for (const e of t.experience) e.bullets = e.bullets.filter(Boolean);
  for (const p of t.projects) p.bullets = p.bullets.filter(Boolean);
}

// ── Actions ──────────────────────────────────────────────────────────────

function setStatus(msg, kind = "") {
  els.status.textContent = msg;
  els.status.className = `status ${kind}`.trim();
}

async function persistResult() {
  await chrome.storage.local.set({
    lastResult: { company: els.company.value.trim(), jd: els.jd.value, tailored: state.tailored },
  });
}

els.tailor.addEventListener("click", async () => {
  const jd = els.jd.value.trim();
  if (!state.apiKey) { setStatus("Add your API key in Settings first.", "error"); els.settings.showModal(); return; }
  if (jd.length < 80) { setStatus("Paste the full job description first.", "error"); return; }

  els.tailor.disabled = true;
  setStatus("Tailoring with Claude — about 15 seconds…", "busy");
  try {
    state.tailored = await callClaude(jd);
    renderPreview();
    await persistResult();
    setStatus("Done. Edit any bullet, then download.");
  } catch (e) {
    setStatus(e.message, "error");
  } finally {
    els.tailor.disabled = false;
  }
});

els.useBase.addEventListener("click", async () => {
  const b = state.base;
  state.tailored = {
    experience: b.experience.map((e) => ({ ...e, bullets: e.bullets.slice(0, 3) })),
    projects: b.projects.map((p) => ({ ...p, bullets: p.bullets.slice(0, 2) })),
    skills: { ...b.skills },
  };
  renderPreview();
  await persistResult();
  setStatus("Showing base resume (no AI). Edit and download, or tailor with Claude.");
});

els.download.addEventListener("click", async () => {
  collectEdits();
  await persistResult();
  const data = { profile: state.base.profile, education: state.base.education, ...state.tailored };
  const { doc, overflow, scale } = renderResumePDF(data);
  const company = (els.company.value.trim() || "Resume").replace(/[^A-Za-z0-9_-]+/g, "_");
  const name = state.base.profile.name.replace(/\s+/g, "_");
  doc.save(`${name}_${company}.pdf`);
  setStatus(overflow
    ? "Downloaded, but it still runs past one page — trim a bullet or two."
    : `Downloaded (one page${scale < 1 ? `, type scaled to ${Math.round(scale * 100)}%` : ""}).`);
});

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
