#!/usr/bin/env python3
"""Validate an exported résumé PDF.

Usage: python3 web/validate_pdf.py <file.pdf> [--expect-words words.txt] [--png out.png]

Checks: exactly one page, extractable text, required section headings in
reading order, no broken words (every word from the source résumé must
survive extraction intact), no suspicious intra-word spacing, links present.
Optionally renders page 1 to PNG (PyMuPDF) for visual inspection.
Exit code 0 on pass, 1 on failure; prints a JSON report.
"""
import json, re, sys, pathlib, warnings, logging
warnings.filterwarnings("ignore")
logging.disable(logging.CRITICAL)

def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__); sys.exit(2)
    pdf_path = pathlib.Path(args[0])
    expect_path = pathlib.Path(args[args.index("--expect-words") + 1]) if "--expect-words" in args else None
    png_path = pathlib.Path(args[args.index("--png") + 1]) if "--png" in args else None

    from pypdf import PdfReader
    import io, contextlib
    reader = PdfReader(str(pdf_path))
    report = {"file": str(pdf_path), "pages": len(reader.pages), "checks": {}, "problems": []}

    report["checks"]["one_page"] = len(reader.pages) == 1
    if len(reader.pages) != 1:
        report["problems"].append(f"expected 1 page, got {len(reader.pages)}")

    text = "\n".join((pg.extract_text() or "") for pg in reader.pages)
    report["text_chars"] = len(text)
    report["checks"]["has_text"] = len(text.strip()) > 200
    if not report["checks"]["has_text"]:
        report["problems"].append("little or no extractable text")

    # Sections in reading order
    heads = ["EDUCATION", "EXPERIENCE", "PROJECTS", "SKILLS"]
    pos = {h: text.find(h) for h in heads}
    missing = [h for h, p in pos.items() if p < 0]
    report["checks"]["sections_present"] = not missing
    if missing:
        report["problems"].append(f"missing sections: {missing}")
    present = [h for h in heads if pos[h] >= 0]
    ordered = all(pos[present[i]] < pos[present[i + 1]] for i in range(len(present) - 1)) if len(present) > 1 else True
    # Projects may legitimately precede Experience; only Education-first and Skills-last are fixed.
    edu_first = pos["EDUCATION"] >= 0 and all(pos["EDUCATION"] < pos[h] for h in present if h != "EDUCATION")
    skills_last = pos["SKILLS"] >= 0 and all(pos["SKILLS"] > pos[h] for h in present if h != "SKILLS")
    report["checks"]["reading_order"] = edu_first and skills_last
    if not report["checks"]["reading_order"]:
        report["problems"].append(f"section order unexpected: {pos}")

    # Broken-word heuristics: single letters separated by spaces, or letter-space-letter runs.
    norm = re.sub(r"\s+", " ", text)
    weird = re.findall(r"\b(?:[A-Za-z] ){3,}[A-Za-z]\b", norm)
    report["checks"]["no_spaced_letters"] = not weird
    if weird:
        report["problems"].append(f"suspicious spaced-out letters: {weird[:5]}")

    # Every word from the source résumé must appear intact in the extraction.
    if expect_path and expect_path.exists():
        words = [w for w in re.findall(r"[A-Za-z][A-Za-z'\-]{3,}", expect_path.read_text()) ]
        extracted = set(re.findall(r"[A-Za-z][A-Za-z'\-]{3,}", text.replace("\n", " ")))
        # hyphenation at line ends can split words; also accept the de-hyphenated join
        joined = re.sub(r"-\n", "", text).replace("\n", " ")
        extracted |= set(re.findall(r"[A-Za-z][A-Za-z'\-]{3,}", joined))
        lost = sorted({w for w in words if w not in extracted})
        report["expected_words"] = len(set(words))
        report["lost_words"] = lost
        report["checks"]["words_intact"] = len(lost) == 0
        if lost:
            report["problems"].append(f"{len(lost)} source words not found intact in PDF text: {lost[:10]}")

    # Links
    links = []
    for pg in reader.pages:
        for a in pg.get("/Annots") or []:
            try:
                obj = a.get_object()
                uri = obj.get("/A", {}).get("/URI")
                if uri: links.append(str(uri))
            except Exception:
                pass
    report["links"] = links
    report["checks"]["links_present"] = any("mailto:" in l for l in links) and any("linkedin" in l for l in links)
    if not report["checks"]["links_present"]:
        report["problems"].append("email/LinkedIn links not found")

    # Render for inspection
    if png_path:
        try:
            import fitz
            d = fitz.open(str(pdf_path)); pix = d[0].get_pixmap(dpi=110); pix.save(str(png_path))
            report["png"] = str(png_path)
        except Exception as e:
            report["png_error"] = str(e)

    report["ok"] = not report["problems"]
    print(json.dumps(report, indent=2, ensure_ascii=False))
    sys.exit(0 if report["ok"] else 1)

if __name__ == "__main__":
    main()
