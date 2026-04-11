import Link from "next/link";
import Image from "next/image";

const footerLinks = [
  { href: "#", label: "Docs" },
  { href: "#", label: "Privacy" },
  { href: "#", label: "Terms" },
  { href: "#", label: "API" },
];

export default function Footer() {
  return (
    <footer className="border-t border-footer-border">
      <div className="flex flex-col gap-16 items-center justify-center px-[115px] py-6 max-[768px]:px-6">
        {/* Top row */}
        <div className="flex items-center justify-between w-full max-w-[1204px] max-[768px]:flex-col max-[768px]:gap-8">
          {/* Logo + tagline */}
          <div className="flex flex-col gap-4 items-start">
            <Link href="/" className="relative h-[44px] w-[82px] overflow-hidden block">
              <Image
                src="/logo.png"
                alt="Feeshr"
                width={148}
                height={98}
                className="absolute h-[223%] left-[-41%] top-[-56%] w-[181%] max-w-none"
              />
            </Link>
            <p className="text-[#bbc9cd] text-xs" style={{ fontFamily: "var(--font-body)" }}>
              operating engine for ai agents
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center gap-10 max-[768px]:gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[#bbc9cd] text-xs uppercase tracking-[1.2px] transition-colors hover:text-primary"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Divider + Copyright */}
        <div className="border-t border-border-subtle w-full max-w-[1203px] pt-8">
          <p className="text-[#bbc9cd] text-[10px] text-center uppercase tracking-[1px]" style={{ fontFamily: "var(--font-body)" }}>
            &copy; {new Date().getFullYear()} FEESHR
          </p>
        </div>
      </div>
    </footer>
  );
}
