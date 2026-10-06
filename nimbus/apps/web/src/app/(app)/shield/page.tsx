import type { Metadata } from 'next';
import { ShieldView } from '@/components/shield/ShieldView';

export const metadata: Metadata = { title: 'Time zone shield' };

export default function ShieldPage() {
  return <ShieldView />;
}
