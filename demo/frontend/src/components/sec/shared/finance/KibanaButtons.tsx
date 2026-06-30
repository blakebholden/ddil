import { Layers, Search, BarChart3, ExternalLink } from "lucide-react";
import { useFinanceConfig } from "../../lib/financeConfig";

/**
 * Three deep-links into the configured Kibana space:
 *   - Dev Tools (Console)
 *   - Discover (sec-10k-data-view)
 *   - SEC 10-K overview dashboard
 * Kibana base URL comes from /api/finance/agent/state (bench or airgapped).
 */
interface Btn {
  href: string;
  Icon: typeof Layers;
  label: string;
  title: string;
}

export function KibanaButtons() {
  const { kibanaUrl } = useFinanceConfig();
  const BUTTONS: Btn[] = [
    {
      href: `${kibanaUrl}/app/dev_tools#/console`,
      Icon: Layers,
      label: "Dev Tools",
      title: "Open Kibana Dev Tools Console (paste the kNN body to run it inline)",
    },
    {
      href: `${kibanaUrl}/app/discover#/?_a=(index:sec-10k-data-view)`,
      Icon: Search,
      label: "Discover",
      title: "Open the SEC 10-K data view in Discover",
    },
    {
      href: `${kibanaUrl}/app/dashboards#/view/sec-10k-overview`,
      Icon: BarChart3,
      label: "Dashboard",
      title: "Open the SEC 10-K corpus overview dashboard",
    },
  ];
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-500 mr-1">In Kibana</span>
      {BUTTONS.map((b) => (
        <a
          key={b.label}
          href={b.href}
          target="_blank"
          rel="noreferrer"
          title={b.title}
          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-slate-100 ring-1 ring-slate-700/50 transition-colors"
        >
          <b.Icon size={12} />
          {b.label}
          <ExternalLink size={10} className="opacity-60 group-hover:opacity-100" />
        </a>
      ))}
    </div>
  );
}
