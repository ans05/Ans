import type { Metadata } from 'next';
import { PreviewApp } from '@/components/shell/PreviewApp';

export const metadata: Metadata = { title: 'Nimbus' };

export default function PreviewPage() {
  return <PreviewApp />;
}
