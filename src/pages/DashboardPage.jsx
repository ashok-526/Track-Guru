import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Spinner } from "../components/ui/Spinner";
import { Card } from "../components/ui/Card";
import { useAppData } from "../context/AppDataContext";

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function buildClassLabel(grade, section) {
  return section ? `${grade}-${section}` : grade;
}

function scheduleTime(clock) {
  const [h, m] = clock.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function getScheduleStatus(schedule, activeSession) {
  if (activeSession?.scheduleId === schedule.id) return { label: "Live", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  const now = new Date();
  if (now < scheduleTime(schedule.startClock)) return { label: "Upcoming", cls: "bg-surface-100 text-surface-600 border-surface-200" };
  if (now > scheduleTime(schedule.endClock)) return { label: "Done", cls: "bg-surface-100 text-surface-500 border-surface-200" };
  return { label: "In Progress", cls: "bg-amber-50 text-amber-700 border-amber-200" };
}

function SectionCard({ title, action, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-surface-200 bg-white p-5 shadow-soft md:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-surface-900">{title}</h2>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

export function DashboardPage() {
  const { data, loading } = useAppData();
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  if (loading || !data) return <Spinner label="Loading dashboard..." />;

  const { overview, activeSession, todaySchedule, sessionHistory, teachers } = data;

  const selectedTeacher =
    (selectedTeacherId ? teachers.find((t) => t.uid === selectedTeacherId) : null) ??
    (activeSession ? teachers.find((t) => t.uid === activeSession.teacherId) : null) ??
    teachers[0] ?? null;

  const selectedTeacherSessions = selectedTeacher
    ? sessionHistory.filter((s) => s.teacherId === selectedTeacher.uid)
    : [];

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-surface-900">{overview.schoolName === "Shree Janata Secondary School" ? "Himalaya College of Engineering" : (overview.schoolName || "Himalaya College of Engineering")}</h1>
          <p className="mt-0.5 text-sm text-surface-500">Overview for today</p>
        </div>
        <Link to="/monitor" className="shrink-0">
          <button type="button" className="primary-button px-5 text-sm">Open Live Monitor</button>
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50">
            <svg className="h-5 w-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-surface-900">{overview.todayScheduledPeriods}</p>
            <p className="text-xs text-surface-500">Periods today</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-surface-900">{overview.verifiedStarts}</p>
            <p className="text-xs text-surface-500">Verified starts</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50">
            {activeSession ? (
              <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            ) : (
              <svg className="h-5 w-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-surface-900">{activeSession ? activeSession.teacherName : "No active session"}</p>
            <p className="text-xs text-surface-500">
              {activeSession ? `${activeSession.subject} · ${buildClassLabel(activeSession.grade, activeSession.section)}` : "Live monitor idle"}
            </p>
          </div>
        </Card>
      </div>

      {/* Today's Schedule */}
      <SectionCard
        title="Today's Schedule"
        action={
          <span className="text-xs text-surface-500">{todaySchedule.length} period{todaySchedule.length !== 1 ? "s" : ""}</span>
        }
      >
        {todaySchedule.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-center text-sm text-surface-500">
            No periods scheduled for today.
          </div>
        ) : (
          <div className="space-y-2">
            {todaySchedule.map((schedule) => {
              const st = getScheduleStatus(schedule, activeSession);
              return (
                <div
                  key={schedule.id}
                  className="flex flex-col gap-2 rounded-xl border border-surface-200 bg-surface-50/60 px-4 py-3 transition hover:bg-white md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-surface-200 text-xs font-bold text-primary-500 sm:flex">
                      {schedule.startClock}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-surface-900">{schedule.subject}</p>
                      <p className="mt-0.5 text-xs text-surface-500">
                        {buildClassLabel(schedule.grade, schedule.section)} &middot; {schedule.startClock} – {schedule.endClock} &middot; {schedule.room}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-700">{schedule.teacherName}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Teacher + Recent Sessions */}
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">

        {/* Teacher list */}
        <SectionCard title="Teachers">
          <div className="space-y-2">
            {teachers.length === 0 ? (
              <p className="text-sm text-surface-500">No teachers registered.</p>
            ) : (
              teachers.map((teacher) => {
                const isSelected = selectedTeacher?.uid === teacher.uid;
                return (
                  <button
                    key={teacher.uid}
                    type="button"
                    onClick={() => setSelectedTeacherId(teacher.uid)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? "border-primary-300 bg-primary-50"
                        : "border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50"
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isSelected ? "bg-primary-500 text-white" : "bg-surface-100 text-surface-600"
                    }`}>
                      {teacher.fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-semibold ${isSelected ? "text-primary-700" : "text-surface-900"}`}>{teacher.fullName}</p>
                      <p className="truncate text-xs text-surface-500">{teacher.subjectSpecialty}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </SectionCard>

        {/* Recent sessions */}
        <SectionCard
          title={selectedTeacher ? `${selectedTeacher.fullName} – Recent Sessions` : "Recent Sessions"}
          action={<Link to="/reports" className="text-xs font-semibold text-primary-500 transition hover:text-primary-600">View reports</Link>}
        >
          {selectedTeacherSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-center text-sm text-surface-500">
              No session history for this teacher.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left">
                <thead>
                  <tr className="border-b border-surface-200 text-xs uppercase tracking-wider text-surface-500">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Subject</th>
                    <th className="px-4 py-3 font-semibold">Class</th>
                    <th className="px-4 py-3 font-semibold">Time</th>
                    <th className="px-4 py-3 font-semibold">Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {selectedTeacherSessions.slice(0, 8).map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-surface-50">
                      <td className="px-4 py-3 text-sm font-medium text-surface-900">{formatDate(s.startedAt)}</td>
                      <td className="px-4 py-3 text-sm text-surface-600">{s.subject}</td>
                      <td className="px-4 py-3 text-sm text-surface-600">{buildClassLabel(s.grade, s.section)}</td>
                      <td className="px-4 py-3 text-sm text-surface-600">{formatTime(s.startedAt)}</td>
                      <td className="px-4 py-3 text-sm text-surface-600">{s.periodLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
