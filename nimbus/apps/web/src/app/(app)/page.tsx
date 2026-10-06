import type { Metadata } from 'next';
import { TodayView } from '@/components/timeline/TodayView';

export const metadata: Metadata = { title: 'Today · Nimbus' };

export default function TodayPage() {
  return <TodayView />;
}
