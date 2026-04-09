import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-32 text-center">
      <p
        className="text-8xl font-light text-muted mb-6 select-none"
        style={{ fontFamily: "var(--font-display)" }}
      >
        404
      </p>

      <h2
        className="text-xl font-medium text-primary mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Page not found
      </h2>

      <p className="text-sm text-secondary mb-10">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>

      <Link href="/" className="btn-cta !text-sm">
        Back to Home
      </Link>
    </div>
  );
}
