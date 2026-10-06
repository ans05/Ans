import { LinkButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default function NotFound() {
  return (
    <EmptyState
      title="Nothing here"
      detail="That page drifted away."
      action={
        <LinkButton href="/" size="sm">
          Back to today
        </LinkButton>
      }
    />
  );
}
