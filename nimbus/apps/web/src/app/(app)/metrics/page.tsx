import type { Metadata } from 'next';
import { MetricsView } from '@/components/metrics/MetricsView';

export const metadata: Metadata = { title: 'Metrics' };

export default function MetricsPage() {
  return <MetricsView />;
}
