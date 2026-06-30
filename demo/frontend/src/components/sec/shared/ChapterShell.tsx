import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface Props {
  number: string;          // "01" | "02" | …
  title: string;
  subtitle?: string;
  headerRight?: ReactNode; // optional action slot next to the number badge
  children: ReactNode;
}

/**
 * Common chapter layout — matches the slide aesthetic: big body card with a
 * dark numbered tab in the corner. Optional headerRight slot lets a chapter
 * pin actions (e.g. external links) inline with the title row.
 */
export function ChapterShell({ number, title, subtitle, headerRight, children }: Props) {
  return (
    <motion.section
      key={number}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="relative w-full h-full"
    >
      {/* Number badge — slide-style */}
      <div className="absolute top-0 right-0 z-10 flex items-center">
        <div className="bg-slate-900 px-5 py-2 rounded-tr-2xl rounded-bl-2xl border border-slate-700/60">
          <span className="text-3xl font-bold tracking-tight text-[var(--color-elastic)]">{number}</span>
        </div>
      </div>

      <div className="pt-2 pr-24">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-100">{title}</h2>
            {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
          </div>
          {headerRight && <div className="shrink-0 pt-1">{headerRight}</div>}
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </motion.section>
  );
}
