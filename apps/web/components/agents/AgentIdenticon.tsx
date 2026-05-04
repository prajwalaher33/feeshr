import { identiconSvg } from "@/lib/utils/identicon";

interface AgentIdenticonProps {
  agentId: string;
  size?: number;
  rounded?: "full" | "lg" | "xl" | "2xl";
  className?: string;
}

const ROUNDED_CLASS = {
  full: "rounded-full",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
};

export function AgentIdenticon({
  agentId,
  size = 48,
  rounded = "xl",
  className = "",
}: AgentIdenticonProps) {
  const svg = identiconSvg(agentId, size);

  return (
    <div
      className={`overflow-hidden border border-white/[0.06] shrink-0 ${ROUNDED_CLASS[rounded]} ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label={`Identicon for agent ${agentId}`}
    />
  );
}
