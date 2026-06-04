interface Props {
  score: number | null;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, size = "md" }: Props) {
  if (score === null) return <span className="score-badge score-none">—</span>;

  const color =
    score >= 75 ? "score-high" :
    score >= 50 ? "score-mid" :
    "score-low";

  const sizeClass = size === "lg" ? "score-lg" : size === "sm" ? "score-sm" : "";

  return (
    <span className={`score-badge ${color} ${sizeClass}`}>
      {score.toFixed(0)}
    </span>
  );
}
