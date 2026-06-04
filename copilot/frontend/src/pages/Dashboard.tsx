import { useState, useEffect, useCallback } from "react";
import { api, Job, JobDetail as JobDetailType, Stats } from "../utils/api";
import { JobCard } from "../components/JobCard";
import { JobDetail } from "../components/JobDetail";
import { StatusBadge, ALL_STATUSES } from "../components/StatusBadge";

export function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobDetailType | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [minScore, setMinScore] = useState<number | undefined>();
  const [ingestUrl, setIngestUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getJobs({
        status: statusFilter || undefined,
        min_score: minScore,
        search: search || undefined,
        limit: 200,
      });
      setJobs(data);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, minScore, search]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.getStats());
    } catch {}
  }, []);

  useEffect(() => { loadJobs(); loadStats(); }, [loadJobs, loadStats]);

  async function selectJob(id: number) {
    try {
      const detail = await api.getJob(id);
      setSelectedJob(detail);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  async function handleSyncGitHub() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const r = await api.syncGitHub([
        "data science", "data scientist", "product analyst", "machine learning",
        "ml engineer", "ai engineer", "business intelligence", "data analyst",
        "product strategy", "product manager", "analytics", "applied scientist",
      ]);
      setSyncResult(`✓ ${r.added} new jobs added, ${r.skipped_duplicates} duplicates skipped`);
      await loadJobs();
      await loadStats();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleIngestUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!ingestUrl) return;
    setLoading(true);
    try {
      await api.ingestUrl(ingestUrl);
      setIngestUrl("");
      await loadJobs();
      await loadStats();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePaste(e: React.FormEvent) {
    e.preventDefault();
    if (!pasteText) return;
    setLoading(true);
    try {
      await api.ingestPaste(pasteText, pasteUrl || undefined);
      setPasteText("");
      setPasteUrl("");
      setShowPaste(false);
      await loadJobs();
      await loadStats();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="app-title">Job Copilot</h1>
          <div className="app-subtitle">Aneesh Srirambhatla · UC Berkeley DS '27</div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="stats-block">
            <div className="stat"><span className="stat-n">{stats.total_jobs}</span><span className="stat-label">Jobs</span></div>
            <div className="stat"><span className="stat-n">{stats.avg_score}</span><span className="stat-label">Avg Score</span></div>
            <div className="stat"><span className="stat-n">{stats.status_breakdown["Applied"] || 0}</span><span className="stat-label">Applied</span></div>
            <div className="stat"><span className="stat-n">{stats.status_breakdown["Interview"] || 0}</span><span className="stat-label">Interviews</span></div>
          </div>
        )}

        {/* Actions */}
        <div className="sidebar-section">
          <button onClick={handleSyncGitHub} disabled={syncing} className="btn btn-primary btn-full">
            {syncing ? "Syncing GitHub…" : "↻ Sync GitHub Jobs"}
          </button>
          {syncResult && <div className="sync-result">{syncResult}</div>}
        </div>

        {/* URL ingest */}
        <div className="sidebar-section">
          <form onSubmit={handleIngestUrl} className="ingest-form">
            <input
              className="ingest-input"
              value={ingestUrl}
              onChange={e => setIngestUrl(e.target.value)}
              placeholder="Paste job URL (Greenhouse, Lever…)"
            />
            <button type="submit" className="btn btn-secondary" disabled={!ingestUrl}>Add</button>
          </form>
        </div>

        {/* Paste job */}
        <div className="sidebar-section">
          <button onClick={() => setShowPaste(!showPaste)} className="btn btn-link">
            {showPaste ? "▲" : "▼"} Paste job description
          </button>
          {showPaste && (
            <form onSubmit={handlePaste} className="paste-form">
              <input
                className="ingest-input"
                value={pasteUrl}
                onChange={e => setPasteUrl(e.target.value)}
                placeholder="URL (optional)"
              />
              <textarea
                className="paste-textarea"
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Paste full job description here (LinkedIn, etc.)…"
                rows={6}
              />
              <button type="submit" className="btn btn-secondary" disabled={!pasteText}>Parse & Add</button>
            </form>
          )}
        </div>

        {/* Filters */}
        <div className="sidebar-section">
          <label className="section-label">Filter by Status</label>
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <label className="section-label" style={{ marginTop: 8 }}>Min Score</label>
          <input
            type="range" min={0} max={100} step={5}
            value={minScore || 0}
            onChange={e => setMinScore(Number(e.target.value) || undefined)}
            className="score-slider"
          />
          <div className="score-slider-label">{minScore ? `≥ ${minScore}` : "Any"}</div>
        </div>

        {/* Export */}
        <div className="sidebar-section">
          <a href={api.exportCsv()} className="btn btn-link" download>⬇ Export CSV</a>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {/* Search */}
        <div className="search-bar">
          <input
            className="search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs by title, company, or keyword…"
          />
          <span className="job-count">{jobs.length} jobs</span>
        </div>

        {error && <div className="error-banner">{error} <button onClick={() => setError(null)}>✕</button></div>}

        <div className="content-split">
          {/* Job list */}
          <div className="job-list">
            {loading && <div className="loading">Loading…</div>}
            {!loading && jobs.length === 0 && (
              <div className="empty-state">
                <p>No jobs found. Click <strong>Sync GitHub Jobs</strong> to fetch the latest listings.</p>
              </div>
            )}
            {jobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                selected={selectedJob?.id === job.id}
                onClick={() => selectJob(job.id)}
              />
            ))}
          </div>

          {/* Job detail panel */}
          <div className="detail-panel">
            {selectedJob ? (
              <JobDetail
                job={selectedJob}
                onUpdate={async () => {
                  await loadJobs();
                  await loadStats();
                  if (selectedJob) await selectJob(selectedJob.id);
                }}
              />
            ) : (
              <div className="detail-empty">
                <div>Select a job to see details, match analysis, and generate materials.</div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
