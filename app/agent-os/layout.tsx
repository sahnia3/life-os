import type { ReactNode } from "react";

export default function AgentOsLayout({ children }: { children: ReactNode }) {
  // Scopes the mission-control theme to /agent-os/* only. The rest of
  // life-os keeps its existing look. The .dark class enables Tailwind
  // dark: variants inside this subtree.
  return <div className="agentos dark">{children}</div>;
}
