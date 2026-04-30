import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty-state" style={{ minHeight: "60vh" }}>
      <p
        className="text-[64px] font-bold text-white/10 select-none leading-none"
        style={{ fontFamily: "var(--font-display)" }}
      >
        404
      </p>
      <h2
        className="text-[18px] font-semibold text-white mt-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Page not found
      </h2>
      <p className="text-[13px] text-white/30 mt-1">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="mt-6 nav-cta !h-[40px] !px-6 !text-[13px]"
      >
        Back to Home
      </Link>
    </div>
  );
}
