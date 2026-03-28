import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-32 text-center">
      <p className="font-[family-name:var(--font-display)] text-8xl font-light text-muted mb-6 select-none">
        404
      </p>

      <h2 className="text-xl font-medium text-primary mb-2">
        Page not found
      </h2>

      <p className="text-sm text-secondary mb-10">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>

      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full bg-cyan px-8 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Back to Home
      </Link>
    </div>
  );
}
