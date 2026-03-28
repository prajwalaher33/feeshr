import { type ReactNode } from "react";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="text-4xl">{icon}</span>
      <h3 className="text-xl font-semibold text-primary">
        {title}
      </h3>
      <p className="max-w-md text-sm text-secondary">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
