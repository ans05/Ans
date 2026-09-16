// Renders the resume with jsPDF's built-in Times face (no font files needed),
// shrinking the type in small steps until everything fits on one page.

function renderResumePDF(data) {
  let result = null;
  for (const scale of [1.0, 0.97, 0.94, 0.91, 0.88, 0.85]) {
    result = drawResume(data, scale);
    if (!result.overflow) break;
  }
  return result;
}

function drawResume(data, scale) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setLineHeightFactor(1.24);

  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const LM = 42, RM = 42, TM = 34, BM = 30;
  const W = PW - LM - RM;
  const f = (pt) => pt * scale;
  const LH = (pt) => pt * scale * 1.24;
  let y = TM;

  const font = (style, size) => {
    doc.setFont("times", style);
    doc.setFontSize(f(size));
  };
  const textRight = (yy, s, size, style = "normal") => {
    font(style, size);
    doc.text(s, PW - RM - doc.getTextWidth(s), yy);
  };
  const row = (left, right, ls, rs, lstyle = "bold", rstyle = "normal") => {
    y += f(ls);
    font(lstyle, ls);
    doc.text(left, LM, y);
    textRight(y, right, rs, rstyle);
    y += f(1.5);
  };
  const section = (title) => {
    y += f(4) + f(10.5);
    font("bold", 10.5);
    doc.text(title, LM, y);
    doc.setLineWidth(0.7);
    doc.line(LM, y + f(2.5), PW - RM, y + f(2.5));
    y += f(5);
  };
  const bullets = (items) => {
    const size = 9.6;
    const indent = f(11);
    font("normal", size);
    y += f(2.5);
    for (const b of items) {
      const lines = doc.splitTextToSize(b, W - indent);
      const base = y + f(size) * 0.82;
      doc.text("•", LM + f(3), base);
      doc.text(lines, LM + indent, base);
      y += lines.length * LH(size);
    }
    y += f(3.5);
  };
  // Paragraph with an optional bold "Label:" prefix; the first line wraps
  // around the label, later lines use the full width.
  const para = (txt, size, style = "normal", boldPrefix = null) => {
    y += f(1.5);
    const base = y + f(size) * 0.82;
    let firstX = LM, firstW = W;
    if (boldPrefix) {
      font("bold", size);
      doc.text(boldPrefix, LM, base);
      // getTextWidth drops trailing spaces, so measure the space separately
      const space = doc.getTextWidth("a a") - doc.getTextWidth("aa");
      const pw = doc.getTextWidth(boldPrefix) * 1.02 + space;
      firstX = LM + pw;
      firstW = W - pw;
    }
    font(style, size);
    const words = txt.split(/\s+/);
    const lines = [];
    let cur = "", limit = firstW;
    for (const w of words) {
      const trial = cur ? cur + " " + w : w;
      if (doc.getTextWidth(trial) <= limit) cur = trial;
      else { lines.push(cur); cur = w; limit = W; }
    }
    if (cur) lines.push(cur);
    lines.forEach((line, i) => {
      doc.text(line, i === 0 ? firstX : LM, base + i * LH(size));
    });
    y += lines.length * LH(size);
  };

  // Name in faux small caps
  const pieces = [];
  for (const word of data.profile.name.split(/\s+/)) {
    pieces.push([word[0].toUpperCase(), 23]);
    pieces.push([word.slice(1).toUpperCase() + " ", 17.5]);
  }
  let total = 0;
  for (const [s, sz] of pieces) { font("bold", sz); total += doc.getTextWidth(s); }
  let x = (PW - total) / 2;
  y = TM + f(23);
  for (const [s, sz] of pieces) {
    font("bold", sz);
    doc.text(s, x, y);
    x += doc.getTextWidth(s);
  }
  y += f(3);

  const p = data.profile;
  const contact = `${p.phone}   |   ${p.email}   |   ${p.linkedin}`;
  font("normal", 9.5);
  y += f(9.5);
  doc.text(contact, (PW - doc.getTextWidth(contact)) / 2, y);
  y += f(1);

  section("Education");
  row(data.education.school, data.education.grad, 10, 9.2);
  para(data.education.degree, 9.5, "italic");
  para(data.education.coursework, 9.6, "normal", "Relevant Coursework:");

  section("Experience");
  for (const e of data.experience) {
    row(e.org, e.dates, 10, 9.2);
    row(e.role, e.location, 9.5, 9.2, "italic", "italic");
    bullets(e.bullets);
  }

  section("Projects");
  for (const pr of data.projects) {
    y += f(10);
    font("bold", 10);
    doc.text(pr.name, LM, y);
    const nx = LM + doc.getTextWidth(pr.name);
    font("italic", 9.5);
    doc.text(`| ${pr.tech}`, nx + f(4), y);
    textRight(y, pr.dates, 9.2);
    y += f(1.5);
    bullets(pr.bullets);
  }

  section("Technical Skills");
  for (const [cat, vals] of Object.entries(data.skills)) {
    para(vals, 9.6, "normal", `${cat}:`);
  }

  return { doc, overflow: y > PH - BM, scale };
}
