export default function HeroSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={className}>{children}</section>;
}
