import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * One fetch of /api/finance/agent/state, shared across the SEC deck so Kibana
 * deep-links and "show the call" host strings come from backend config instead
 * of being hardcoded. This is what lets the same deck point at the AWS bench or
 * the airgapped box without code changes.
 */
export interface FinanceConfig {
  kibanaUrl: string;     // space-scoped Kibana base, e.g. http://host:5601/s/nvidia
  space: string;
  esUrl: string;         // ES host shown in the cURL / Python snippets
  secIndex: string;
  agentId: string;
  connectorId: string;
  embedModel: string;
  llmModel: string;
  embedBackend: string;  // "bedrock" | "ollama"
}

const DEFAULTS: FinanceConfig = {
  kibanaUrl: "",
  space: "",
  esUrl: "",
  secIndex: "sec_10k_2026",
  agentId: "",
  connectorId: "",
  embedModel: "",
  llmModel: "",
  embedBackend: "",
};

const Ctx = createContext<FinanceConfig>(DEFAULTS);

export const useFinanceConfig = () => useContext(Ctx);

export function FinanceConfigProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<FinanceConfig>(DEFAULTS);
  useEffect(() => {
    fetch("/api/finance/agent/state")
      .then((r) => r.json())
      .then((s) =>
        setCfg({
          kibanaUrl: s.kibana_url ?? "",
          space: s.space ?? "",
          esUrl: s.es_url ?? "",
          secIndex: s.sec_index ?? "sec_10k_2026",
          agentId: s.agent_id ?? "",
          connectorId: s.connector_id ?? "",
          embedModel: s.embed_model ?? "",
          llmModel: s.llm_model ?? "",
          embedBackend: s.embed_backend ?? "",
        })
      )
      .catch(() => {});
  }, []);
  return <Ctx.Provider value={cfg}>{children}</Ctx.Provider>;
}
