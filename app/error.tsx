"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 space-y-3">
      <h2 className="font-semibold text-rose-900">Something went wrong</h2>
      <p className="text-sm text-rose-800 break-words">
        {error.message || "A server-side exception occurred."}
      </p>
      {error.digest ? (
        <p className="text-xs text-rose-600">Digest: {error.digest}</p>
      ) : null}
      <p className="text-xs text-rose-700">
        Common Netlify cause: missing AUTH_SECRET / ALLOW_ANONYMOUS_DEV_USER /
        DATABASE_URL env vars. Check Site configuration → Environment variables.
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md"
      >
        Try again
      </button>
    </div>
  );
}
