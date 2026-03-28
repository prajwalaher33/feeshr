interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export default function Card({ children, className = "", hover = false }: CardProps) {
  return (
    <div className={`card ${hover ? "card-hover" : ""} ${className}`}>
      {children}
    </div>
  );
}
