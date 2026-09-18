"use client";

import { ReviewInbox } from "@/components/reviews/review-inbox";

export function AgentReviewsTab({ agentId }: { agentId: string }) {
  return <ReviewInbox agentId={agentId} />;
}
