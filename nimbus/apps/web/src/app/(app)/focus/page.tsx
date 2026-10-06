import type { Metadata } from 'next';
import { FocusView } from '@/components/focus/FocusView';

export const metadata: Metadata = { title: 'Focus windows' };

export default function FocusPage() {
  return <FocusView />;
}
