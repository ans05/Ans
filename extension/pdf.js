// Renders the résumé with an embedded Liberation Serif face (metric-compatible
// with Times New Roman) so glyph widths, Unicode punctuation, and kerning
// match the in-app preview. Shrinks the type in small steps until everything
// fits on one US Letter page. Text is real (selectable/searchable) and the
// email and LinkedIn entries are clickable links.

const PDF_FONT = "LiberationSerif";

// jsPDF's virtual file system is per document, so fonts are added on every render.
function registerFonts(doc) {
  if (typeof RESUME_FONTS === "undefined") { return "times"; }
  const map = { normal: "Regular", bold: "Bold", italic: "Italic", bolditalic: "BoldItalic" };
  for (const [style, suffix] of Object.entries(map)) {
    const file = `${PDF_FONT}-${suffix}.ttf`;
    doc.addFileToVFS(file, RESUME_FONTS[style]);
    doc.addFont(file, PDF_FONT, style);
  }
  return PDF_FONT;
}

function renderResumePDF(data) {
  let result = null;
  for (const scale of [1.0, 0.97, 0.94, 0.91, 0.88, 0.85, 0.82]) {
    result = drawResume(data, scale);
    if (!result.overflow) break;
  }
  return result;
}

function drawResume(data, scale) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter", putOnlyUsedFonts: true, compress: true });
  const family = registerFonts(doc);
  doc.setLineHeightFactor(1.24);

  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const LM = 42, RM = 42, TM = 34, BM = 30;
  const W = PW - LM - RM;
  const f = (pt) => pt * scale;
  const LH = (pt) => pt * scale * 1.24;
  let y = TM;

  const font = (style, size) => { doc.setFont(family, style); doc.setFontSize(f(size)); };
  const width = (s) => doc.getTextWidth(s);
  const textRight = (yy, s, size, style = "normal") => { font(style, size); doc.text(s, PW - RM - width(s), yy); };
  const row = (left, right, ls, rs, lstyle = "bold", rstyle = "normal") => {
    y += f(ls);
    font(lstyle, ls);
    // Keep the left text clear of the right-aligned date.
    font(rstyle, rs); const rw = width(right);
    font(lstyle, ls);
    const maxLeft = W - rw - f(12);
    const leftLines = doc.splitTextToSize(left, maxLeft);
    doc.text(leftLines[0], LM, y);
    textRight(y, right, rs, rstyle);
    for (let i = 1; i < leftLines.length; i++) { y += LH(ls); font(lstyle, ls); doc.text(leftLines[i], LM, y); }
    y += f(1.5);
  };
  const section = (title) => {
    y += f(4) + f(10.5);
    font("bold", 10.5);
    doc.text(title.toUpperCase(), LM, y);
    doc.setLineWidth(0.7);
    doc.line(LM, y + f(2.5), PW - RM, y + f(2.5));
    y += f(5);
  };
  const bullets = (items) => {
    const size = 9.6, indent = f(11);
    font("normal", size);
    y += f(2.5);
    for (const b of items) {
      const lines = doc.splitTextToSize(String(b), W - indent);
      const base = y + f(size) * 0.82;
      doc.text("•", LM + f(3), base);
      lines.forEach((line, i) => doc.text(line, LM + indent, base + i * LH(size)));
      y += lines.length * LH(size);
    }
    y += f(3.5);
  };
  // Paragraph with an optional bold "Label:" prefix; the first line wraps around the label.
  const para = (txt, size, style = "normal", boldPrefix = null) => {
    y += f(1.5);
    const base = y + f(size) * 0.82;
    let firstX = LM, firstW = W;
    if (boldPrefix) {
      font("bold", size);
      doc.text(boldPrefix, LM, base);
      const pw = width(boldPrefix + " ");
      firstX = LM + pw; firstW = W - pw;
    }
    font(style, size);
    const words = String(txt).split(/\s+/);
    const lines = []; let cur = "", limit = firstW;
    for (const w of words) {
      const trial = cur ? cur + " " + w : w;
      if (width(trial) <= limit) cur = trial; else { lines.push(cur); cur = w; limit = W; }
    }
    if (cur) lines.push(cur);
    lines.forEach((line, i) => doc.text(line, i === 0 ? firstX : LM, base + i * LH(size)));
    y += lines.length * LH(size);
  };

  // Name — one text run (no per-glyph placement), centered.
  font("bold", 21);
  y = TM + f(21);
  const name = data.profile.name;
  doc.text(name, (PW - width(name)) / 2, y);
  y += f(3);

  // Contact line with real links.
  const p = data.profile;
  font("normal", 9.5);
  y += f(9.5);
  const sep = "   |   ";
  const parts = [{ t: p.phone }, { t: p.email, url: `mailto:${p.email}` }, { t: p.linkedin, url: /^https?:/.test(p.linkedin) ? p.linkedin : `https://${p.linkedin}` }];
  const total = parts.reduce((a, x) => a + width(x.t), 0) + width(sep) * (parts.length - 1);
  let x = (PW - total) / 2;
  parts.forEach((x0, i) => {
    if (x0.url) doc.textWithLink(x0.t, x, y, { url: x0.url }); else doc.text(x0.t, x, y);
    x += width(x0.t);
    if (i < parts.length - 1) { doc.text(sep, x, y); x += width(sep); }
  });
  y += f(1);

  const drawExperience = () => {
    if (!data.experience?.length) return;
    section("Experience");
    for (const e of data.experience) {
      row(e.org, e.dates, 10, 9.2);
      row(e.role, e.location, 9.5, 9.2, "italic", "italic");
      bullets(e.bullets);
    }
  };
  const drawProjects = () => {
    if (!data.projects?.length) return;
    section("Projects");
    for (const pr of data.projects) {
      y += f(10);
      font("bold", 10);
      const nameW = width(pr.name);
      doc.text(pr.name, LM, y);
      font("italic", 9.5);
      font("normal", 9.2); const dw = width(pr.dates);
      font("italic", 9.5);
      const techMax = W - nameW - dw - f(16);
      const tech = doc.splitTextToSize(`| ${pr.tech}`, techMax)[0];
      doc.text(tech, LM + nameW + f(4), y);
      textRight(y, pr.dates, 9.2);
      y += f(1.5);
      bullets(pr.bullets);
    }
  };

  section("Education");
  row(data.education.school, data.education.grad, 10, 9.2);
  para(data.education.degree, 9.5, "italic");
  para(data.education.coursework, 9.6, "normal", "Relevant Coursework:");

  const order = Array.isArray(data.sectionOrder) && data.sectionOrder.length ? data.sectionOrder : ["experience", "projects"];
  for (const s of order) { if (s === "projects") drawProjects(); else if (s === "experience") drawExperience(); }

  section("Skills");
  const skills = Array.isArray(data.skills) ? data.skills.map((s) => [s.cat, s.vals]) : Object.entries(data.skills || {});
  for (const [cat, vals] of skills) para(vals, 9.6, "normal", `${cat}:`);

  return { doc, overflow: y > PH - BM, scale, pages: doc.getNumberOfPages() };
}

if (typeof module !== "undefined") module.exports = { renderResumePDF, drawResume };
