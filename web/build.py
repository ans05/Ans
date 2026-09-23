import pathlib
E = pathlib.Path("/home/user/Ans/extension")
S = pathlib.Path(__file__).parent
css = (E / "tailor.css").read_text()

css = css.replace("""  --radius: 10px;
}
""", """  --radius: 10px;
  --paper-bg: #ffffff;
  --good: #1f7a3a;
  --mid: #b7791f;
  --low: #b3261e;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #161715; --panel: #1f201d; --ink: #ecebe6; --muted: #a2a29c; --line: #34352f;
    --accent: #6fb8b1; --accent-ink: #0f1f1e; --accent-soft: #1f302e; --danger: #f28b82; --ok: #7ed49a;
    --good: #7ed49a; --mid: #e3b25b; --low: #f28b82;
  }
}
:root[data-theme="dark"] {
  --bg: #161715; --panel: #1f201d; --ink: #ecebe6; --muted: #a2a29c; --line: #34352f;
  --accent: #6fb8b1; --accent-ink: #0f1f1e; --accent-soft: #1f302e; --danger: #f28b82; --ok: #7ed49a;
  --good: #7ed49a; --mid: #e3b25b; --low: #f28b82;
}
""", 1)
css = css.replace("padding: 9px 11px; font: inherit; color: var(--ink); background: #fbfbf9;",
                  "padding: 9px 11px; font: inherit; color: var(--ink); background: var(--bg);")
css = css.replace(".btn:hover { background: #f1f1ee; }", ".btn:hover { background: var(--accent-soft); }")
css = css.replace(".btn.primary:hover { background: #17504c; }", ".btn.primary:hover { filter: brightness(0.92); }")
css = css.replace(".fit.ok { background: #e4f3e8; color: var(--ok); }", ".fit.ok { background: var(--accent-soft); color: var(--ok); }")
css = css.replace(".fit.warn { background: #fbe9e7; color: var(--danger); }", ".fit.warn { background: var(--accent-soft); color: var(--danger); }")
css = css.replace(".paper [contenteditable]:focus { outline: 2px solid var(--accent); outline-offset: 0; background: #fff; }",
                  ".paper [contenteditable]:focus { outline: 2px solid var(--accent); outline-offset: 0; background: var(--paper-bg); }")
css = css.replace("dialog {\n  border: 1px solid var(--line);", "dialog {\n  background: var(--panel); color: var(--ink);\n  border: 1px solid var(--line);")

css += """
body { padding-inline: 0; }
.layout { padding: 16px; grid-template-columns: 380px minmax(0, 1fr) minmax(0, 1fr); }
@media (max-width: 1100px) { .layout { padding: 16px; } .pdf { min-height: 700px; } }
.input-panel { overflow: hidden; }
.tabs { display: flex; gap: 2px; background: var(--bg); border-radius: 8px; padding: 3px; }
.tab {
  border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 12px; font-weight: 600;
  letter-spacing: 0.04em; text-transform: uppercase; padding: 5px 12px; border-radius: 6px; cursor: pointer;
}
.tab.active { background: var(--panel); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
.tabpane { display: flex; flex-direction: column; gap: 12px; flex: 1; min-height: 0; overflow: auto; }
.tabpane[hidden] { display: none; }
.tabpane .hint.lead { line-height: 1.4; }
a.btn { text-decoration: none; display: inline-block; }

.score-card { display: flex; align-items: baseline; gap: 14px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 8px; }
.score-big { font-size: 40px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.score-of { font-size: 14px; color: var(--muted); font-weight: 600; margin-left: 2px; }
.score-big.good { color: var(--good); } .score-big.mid { color: var(--mid); } .score-big.low { color: var(--low); }
.score-verdict { font-size: 13px; line-height: 1.4; }
.bar-row { display: flex; flex-direction: column; gap: 3px; }
.bar-head { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; }
.bar-num { font-variant-numeric: tabular-nums; color: var(--muted); }
.bar { height: 6px; background: var(--bg); border-radius: 3px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 3px; }
.bar-fill.good { background: var(--good); } .bar-fill.mid { background: var(--mid); } .bar-fill.low { background: var(--low); }
.bar-note { font-size: 12px; color: var(--muted); line-height: 1.35; }
.sub-label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-top: 4px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 12px; padding: 3px 9px; border-radius: 999px; background: var(--accent-soft); color: var(--ink); }
ul.plain { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.4; }
ul.plain li { margin: 3px 0; }
ol.sugg { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.4; }
ol.sugg li { margin: 6px 0; }
ol.sugg b { font-weight: 600; }
.stale { font-size: 12px; padding: 8px 10px; border-radius: 6px; background: var(--accent-soft); color: var(--ink); }

.target { border: 1px solid var(--line); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
.target-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.target-role { font-weight: 600; font-size: 14px; }
.target-why { font-size: 13px; color: var(--muted); line-height: 1.4; }
.msg { position: relative; font-size: 13px; line-height: 1.45; padding: 10px 12px; padding-right: 64px; background: var(--bg); border-radius: 6px; white-space: pre-wrap; }
.msg .copy { position: absolute; top: 6px; right: 6px; }
ol.order li { margin: 1px 0; }
.toast { flex: 1; min-width: 0; font-size: 13px; padding: 6px 12px; border-radius: 8px; background: var(--accent-soft); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.toast.ok { color: var(--good); }
.toast.error { color: var(--danger); white-space: normal; }
.toast.busy::before { content: ""; display: inline-block; width: 10px; height: 10px; margin-right: 8px; border: 2px solid var(--accent); border-right-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; vertical-align: -1px; }
.toast[hidden] { display: none; }
.formula { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 12.5px; font-variant-numeric: tabular-nums; }
.formula-row { display: grid; grid-template-columns: 1fr auto 44px; gap: 10px; }
.formula-row span:nth-child(2) { color: var(--muted); }
.formula-row b { text-align: right; }
.formula-row.total { border-top: 1px solid var(--line); padding-top: 4px; margin-top: 2px; font-weight: 700; }
ul.checks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
ul.checks li { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; line-height: 1.35; }
ul.checks .mark { flex: 0 0 18px; font-weight: 700; text-align: center; }
ul.checks li.ok .mark { color: var(--good); }
ul.checks li.miss .mark { color: var(--low); }
ul.checks li.part .mark { color: var(--mid); }
ul.checks li.na .mark { color: var(--muted); }
.formula-row .ev { display: block; font-weight: 400; color: var(--muted); font-size: 11.5px; }
.counter.over { color: var(--danger); font-weight: 700; }
select { width: 100%; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font: inherit; color: var(--ink); background: var(--bg); }
.verdict { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: var(--accent-soft); }
.verdict.ok { color: var(--good); } .verdict.mid { color: var(--mid); } .verdict.bad { color: var(--low); }
.checks-panel { font-size: 12.5px; }
.checks-panel summary { cursor: pointer; color: var(--muted); }
.checks-panel .bad { color: var(--danger); }
ul.checklist { margin: 6px 0 0; padding-left: 18px; }
ul.checklist li.block { color: var(--danger); }
ul.checklist li.warn { color: var(--muted); }
.score-card { flex-wrap: wrap; gap: 18px; }
.score-sub { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
label.inline { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
.target .field { margin: 2px 0; }
.target input[type="text"] { padding: 5px 8px; font-size: 13px; }
.settings-form #import-text { min-height: 90px; }
.settings-form .actions #import-status { flex: 1; min-width: 0; }
.settings-form code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.92em; background: var(--bg); padding: 1px 4px; border-radius: 4px; }
ul.checks .req { display: flex; flex-direction: column; gap: 1px; }
ul.checks .ev { font-size: 12px; color: var(--muted); }
.entry { position: relative; }
.mover { position: absolute; left: -30px; top: 1px; display: none; flex-direction: column; gap: 0; }
.entry:hover .mover, .entry:focus-within .mover { display: flex; }
.mv { border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 11px; line-height: 1; cursor: pointer; padding: 1px 4px; }
.mv:hover:not(:disabled) { color: var(--accent); }
.mv:disabled { opacity: 0.25; cursor: default; }
.paper { padding-left: 44px; }
"""

data = (E / "resume-data.js").read_text()
pdf = (E / "pdf.js").read_text()
app = (S / "app.js").read_text()
jspdf = (E / "lib" / "jspdf.umd.min.js").read_text()
scoring = (S / "scoring.js").read_text()
fonts = (S / "fonts.js").read_text()

html = f"""<title>Resume Tailor</title>
<style>
{css}
</style>

<header class="topbar">
  <div class="brand"><span class="brand-mark">RT</span><span class="brand-name">Resume Tailor</span></div>
  <div id="toast" class="toast" hidden></div>
  <div class="topbar-right">
    <span id="verdict" class="verdict" title=""></span>
    <span id="fit" class="fit"></span>
    <button id="stop" class="btn ghost" type="button" hidden>Stop</button>
    <button id="revert" class="btn ghost" type="button" hidden>Revert to Claude's version</button>
    <button id="download" class="btn primary" type="button">Download PDF</button>
    <button id="open-settings" class="btn ghost" type="button">Base resume</button>
  </div>
</header>

<main class="layout" id="layout">
  <section class="panel input-panel" id="input-panel">
    <div class="panel-head">
      <div class="tabs">
        <button class="tab active" type="button" data-tab="job">Job</button>
        <button class="tab" type="button" data-tab="score">Score</button>
        <button class="tab" type="button" data-tab="outreach">Outreach</button>
      </div>
      <button id="collapse-job" class="btn tiny ghost" type="button" title="Hide this panel">Hide</button>
    </div>

    <div class="tabpane" id="tab-job">
      <label class="field">
        <span class="label">Company</span>
        <input id="company" type="text" placeholder="Duolingo" autocomplete="off">
      </label>
      <label class="field grow">
        <span class="label">Job description</span>
        <textarea id="jd" placeholder="Paste the full job posting here."></textarea>
      </label>
      <div class="field">
        <span class="label">Role track <span class="hint">detected: <span id="track-detected">—</span></span></span>
        <select id="track-select">
          <option value="">Use detected track</option>
          <option value="ds_ml">Data Science / ML</option>
          <option value="product_analytics">Product Analytics / BI</option>
          <option value="product_management">Product Management</option>
          <option value="ai_product">AI Product / Technical PM</option>
          <option value="product_strategy">Product Strategy / Growth</option>
        </select>
        <label class="inline hint"><input type="checkbox" id="relevance-order" checked> Order experience by relevance to the track (off = reverse-chronological)</label>
      </div>
      <div class="actions">
        <button id="tailor" class="btn primary" type="button">Tailor with Claude</button>
        <button id="use-base" class="btn ghost" type="button">Start from base</button>
      </div>
      <p id="status" class="status" aria-live="polite"></p>
    </div>

    <div class="tabpane" id="tab-score" hidden>
      <p class="hint lead"><b>Recruiter readiness</b> = 40% required qualifications (responsibilities at half weight) + 20% preferred + 20% evidence strength &amp; specificity + 10% role relevance &amp; ordering + 10% clarity, concision and no duplication. <b>ATS coverage</b> = matched + ½ partial over scorable items. Matched 1 · partial 0.5 · missing 0; company language, eligibility and traits are shown but never scored. Weak equivalences, duplicates, copied phrasing and unsupported claims are penalised. Internal estimates, not an employer's decision.</p>
      <div class="actions">
        <button id="rate" class="btn primary" type="button">Rate match</button>
        <button id="improve" class="btn ghost" type="button" hidden>Add verified facts from bank</button>
      </div>
      <p id="score-status" class="status" aria-live="polite"></p>
      <div id="score-out"></div>
    </div>

    <div class="tabpane" id="tab-outreach" hidden>
      <p class="hint lead">Who to contact about this role, by job title, with a note written for each. It never guesses real names — use the LinkedIn search to find the actual person, then paste the note.</p>
      <div class="actions">
        <button id="outreach" class="btn primary" type="button">Find people to contact</button>
      </div>
      <p id="outreach-status" class="status" aria-live="polite"></p>
      <div id="outreach-out"></div>
    </div>
  </section>

  <button id="expand-job" class="rail" type="button" hidden title="Show panel">Job</button>

  <section class="panel editor-panel">
    <div class="panel-head">
      <span class="label">Edit <span class="hint">— click any text to change it · Enter adds a bullet · Backspace on an empty bullet removes it</span></span>
      <span class="hint"><label class="inline"><input type="checkbox" id="projects-first"> Projects first</label> <span id="saved"></span></span>
    </div>
    <div id="checks" class="checks-panel"><span class="hint">Checks run before every export.</span></div>
    <div id="paper" class="paper"></div>
  </section>

  <section class="panel pdf-panel">
    <div class="panel-head"><span class="label">PDF <span class="hint">— exactly what you'll submit</span></span></div>
    <iframe id="pdf" class="pdf" title="PDF preview"></iframe>
  </section>
</main>

<dialog id="settings">
  <form method="dialog" class="settings-form">
    <h2>Whose résumé is this?</h2>
    <p class="hint lead">Everything — tailoring, scoring, skills — is generated only from the verified facts below. Nothing outside this bank is ever added to a résumé, so replace it to use this tool for someone else.</p>

    <label class="field">
      <span class="label">Import a résumé <span class="hint">— paste résumé text, Claude structures it into verified facts below for you to review</span></span>
      <textarea id="import-text" rows="6" placeholder="Paste a résumé (yours, or a friend's, with their permission) — plain text is fine."></textarea>
      <div class="actions">
        <button id="import-build" class="btn primary" type="button">Build evidence bank from this text</button>
        <span id="import-status" class="status"></span>
      </div>
    </label>

    <label class="field grow">
      <span class="label">Evidence bank (JSON) <span class="hint">— the source of truth; edit directly if you prefer</span></span>
      <textarea id="base-resume" spellcheck="false"></textarea>
      <span class="hint">Every fact needs <code>text</code>, and may list <code>metrics</code>/<code>tools</code> it's allowed to mention and <code>tags</code> naming the capabilities it evidences (see the built-in example). Add more true facts than fit on a page — the model picks the strongest per role. Saved in this browser only.</span>
    </label>
    <div class="actions">
      <button id="reset-resume" class="btn ghost" type="button">Reset to built-in example (Aneesh's résumé)</button>
      <span class="spacer"></span>
      <button class="btn ghost" type="button" id="cancel-settings">Cancel</button>
      <button class="btn primary" type="button" id="save-settings">Save</button>
    </div>
    <p id="settings-status" class="status"></p>
  </form>
</dialog>

<script>
{jspdf}
</script>
<script>
{fonts}
</script>
<script>
{scoring}
</script>
<script>
{data}
{pdf}
{app}
</script>
"""
(S / "index.html").write_text(html)
print(len(html), "bytes")
