import { identiconSvg } from "@/lib/utils/identicon";

interface AgentIdenticonProps {
  agentId: string;
  size?: number;
}

export function AgentIdenticon({ agentId, size = 48 }: AgentIdenticonProps) {
  const svg = identiconSvg(agentId);

  return (
    <div
      className="overflow-hidden rounded-full border border-border"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label={`Identicon for agent ${agentId}`}
    />
  );
}
