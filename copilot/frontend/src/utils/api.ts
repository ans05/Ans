const BASE = "http://localhost:8000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export const api = {
  // Stats
  getStats: () => request<Stats>("/stats"),

  // Jobs
  getJobs: (params?: JobFilter) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.min_score) q.set("min_score", String(params.min_score));
    if (params?.search) q.set("search", params.search);
    if (params?.limit) q.set("limit", String(params.limit));
    return request<Job[]>(`/jobs?${q}`);
  },
  getJob: (id: number) => request<JobDetail>(`/jobs/${id}`),
  ingestUrl: (url: string) =>
    request("/jobs/ingest/url", { method: "POST", body: JSON.stringify({ url }) }),
  ingestPaste: (text: string, url?: string, company?: string, title?: string) =>
    request("/jobs/ingest/paste", {
      method: "POST",
      body: JSON.stringify({ text, url, company, title }),
    }),
  syncGitHub: (role_keywords?: string[], company_exclusions?: string[]) =>
    request<{ added: number; skipped_duplicates: number }>("/jobs/sync/github", {
      method: "POST",
      body: JSON.stringify({ role_keywords, company_exclusions }),
    }),
  scoreJob: (id: number) =>
    request(`/jobs/${id}/score`, { method: "POST" }),

  // Applications
  createApplication: (jobId: number) =>
    request<{ application_id: number; status: string }>(`/jobs/${jobId}/apply`, { method: "POST" }),
  updateStatus: (appId: number, status: string, notes?: string) =>
    request(`/applications/${appId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
    }),
  markReviewed: (appId: number) =>
    request(`/applications/${appId}/review`, { method: "POST" }),

  // Materials
  generateMaterial: (jobId: number, material_type: string, question?: string) =>
    request<{ content: string }>(`/jobs/${jobId}/generate`, {
      method: "POST",
      body: JSON.stringify({ material_type, question }),
    }),

  // Resume
  getResume: () => request<ResumeData>("/resume/active"),

  // Export
  exportCsv: () => `${BASE}/export/csv`,
};

// Types
export interface Stats {
  total_jobs: number;
  scored_jobs: number;
  avg_score: number;
  status_breakdown: Record<string, number>;
  top_matches: { title: string; company: string; score: number }[];
}

export interface JobFilter {
  status?: string;
  min_score?: number;
  search?: string;
  limit?: number;
}

export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  source: string;
  deadline: string | null;
  date_found: string;
  status: string;
  application_id: number | null;
  score: number | null;
  explanation: string | null;
  missing_keywords: string[];
  matched_keywords: string[];
  human_reviewed: boolean;
}

export interface JobDetail extends Job {
  description: string;
  required_skills: string[];
  preferred_skills: string[];
  notes?: string;
  recruiter_name?: string;
  recruiter_email?: string;
  date_applied?: string;
  follow_up_date?: string;
  materials?: { type: string; content: string; version: number }[];
}

export interface ResumeData {
  id: number;
  version: string;
  education: unknown[];
  skills: unknown;
  experience: unknown[];
  projects: unknown[];
}
