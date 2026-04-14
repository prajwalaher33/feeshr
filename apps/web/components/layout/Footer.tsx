import Link from "next/link";
import Image from "next/image";

const socialLinks = [
  {
    href: "https://www.instagram.com/feeshr",
    label: "Instagram",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </svg>
    ),
  },
  {
    href: "https://www.reddit.com/r/feeshr",
    label: "Reddit",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14.238 15.348c.085.084.085.221 0 .306-.465.462-1.194.687-2.231.687l-.008-.002-.008.002c-1.036 0-1.766-.225-2.231-.688-.085-.084-.085-.221 0-.305.084-.084.222-.084.307 0 .379.377 1.008.561 1.924.561l.008.002.008-.002c.915 0 1.544-.184 1.924-.561.085-.084.223-.084.307 0zm-3.44-2.418c0-.507-.414-.919-.922-.919-.509 0-.922.412-.922.919 0 .506.414.918.922.918.508 0 .922-.412.922-.918zm4.04-.919c-.509 0-.922.412-.922.919 0 .506.414.918.922.918.508 0 .922-.412.922-.918 0-.507-.414-.919-.922-.919zM12 2C6.478 2 2 6.477 2 12c0 5.522 4.478 10 10 10 5.523 0 10-4.478 10-10 0-5.523-4.477-10-10-10zm5.8 11.333c.012.167.018.335.018.505 0 2.574-2.997 4.662-6.695 4.662-3.697 0-6.695-2.088-6.695-4.662 0-.17.006-.338.018-.505-.403-.22-.672-.637-.672-1.121 0-.71.576-1.285 1.287-1.285.347 0 .662.136.896.357 1.058-.762 2.524-1.251 4.147-1.308l.781-3.681.053-.007 2.56.547c.185-.31.52-.522.908-.522.584 0 1.058.474 1.058 1.057 0 .584-.474 1.058-1.058 1.058-.578 0-1.048-.466-1.057-1.041l-2.306-.492-.702 3.31c1.58.073 3.004.563 4.033 1.31.234-.222.55-.358.897-.358.711 0 1.287.575 1.287 1.285 0 .484-.269.901-.672 1.121z" />
      </svg>
    ),
  },
  {
    href: "https://x.com/feeshr",
    label: "X",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    href: "https://discord.gg/feeshr",
    label: "Discord",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
    ),
  },
  {
    href: "https://github.com/prajwalaher33/feeshr",
    label: "GitHub",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
  },
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

          {/* Social media icons */}
          <div className="flex items-center gap-6 max-[768px]:gap-4">
            {socialLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
                className="text-[#bbc9cd] transition-colors hover:text-primary"
              >
                {link.icon}
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
