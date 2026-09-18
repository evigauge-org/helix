import { ReviewInbox } from "@/components/reviews/review-inbox";

export default function ReviewsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-gray-900">Reviews</h1>
        <p className="mt-1 text-sm text-gray-600">
          Pending agent outputs awaiting your sign-off, plus the audit history of past decisions.
        </p>
      </header>
      <ReviewInbox />
    </div>
  );
}
