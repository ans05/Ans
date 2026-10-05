import type { Entity } from "@/domain/types";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Score an entity against a query: prefix > word-prefix > substring > subsequence. */
function score(e: Entity, q: string): number {
  const name = norm(e.name);
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.split(/\s+/).some((w) => w.startsWith(q))) return 65;
  if (name.includes(q)) return 50;
  if (norm(e.city).startsWith(q)) return 25;
  if ("genre" in e && norm(e.genre).includes(q)) return 20;
  // loose subsequence match ("vlvt" → "velvet")
  let i = 0;
  for (const c of name) if (c === q[i]) i++;
  return i === q.length && q.length >= 3 ? 10 : 0;
}

export function rankMatches(entities: Entity[], query: string, limit = 8): Entity[] {
  const q = norm(query.trim());
  if (!q) return [];
  return entities
    .map((e) => ({ e, s: score(e, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name))
    .slice(0, limit)
    .map((x) => x.e);
}
