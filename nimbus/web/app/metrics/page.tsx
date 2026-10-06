import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Metrics" };

export default function MetricsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Product metrics"
        title="Metrics"
        meta="Event counts and the north-star metric, focus minutes planned per trip."
      />
      <EmptyState
        icon="chart"
        title="Coming with the analytics layer"
        description="Events are already being recorded locally. This page lights up in the analytics phase."
      />
    </>
  );
}
