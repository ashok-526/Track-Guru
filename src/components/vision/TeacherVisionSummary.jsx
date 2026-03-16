import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

function formatTimeRange(startTime, endTime) {
  const f = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
  return `${f.format(new Date(startTime))} – ${f.format(new Date(endTime))}`;
}

function fallbackKeyFindings(analysis) {
  if (Array.isArray(analysis?.key_findings) && analysis.key_findings.length) {
    return analysis.key_findings;
  }
  return [analysis?.final_assessment, analysis?.teacher_presence_summary].filter(Boolean);
}

export function TeacherVisionSummary({ analysis }) {
  const [expanded, setExpanded] = useState(false);

  if (!analysis) return null;

  const keyFindings = fallbackKeyFindings(analysis);
  const timeline = analysis.timeline ?? [];

  return (
    <div className="space-y-3">
      {/* Compact: always visible */}
      <p className="text-sm leading-relaxed text-surface-600">
        {analysis.overall_summary}
      </p>

      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-500 transition hover:text-primary-600"
        >
          View full summary
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-1">
              {/* Admin takeaway */}
              {analysis.final_assessment && (
                <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary-600">Takeaway</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-surface-700">{analysis.final_assessment}</p>
                </div>
              )}

              {/* Key findings */}
              {keyFindings.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-surface-500">Key Findings</p>
                  <ul className="space-y-1.5">
                    {keyFindings.map((item, i) => (
                      <li key={i} className="flex gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-600">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Timeline */}
              {timeline.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-surface-500">Timeline</p>
                  <div className="space-y-1.5">
                    {timeline.map((item) => (
                      <div
                        key={`${item.start_time}-${item.end_time}`}
                        className="flex gap-3 rounded-lg border border-surface-200 bg-white px-3 py-2.5"
                      >
                        <span className="shrink-0 text-xs font-semibold text-primary-500 tabular-nums">
                          {formatTimeRange(item.start_time, item.end_time)}
                        </span>
                        <p className="text-sm text-surface-600">{item.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-surface-500 transition hover:text-surface-700"
              >
                Show less
                <svg className="h-4 w-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
