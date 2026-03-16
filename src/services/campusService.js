import { buildDemoSchedules, buildDemoState, reportFilterOptions } from "../data/seed";
import {
  appendGeneratedObservation,
  buildSessionAlertList,
  buildTeacherTrendRows,
  decorateSession
} from "./aiService";

const DEMO_STATE_KEY = "teacher_activity_demo_state";
const DEMO_SESSION_KEY = "teacher_activity_demo_session";
const DEMO_EVENT = "teacher_activity_demo_changed";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emitDemoChange() {
  window.dispatchEvent(new CustomEvent(DEMO_EVENT));
}

function repairDemoState(state) {
  const repaired = {
    ...state
  };
  let changed = false;
  const todayKey = todayDayKey();
  const nextSchedules = Array.isArray(repaired.schedules) ? [...repaired.schedules] : [];

  if (!nextSchedules.length) {
    repaired.schedules = buildDemoSchedules(todayKey);
    changed = true;
  } else {
    const hasTodaySchedule = nextSchedules.some((schedule) => schedule.dayKey === todayKey);

    if (!hasTodaySchedule) {
      repaired.schedules = buildDemoSchedules(todayKey);
      changed = true;
    } else {
      repaired.schedules = nextSchedules.map((schedule) => {
        const teacherName =
          repaired.users?.find((user) => user.uid === schedule.teacherId)?.fullName ??
          schedule.teacherName ??
          "Unknown";

        if (teacherName !== schedule.teacherName) {
          changed = true;
          return {
            ...schedule,
            teacherName
          };
        }

        return schedule;
      });
    }
  }

  if (!Array.isArray(repaired.sessionHistory)) {
    repaired.sessionHistory = [];
    changed = true;
  }

  return {
    state: repaired,
    changed
  };
}

function readDemoState() {
  const raw = localStorage.getItem(DEMO_STATE_KEY);
  if (!raw) {
    const seeded = buildDemoState();
    localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw);
    const { state, changed } = repairDemoState(parsed);

    if (changed) {
      localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
    }

    return state;
  } catch {
    const seeded = buildDemoState();
    localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeDemoState(nextState) {
  localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(nextState));
  emitDemoChange();
}

function getSessionUid() {
  return localStorage.getItem(DEMO_SESSION_KEY);
}

function setSessionUid(uid) {
  localStorage.setItem(DEMO_SESSION_KEY, uid);
  emitDemoChange();
}

function clearSessionUid() {
  localStorage.removeItem(DEMO_SESSION_KEY);
  emitDemoChange();
}

function nowIso() {
  return new Date().toISOString();
}

function todayDayKey() {
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
    new Date().getDay()
  ];
}

function sortTeachers(teachers) {
  return [...teachers].sort((left, right) => left.fullName.localeCompare(right.fullName));
}

function sortSessions(sessions) {
  return [...sessions].sort(
    (left, right) =>
      new Date(right.endedAt ?? right.startedAt) - new Date(left.endedAt ?? left.startedAt)
  );
}

function withTeacherScheduleCount(teachers, schedules) {
  return teachers.map((teacher) => ({
    ...teacher,
    scheduleCount: schedules.filter((schedule) => schedule.teacherId === teacher.uid).length
  }));
}

function buildAccessibleSessions(state) {
  return sortSessions([
    ...state.sessionHistory,
    ...(state.activeSession ? [state.activeSession] : [])
  ]).map((session) => decorateSession(session));
}

function buildTodaySchedule(state) {
  return state.schedules.filter((schedule) => schedule.dayKey === todayDayKey());
}

function buildOverview(profile, state, visibleSessions, allTeachers, todaySchedule) {
  const activeSession = state.activeSession ? decorateSession(state.activeSession) : null;
  const completedSessions = visibleSessions.filter((session) => session.status !== "active");
  const alerts = buildSessionAlertList(completedSessions);
  const verifiedStarts = completedSessions.filter(
    (session) => session.verification?.method === "face-match"
  ).length + (activeSession?.verification?.method === "face-match" ? 1 : 0);
  const attendanceCompliance = todaySchedule.length
    ? Math.round((verifiedStarts / todaySchedule.length) * 100)
    : 0;
  const lowEngagementAlerts = alerts.filter((alert) => alert.type === "low-engagement").length;
  const phoneUsageAlerts = alerts.filter((alert) => alert.type === "phone-usage").length;

  return {
    schoolName: profile.schoolName,
    totalTeachers: allTeachers.length,
    todayScheduledPeriods: todaySchedule.length,
    verifiedStarts,
    attendanceCompliance,
    lowEngagementAlerts,
    phoneUsageAlerts,
    activeSessionTeacher: activeSession?.teacherName ?? "No active session"
  };
}

export function subscribeToAuthState(callback) {
  const notify = () => {
    const state = readDemoState();
    const admin = state.users.find((u) => u.role === "admin") ?? null;
    callback(admin ? clone(admin) : null);
  };

  notify();
  window.addEventListener(DEMO_EVENT, notify);
  window.addEventListener("storage", notify);

  return () => {
    window.removeEventListener(DEMO_EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

export async function fetchAppData(profile) {
  if (!profile) {
    return null;
  }

  const state = readDemoState();
  const teachers = withTeacherScheduleCount(
    sortTeachers(state.users.filter((user) => user.role === "teacher")),
    state.schedules
  );
  const visibleSessions = buildAccessibleSessions(state);
  const todaySchedule = buildTodaySchedule(state);
  const alerts = buildSessionAlertList(
    visibleSessions.filter((session) => session.status !== "active")
  );

  return {
    teachers,
    todaySchedule,
    activeSession: state.activeSession ? decorateSession(state.activeSession) : null,
    sessionHistory: visibleSessions.filter((session) => session.status !== "active"),
    alerts,
    teacherTrends: buildTeacherTrendRows(
      teachers,
      state.sessionHistory.map((session) => decorateSession(session))
    ),
    overview: buildOverview(profile, state, visibleSessions, teachers, todaySchedule),
    reportFilters: reportFilterOptions
  };
}

export async function saveTeacherRecord({ existingTeacher, payload }) {
  const normalizedStaffId = payload.staffId.trim().toUpperCase();
  const state = readDemoState();
  const duplicate = state.users.find(
    (user) =>
      user.role === "teacher" &&
      user.staffId === normalizedStaffId &&
      user.uid !== existingTeacher?.uid
  );

  if (duplicate) {
    throw new Error("Another teacher already uses that staff ID.");
  }

  const nextTeacher = {
    uid: existingTeacher?.uid ?? `teacher-${crypto.randomUUID()}`,
    role: "teacher",
    fullName: payload.fullName.trim(),
    staffId: normalizedStaffId,
    email: payload.email.trim().toLowerCase(),
    password: existingTeacher?.password ?? "password123",
    schoolName:
      existingTeacher?.schoolName ??
      payload.schoolName?.trim() ??
      "Himalaya College of Engineering",
    district: existingTeacher?.district ?? payload.district?.trim() ?? "Kaski",
    title: payload.title.trim(),
    subjectSpecialty: payload.subjectSpecialty.trim(),
    assignedGrades: payload.assignedGrades.trim(),
    phone: payload.phone.trim(),
    avatarUrl: existingTeacher?.avatarUrl ?? "",
    faceEnrollment: existingTeacher?.faceEnrollment ?? null
  };

  if (existingTeacher) {
    const index = state.users.findIndex((user) => user.uid === existingTeacher.uid);
    state.users[index] = nextTeacher;
  } else {
    state.users.push(nextTeacher);
  }

  writeDemoState(state);
  return clone(nextTeacher);
}

export async function enrollTeacherFace({ teacher, descriptor, actorProfile }) {
  const state = readDemoState();
  const index = state.users.findIndex((user) => user.uid === teacher.uid);

  if (index < 0) {
    throw new Error("Teacher record not found.");
  }

  const enrollment = {
    descriptor: Array.from(descriptor),
    enrolledAt: nowIso(),
    enrolledBy: actorProfile.fullName
  };

  state.users[index] = {
    ...state.users[index],
    faceEnrollment: enrollment
  };

  writeDemoState(state);
  return clone(state.users[index]);
}

export async function removeTeacherFace(teacher) {
  const state = readDemoState();
  const index = state.users.findIndex((user) => user.uid === teacher.uid);

  if (index < 0) {
    throw new Error("Teacher record not found.");
  }

  state.users[index] = {
    ...state.users[index],
    faceEnrollment: null
  };

  let invalidatedSession = null;
  if (state.activeSession?.teacherId === teacher.uid) {
    invalidatedSession = {
      ...state.activeSession,
      endedAt: nowIso(),
      status: "invalidated",
      invalidationReason: "Teacher face enrollment was removed during the active period."
    };
    state.sessionHistory.unshift(invalidatedSession);
    state.activeSession = null;
  }

  writeDemoState(state);
  return {
    teacher: clone(state.users[index]),
    invalidatedSession: invalidatedSession ? decorateSession(invalidatedSession) : null
  };
}

export async function startTeacherSession({
  scheduleId,
  matchedTeacher,
  actorProfile,
  audioEnabled = false,
  verification
}) {
  const state = readDemoState();
  const schedule = state.schedules.find((item) => item.id === scheduleId);

  if (!schedule) {
    throw new Error("Scheduled period could not be found.");
  }

  if (state.activeSession) {
    throw new Error("A class session is already active.");
  }

  if (!verification?.override && matchedTeacher?.uid !== schedule.teacherId) {
    throw new Error("Face match does not correspond to the scheduled teacher.");
  }

  const teacher =
    state.users.find((user) => user.uid === schedule.teacherId) ??
    state.users.find((user) => user.uid === matchedTeacher?.uid);

  if (!teacher) {
    throw new Error("Teacher record could not be found.");
  }

  const session = {
    id: `session-${crypto.randomUUID()}`,
    scheduleId: schedule.id,
    teacherId: teacher.uid,
    teacherName: teacher.fullName,
    subject: schedule.subject,
    grade: schedule.grade,
    section: schedule.section,
    room: schedule.room,
    periodLabel: schedule.periodLabel,
    audioEnabled,
    startedAt: nowIso(),
    status: "active",
    startedBy: actorProfile.fullName,
    screenshots: [],
    visionAnalysis: null,
    verification: {
      method: verification?.override ? "admin-override" : "face-match",
      matched: Boolean(matchedTeacher),
      confidence: verification?.confidence ?? 0,
      override: Boolean(verification?.override),
      overrideReason: verification?.overrideReason ?? "",
      timestamp: nowIso()
    },
    timeline: [
      {
        id: `window-${crypto.randomUUID()}`,
        startTime: nowIso(),
        endTime: new Date(Date.now() + 30 * 1000).toISOString(),
        teacherVisible: true,
        dominantActivity: "Teacher verified and class session started",
        zone: "front_zone",
        movementLevel: "low",
        possiblePhoneUsage: false,
        speakingActivityFlag: false,
        confidence: verification?.confidence ?? 0.88,
        observedSignals: {
          facing: "students",
          nearBoard: false,
          nearProjector: false,
          seated: false,
          activeTeaching: false,
          prolongedInactivity: false
        }
      }
    ]
  };

  state.activeSession = session;
  writeDemoState(state);
  return decorateSession(session);
}

export async function addObservationWindow({ sessionId, windowData }) {
  const state = readDemoState();

  if (state.activeSession?.id !== sessionId) {
    throw new Error("The active class session could not be found.");
  }

  const nextWindow = windowData
    ? {
        id: windowData.id ?? `window-${crypto.randomUUID()}`,
        ...windowData
      }
    : appendGeneratedObservation(state.activeSession);

  state.activeSession = {
    ...state.activeSession,
    timeline: [...state.activeSession.timeline, nextWindow]
  };

  writeDemoState(state);
  return decorateSession(state.activeSession);
}

export async function addSessionScreenshot({ sessionId, screenshot }) {
  const state = readDemoState();

  if (state.activeSession?.id !== sessionId) {
    throw new Error("The active class session could not be found.");
  }

  const nextScreenshot = {
    id: screenshot?.id ?? `shot-${crypto.randomUUID()}`,
    capturedAt: screenshot?.capturedAt ?? nowIso(),
    imageUrl: screenshot?.imageUrl ?? ""
  };

  state.activeSession = {
    ...state.activeSession,
    screenshots: [...(state.activeSession.screenshots ?? []), nextScreenshot]
  };

  writeDemoState(state);
  return decorateSession(state.activeSession);
}

export async function endTeacherSession({ sessionId, actorProfile, visionAnalysis = null }) {
  const state = readDemoState();

  if (state.activeSession?.id !== sessionId) {
    throw new Error("The active class session could not be found.");
  }

  const archivedScreenshots = (state.activeSession.screenshots ?? []).map((screenshot) => ({
    id: screenshot.id,
    capturedAt: screenshot.capturedAt
  }));
  const completedSession = {
    ...state.activeSession,
    endedAt: nowIso(),
    endedBy: actorProfile.fullName,
    status: "completed",
    visionAnalysis,
    screenshots: archivedScreenshots,
    screenshotCount: archivedScreenshots.length
  };

  state.sessionHistory.unshift(completedSession);
  state.activeSession = null;
  writeDemoState(state);
  return decorateSession(completedSession);
}

export async function updateUserProfile(profile, updates) {
  const state = readDemoState();
  const index = state.users.findIndex((user) => user.uid === profile.uid);

  if (index < 0) {
    return clone(profile);
  }

  state.users[index] = {
    ...state.users[index],
    fullName: updates.fullName?.trim() || state.users[index].fullName,
    email: updates.email?.trim().toLowerCase() || state.users[index].email,
    phone: updates.phone?.trim() || state.users[index].phone
  };
  writeDemoState(state);
  return clone(state.users[index]);
}
