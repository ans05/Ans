import { useState } from "react";
import { api, JobDetail as JobDetailType } from "../utils/api";
import { ScoreBadge } from "./ScoreBadge";
import { StatusBadge, ALL_STATUSES } from "./StatusBadge";

interface Props {
  job: JobDetailType;
  onUpdate: () => void;
}

export function JobDetail({ job, onUpdate }: Props) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [question, setQuestion] = useState("");
  const [notes, setNotes] = useState(job.notes || "");
  const [syncing, setSyncing] = useState(false);

  async function ensureApplication() {
    if (job.application_id) return job.application_id;
    const r = await api.createApplication(job.id);
    return r.application_id;
  }

  async function handleStatusChange(status: string) {
    const appId = await ensureApplication();
    if (status === "Applied" && !job.human_reviewed) {
      if (!window.confirm("Mark this as Applied? This confirms you manually submitted the application.")) return;
      await api.markReviewed(appId);
    }
    await api.updateStatus(appId, status, notes || undefined);
    onUpdate();
  }

  async function handleGenerate(type: string) {
    setGenerating(type);
    try {
      const result = await api.generateMaterial(job.id, type, type === "app_question" ? question : undefined);
      setGeneratedContent(prev => ({ ...prev, [type]: result.content }));
      await ensureApplication();
      onUpdate();
    } catch (e: unknown) {
      alert(`Generation failed: ${(e as Error).message}`);
    } finally {
      setGenerating(null);
    }
  }

  async function handleScore() {
    setSyncing(true);
    try {
      await api.scoreJob(job.id);
      onUpdate();
    } finally {
      setSyncing(false);
    }
  }

  const existingMaterials = job.materials || [];

  return (
    <div className="job-detail">
      {/* Header */}
      <div className="detail-header">
        <div>
          <h2 className="detail-title">{job.title}</h2>
          <div className="detail-company">{job.company} · {job.location || "Unknown location"}</div>
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="detail-apply-link">
              View Job Posting ↗
            </a>
          )}
        </div>
        <div className="detail-score-block">
          <ScoreBadge score={job.score} size="lg" />
          {job.score === null && (
            <button onClick={handleScore} disabled={syncing} className="btn btn-sm">
              {syncing ? "Scoring…" : "Score"}
            </button>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="detail-section">
        <label className="section-label">Status</label>
        <div className="status-row">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              className={`status-btn ${job.status === s ? "status-btn-active" : ""}`}
              onClick={() => handleStatusChange(s)}
            >
              {s}
            </button>
          ))}
        </div>
        {job.human_reviewed && <div className="reviewed-badge">✓ Human reviewed</div>}
      </div>

      {/* Match analysis */}
      {job.explanation && (
        <div className="detail-section">
          <label className="section-label">Match Analysis</label>
          <p className="explanation-text">{job.explanation}</p>
        </div>
      )}

      {/* Keywords */}
      {(job.matched_keywords?.length > 0 || job.missing_keywords?.length > 0) && (
        <div className="detail-section keyword-section">
          {job.matched_keywords?.length > 0 && (
            <div>
              <span className="kw-label">Matched:</span>
              {job.matched_keywords.map(k => <span key={k} className="keyword-match">{k}</span>)}
            </div>
          )}
          {job.missing_keywords?.length > 0 && (
            <div>
              <span className="kw-label">Missing:</span>
              {job.missing_keywords.map(k => <span key={k} className="keyword-missing">{k}</span>)}
            </div>
          )}
        </div>
      )}

      {/* Skills */}
      {(job.required_skills?.length > 0 || job.preferred_skills?.length > 0) && (
        <div className="detail-section">
          <label className="section-label">Skills</label>
          {job.required_skills?.length > 0 && (
            <div>
              <span className="kw-label">Required: </span>
              {job.required_skills.map(s => <span key={s} className="skill-chip skill-required">{s}</span>)}
            </div>
          )}
          {job.preferred_skills?.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <span className="kw-label">Preferred: </span>
              {job.preferred_skills.map(s => <span key={s} className="skill-chip skill-preferred">{s}</span>)}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="detail-section">
        <label className="section-label">Notes</label>
        <textarea
          className="notes-textarea"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add notes, recruiter info, interview prep…"
          rows={3}
        />
      </div>

      {/* Generate materials */}
      <div className="detail-section">
        <label className="section-label">Generate Materials</label>
        <div className="generate-buttons">
          {["cover_letter", "bullets", "why_company"].map(type => (
            <button
              key={type}
              onClick={() => handleGenerate(type)}
              disabled={generating === type}
              className="btn btn-generate"
            >
              {generating === type ? "Generating…" : {
                cover_letter: "Cover Letter",
                bullets: "Resume Bullets",
                why_company: "Why This Company",
              }[type]}
            </button>
          ))}
        </div>

        <div className="app-question-row">
          <input
            className="question-input"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Paste an application question…"
          />
          <button
            onClick={() => handleGenerate("app_question")}
            disabled={!question || generating === "app_question"}
            className="btn btn-generate"
          >
            {generating === "app_question" ? "…" : "Answer"}
          </button>
        </div>
      </div>

      {/* Generated content */}
      {Object.entries(generatedContent).map(([type, content]) => (
        <div key={type} className="detail-section generated-block">
          <label className="section-label">
            {{
              cover_letter: "Cover Letter",
              bullets: "Resume Bullet Suggestions",
              why_company: "Why This Company",
              app_question: "Application Answer",
            }[type] || type}
          </label>
          <pre className="generated-text">{content}</pre>
          <button className="btn btn-copy" onClick={() => navigator.clipboard.writeText(content)}>
            Copy
          </button>
        </div>
      ))}

      {/* Saved materials */}
      {existingMaterials.length > 0 && (
        <div className="detail-section">
          <label className="section-label">Saved Materials</label>
          {existingMaterials.map((m, i) => (
            <details key={i} className="material-details">
              <summary>{m.type} (v{m.version})</summary>
              <pre className="generated-text">{m.content}</pre>
            </details>
          ))}
        </div>
      )}

      {/* Description */}
      {job.description && (
        <div className="detail-section">
          <label className="section-label">Job Description</label>
          <div className="description-text">{job.description.slice(0, 1200)}{job.description.length > 1200 ? "…" : ""}</div>
        </div>
      )}
    </div>
  );
}
