import { Job } from "../utils/api";
import { ScoreBadge } from "./ScoreBadge";
import { StatusBadge } from "./StatusBadge";

interface Props {
  job: Job;
  onClick: () => void;
  selected: boolean;
}

export function JobCard({ job, onClick, selected }: Props) {
  const daysAgo = job.date_found
    ? Math.floor((Date.now() - new Date(job.date_found).getTime()) / 86400000)
    : null;

  return (
    <div className={`job-card ${selected ? "job-card-selected" : ""}`} onClick={onClick}>
      <div className="job-card-header">
        <div className="job-card-left">
          <div className="job-title">{job.title}</div>
          <div className="job-company">{job.company}</div>
          <div className="job-meta">
            <span>{job.location || (job.remote ? "Remote" : "Unknown")}</span>
            {daysAgo !== null && (
              <span className="job-age">{daysAgo === 0 ? "Today" : `${daysAgo}d ago`}</span>
            )}
            <span className="job-source">{job.source?.split(":")[0]}</span>
          </div>
        </div>
        <div className="job-card-right">
          <ScoreBadge score={job.score} />
          <StatusBadge status={job.status} />
        </div>
      </div>
      {job.deadline && (
        <div className="job-deadline">
          Deadline: {new Date(job.deadline).toLocaleDateString()}
        </div>
      )}
      {job.matched_keywords?.length > 0 && (
        <div className="job-keywords">
          {job.matched_keywords.slice(0, 4).map((kw) => (
            <span key={kw} className="keyword-match">{kw}</span>
          ))}
          {job.missing_keywords?.slice(0, 2).map((kw) => (
            <span key={kw} className="keyword-missing">{kw}</span>
          ))}
        </div>
      )}
    </div>
  );
}
