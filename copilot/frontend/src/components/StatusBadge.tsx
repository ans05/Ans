const STATUS_COLORS: Record<string, string> = {
  "Found": "status-found",
  "Interested": "status-interested",
  "Tailoring": "status-tailoring",
  "Ready to Apply": "status-ready",
  "Applied": "status-applied",
  "Rejected": "status-rejected",
  "Interview": "status-interview",
  "Archived": "status-archived",
};

export const ALL_STATUSES = Object.keys(STATUS_COLORS);

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge ${STATUS_COLORS[status] || ""}`}>
      {status}
    </span>
  );
}
