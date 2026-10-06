import { Card } from '@/components/ui/Card';

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export function StatTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-meta">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-[-0.02em]">{compact.format(value)}</p>
      {hint && <p className="text-meta mt-1">{hint}</p>}
    </Card>
  );
}
