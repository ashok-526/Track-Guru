import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { useAppData } from "../context/AppDataContext";

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatRange(startTime, endTime) {
  const f = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
  return `${f.format(new Date(startTime))} – ${f.format(new Date(endTime))}`;
}

function withinFilter(dateValue, filter) {
  const age = Date.now() - new Date(dateValue).getTime();
  if (filter === "daily") return age <= 86400000;
  if (filter === "weekly") return age <= 604800000;
  return age <= 2678400000;
}

function SessionSummaryDetail({ session }) {
  const [expanded, setExpanded] = useState(false);

  const hasVision = Boolean(session.visionAnalysis);
  const overallText = session.visionAnalysis?.overall_summary
    ?? session.engagement.reasons?.[0]
    ?? `${session.subject} session in ${session.room}.`;
  const takeaway = session.visionAnalysis?.final_assessment;
  const keyFindings = session.visionAnalysis?.key_findings?.length
    ? session.visionAnalysis.key_findings
    : [session.visionAnalysis?.teacher_presence_summary, session.visionAnalysis?.final_assessment].filter(Boolean);
  const visionTimeline = session.visionAnalysis?.timeline ?? [];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-surface-900">{session.subject}</h3>
          <p className="text-xs text-surface-500">
            {session.grade} {session.section} &middot; {session.room} &middot; {session.periodLabel}
          </p>
        </div>
        <span className="shrink-0 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1 text-xs font-medium text-surface-600">
          {formatDateTime(session.endedAt ?? session.startedAt)}
        </span>
      </div>

      {/* Summary text */}
      <p className="text-sm leading-relaxed text-surface-600">{overallText}</p>

      {/* Activity timeline (always show) */}
      {session.timeline.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-surface-500">Activity Timeline</p>
          <div className="space-y-1.5">
            {session.timeline.map((w) => (
              <div key={w.id} className="flex gap-3 rounded-lg border border-surface-200 bg-white px-3 py-2.5">
                <span className="shrink-0 text-xs font-semibold text-primary-500 tabular-nums">
                  {formatRange(w.startTime, w.endTime)}
                </span>
                <span className="text-sm text-surface-600 capitalize">{w.dominantActivity.replace("_", " ")}</span>
                <span className={`ml-auto shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${w.teacherVisible ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                  {w.teacherVisible ? "visible" : "away"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expand for AI details */}
      {hasVision && !expanded && (
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
              {takeaway && (
                <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary-600">Takeaway</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-surface-700">{takeaway}</p>
                </div>
              )}

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

              {visionTimeline.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-surface-500">AI Timeline</p>
                  <div className="space-y-1.5">
                    {visionTimeline.map((item) => (
                      <div key={`${item.start_time}-${item.end_time}`} className="flex gap-3 rounded-lg border border-surface-200 bg-white px-3 py-2.5">
                        <span className="shrink-0 text-xs font-semibold text-primary-500 tabular-nums">
                          {formatRange(item.start_time, item.end_time)}
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

export function ReportsPage() {
  const { data, loading } = useAppData();
  const [filter, setFilter] = useState("weekly");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const detailRef = useRef(null);

  if (loading || !data) return <Spinner label="Loading reports..." />;

  const selectedTeacher =
    (selectedTeacherId ? data.teachers.find((t) => t.uid === selectedTeacherId) : null) ?? data.teachers[0] ?? null;

  const filteredSessions = useMemo(() => {
    if (!selectedTeacher) return [];
    return data.sessionHistory.filter(
      (s) => s.teacherId === selectedTeacher.uid && withinFilter(s.endedAt ?? s.startedAt, filter)
    );
  }, [data.sessionHistory, filter, selectedTeacher]);

  const selectedSession = filteredSessions.find((s) => s.id === selectedSessionId) ?? filteredSessions[0] ?? null;

  function handleExport() {
    const win = window.open("", "_blank");
    if (!win) { window.print(); return; }

    const teacher = selectedTeacher;
    const session = selectedSession;
    const vision = session?.visionAnalysis;
    const timeline = session?.timeline ?? [];
    const visionTimeline = vision?.timeline ?? [];
    const keyFindings = vision?.key_findings ?? [];
    const reasons = session?.engagement?.reasons ?? [];
    const sm = session?.summary ?? {};

    const sessionMeta = session
      ? `${session.subject} · ${session.grade} ${session.section} · ${session.room} · ${session.periodLabel}<br>${formatDateTime(session.startedAt)}${session.endedAt ? ` – ${formatDateTime(session.endedAt)}` : ""}`
      : "No session selected";

    const summaryText = vision?.overall_summary
      ?? (reasons.length ? reasons.join(". ") + "." : "");

    const metricsHtml = session ? `
      <h2>Session Metrics</h2>
      <table class="metrics">
        <tr><td>Visible Time</td><td><b>${sm.visibleMinutes ?? 0} min</b></td></tr>
        <tr><td>Active Teaching</td><td><b>${sm.activeTeachingMinutes ?? 0} min</b></td></tr>
        <tr><td>Inactive Time</td><td><b>${sm.inactiveMinutes ?? 0} min</b></td></tr>
        <tr><td>Phone Usage</td><td><b>${sm.phoneUsageMinutes ?? 0} min</b></td></tr>
        <tr><td>Absent Time</td><td><b>${sm.absentMinutes ?? 0} min</b></td></tr>
        <tr><td>Verification</td><td><b>${session.verification?.method === "face-match" ? "Face Verified" : "Admin Override"}</b></td></tr>
      </table>` : "";

    const reasonsHtml = reasons.length
      ? `<h2>Observations</h2>${reasons.map((r) => `<div class="finding">• ${r}</div>`).join("")}` : "";

    const takeawayHtml = vision?.final_assessment
      ? `<div class="takeaway"><b>Admin Takeaway</b>${vision.final_assessment}</div>` : "";

    const findingsHtml = keyFindings.length
      ? `<h2>Key Findings</h2>${keyFindings.map((f) => `<div class="finding">• ${f}</div>`).join("")}` : "";

    const activityHtml = timeline.length
      ? `<h2>Activity Timeline</h2>${timeline.map((w) => `<div class="row"><span class="time">${formatRange(w.startTime, w.endTime)}</span><span class="desc">${w.dominantActivity.replace("_", " ")}${w.teacherVisible ? "" : " (away)"}</span></div>`).join("")}` : "";

    const aiTimelineHtml = visionTimeline.length
      ? `<h2>AI Observation Timeline</h2>${visionTimeline.map((t) => `<div class="row"><span class="time">${formatRange(t.start_time, t.end_time)}</span><span class="desc">${t.summary}</span></div>`).join("")}` : "";

    const allSessionsHtml = filteredSessions.length > 1 ? `
      <h2>All Sessions (${filteredSessions.length})</h2>
      <table class="sessions">
        <tr><th>Date</th><th>Subject</th><th>Class</th><th>Period</th><th>Visible</th><th>Teaching</th></tr>
        ${filteredSessions.map((s) => `<tr>
          <td>${formatDate(s.endedAt ?? s.startedAt)}</td>
          <td>${s.subject}</td>
          <td>${s.grade} ${s.section}</td>
          <td>${s.periodLabel}</td>
          <td>${s.summary.visibleMinutes}m</td>
          <td>${s.summary.activeTeachingMinutes}m</td>
        </tr>`).join("")}
      </table>` : "";

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Session Report – ${teacher?.fullName ?? "Teacher"}</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;color:#1f2a3b;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.6}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:13px;margin:28px 0 10px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7789;border-bottom:1px solid #E4E8ED;padding-bottom:6px}
  .meta{font-size:13px;color:#6b7789;margin-bottom:20px}
  .summary{font-size:14px;margin:12px 0 20px;padding:12px 16px;background:#F8FAFB;border-radius:8px;border:1px solid #E4E8ED}
  .takeaway{background:#E8F4FD;border:1px solid #C5E3F9;border-radius:8px;padding:12px 16px;margin:16px 0}
  .takeaway b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#006CC4;margin-bottom:4px}
  .row{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid #E4E8ED;font-size:13px}
  .row .time{flex-shrink:0;width:140px;color:#006CC4;font-weight:600} .row .desc{flex:1}
  .finding{padding:6px 0;font-size:13px;border-bottom:1px solid #F1F4F7}
  .metrics{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}
  .metrics td{padding:6px 12px;border-bottom:1px solid #F1F4F7} .metrics td:first-child{color:#6b7789;width:160px}
  .sessions{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0}
  .sessions th{text-align:left;padding:6px 8px;border-bottom:2px solid #E4E8ED;color:#6b7789;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;font-size:10px}
  .sessions td{padding:6px 8px;border-bottom:1px solid #F1F4F7}
  .footer{margin-top:36px;padding-top:16px;border-top:1px solid #E4E8ED;font-size:11px;color:#9BA5B3}
  @media print{body{margin:20px auto}}
</style></head><body>
<h1>${teacher?.fullName ?? "Teacher"} – Session Report</h1>
<p class="meta">${teacher ? `${teacher.title} · ${teacher.subjectSpecialty}` : ""}<br>${sessionMeta}</p>
${summaryText ? `<div class="summary">${summaryText}</div>` : ""}
${takeawayHtml}
${metricsHtml}
${reasonsHtml}
${findingsHtml}
${activityHtml}
${aiTimelineHtml}
${allSessionsHtml}
<div class="footer">Generated ${new Date().toLocaleString()} · Track Guru · Himalaya College of Engineering</div>
</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <h1 className="text-xl font-extrabold tracking-tight text-surface-900">Reports</h1>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="min-w-[180px] rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm font-semibold text-surface-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
            value={selectedTeacher?.uid ?? ""}
            onChange={(e) => { setSelectedTeacherId(e.target.value); setSelectedSessionId(null); }}
          >
            {data.teachers.map((t) => <option key={t.uid} value={t.uid}>{t.fullName}</option>)}
          </select>

          <div className="flex rounded-xl border border-surface-200 bg-surface-50 p-1">
            {data.reportFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  filter === item.value ? "bg-white text-surface-900 shadow-sm" : "text-surface-500 hover:text-surface-900"
                }`}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Button variant="secondary" onClick={handleExport} className="gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </Button>
        </div>
      </motion.div>

      {/* Teacher info strip */}
      {selectedTeacher && (
        <Card className="flex items-center gap-4 px-5 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-600">
            {selectedTeacher.fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-surface-900">{selectedTeacher.fullName}</p>
            <p className="text-xs text-surface-500">{selectedTeacher.title} &middot; {selectedTeacher.subjectSpecialty}</p>
          </div>
          <span className="text-xs font-medium text-surface-500">{filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""}</span>
        </Card>
      )}

      {/* Session list + detail */}
      {selectedTeacher && (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          {/* Left: session list */}
          <div className="space-y-2 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto lg:pr-1">
            {filteredSessions.length === 0 ? (
              <Card className="p-5 text-center">
                <p className="text-sm text-surface-500">No sessions in this period.</p>
              </Card>
            ) : (
              filteredSessions.map((session) => {
                const isActive = selectedSession?.id === session.id;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`w-full text-left rounded-xl border p-3.5 transition ${
                      isActive
                        ? "border-primary-300 bg-primary-50 shadow-sm"
                        : "border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${isActive ? "text-primary-700" : "text-surface-900"}`}>
                          {session.subject}
                        </p>
                        <p className={`text-xs mt-0.5 ${isActive ? "text-primary-600" : "text-surface-500"}`}>
                          {session.grade} {session.section} &middot; {session.periodLabel}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[11px] font-medium ${isActive ? "text-primary-500" : "text-surface-400"}`}>
                        {formatDate(session.endedAt ?? session.startedAt)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: session detail */}
          <Card className="p-5 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto" ref={detailRef}>
            {selectedSession ? (
              <SessionSummaryDetail session={selectedSession} />
            ) : (
              <div className="flex h-full items-center justify-center py-12">
                <p className="text-sm text-surface-500">Select a session to view its report.</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
