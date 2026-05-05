import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-2 text-[12px] text-white/25 mb-6 ${className}`}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-2 min-w-0">
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-cyan transition-colors shrink-0">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-white/50 truncate" : "text-white/35 shrink-0"} aria-current={isLast ? "page" : undefined}>
                {item.label}
              </span>
            )}
            {!isLast && <span className="text-white/10 shrink-0">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
