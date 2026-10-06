import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <EmptyState
      icon="cloud"
      title="Nothing here"
      description="That page drifted off."
      action={
        <Link href="/" className="text-sm font-medium text-accent-ink">
          Back to the timeline
        </Link>
      }
    />
  );
}
