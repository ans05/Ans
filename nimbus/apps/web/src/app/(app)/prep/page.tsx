import type { Metadata } from 'next';
import { PrepView } from '@/components/prep/PrepView';

export const metadata: Metadata = { title: 'Offline prep' };

export default function PrepPage() {
  return <PrepView />;
}
