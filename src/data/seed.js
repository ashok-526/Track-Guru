function isoAt(dayOffset, hours, minutes = 0) {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + dayOffset);
  nextDate.setHours(hours, minutes, 0, 0);
  return nextDate.toISOString();
}

function currentDayKey() {
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
    new Date().getDay()
  ];
}

function windowItem({
  startTime,
  endTime,
  dominantActivity,
  zone,
  movementLevel,
  teacherVisible,
  possiblePhoneUsage = false,
  speakingActivityFlag = false,
  confidence = 0.86,
  facing = "students",
  nearBoard = false,
  nearProjector = false,
  seated = false,
  activeTeaching = false,
  prolongedInactivity = false
}) {
  return {
    id: `window-${crypto.randomUUID()}`,
    startTime,
    endTime,
    teacherVisible,
    dominantActivity,
    zone,
    movementLevel,
    possiblePhoneUsage,
    speakingActivityFlag,
    confidence,
    observedSignals: {
      facing,
      nearBoard,
      nearProjector,
      seated,
      activeTeaching,
      prolongedInactivity
    }
  };
}

const schoolName = "Himalaya College of Engineering";
const district = "Kaski";

export const demoUsers = [
  {
    uid: "admin-001",
    role: "admin",
    fullName: "Mina Adhikari",
    staffId: "NGA-ADM-001",
    email: "mina.adhikari@janata.edu.np",
    password: "password123",
    schoolName,
    district,
    title: "School Administrator",
    avatarUrl: ""
  },
  {
    uid: "teacher-001",
    role: "teacher",
    fullName: "Sita Rana",
    staffId: "TCH-001",
    email: "sita.rana@janata.edu.np",
    password: "password123",
    schoolName,
    district,
    title: "Science Teacher",
    subjectSpecialty: "Science",
    assignedGrades: "Grade 7, Grade 8",
    phone: "9841000001",
    avatarUrl: "",
    faceEnrollment: null
  },
  {
    uid: "teacher-002",
    role: "teacher",
    fullName: "Hari Khadka",
    staffId: "TCH-002",
    email: "hari.khadka@janata.edu.np",
    password: "password123",
    schoolName,
    district,
    title: "Mathematics Teacher",
    subjectSpecialty: "Mathematics",
    assignedGrades: "Grade 8, Grade 9",
    phone: "9841000002",
    avatarUrl: "",
    faceEnrollment: null
  },
  {
    uid: "teacher-003",
    role: "teacher",
    fullName: "Laxmi BK",
    staffId: "TCH-003",
    email: "laxmi.bk@janata.edu.np",
    password: "password123",
    schoolName,
    district,
    title: "English Teacher",
    subjectSpecialty: "English",
    assignedGrades: "Grade 6, Grade 7",
    phone: "9841000003",
    avatarUrl: "",
    faceEnrollment: null
  }
];

export const scheduleTemplates = [
  {
    id: "schedule-1",
    teacherId: "teacher-001",
    subject: "Science",
    grade: "Grade 7",
    section: "A",
    room: "Room 5",
    periodLabel: "Period 1",
    startClock: "10:00",
    endClock: "10:45"
  },
  {
    id: "schedule-2",
    teacherId: "teacher-002",
    subject: "Mathematics",
    grade: "Grade 8",
    section: "B",
    room: "Room 9",
    periodLabel: "Period 2",
    startClock: "10:50",
    endClock: "11:35"
  },
  {
    id: "schedule-3",
    teacherId: "teacher-003",
    subject: "English",
    grade: "Grade 6",
    section: "A",
    room: "Room 2",
    periodLabel: "Period 3",
    startClock: "11:40",
    endClock: "12:25"
  },
  {
    id: "schedule-4",
    teacherId: "teacher-001",
    subject: "Science",
    grade: "Grade 8",
    section: "A",
    room: "Lab 1",
    periodLabel: "Period 5",
    startClock: "13:15",
    endClock: "14:00"
  }
];

export function buildDemoSchedules(dayKey = currentDayKey()) {
  return scheduleTemplates.map((schedule) => ({
    ...schedule,
    dayKey,
    teacherName:
      demoUsers.find((user) => user.uid === schedule.teacherId)?.fullName ?? "Unknown"
  }));
}

export const demoSchedules = buildDemoSchedules();

const sessionOneTimeline = [
  windowItem({
    startTime: isoAt(-1, 10, 0),
    endTime: isoAt(-1, 10, 3),
    dominantActivity: "Teacher entered class and session started",
    zone: "front_zone",
    movementLevel: "medium",
    teacherVisible: true,
    speakingActivityFlag: false,
    facing: "students",
    activeTeaching: false
  }),
  windowItem({
    startTime: isoAt(-1, 10, 3),
    endTime: isoAt(-1, 10, 15),
    dominantActivity: "Explaining to students",
    zone: "student_zone",
    movementLevel: "medium",
    teacherVisible: true,
    speakingActivityFlag: true,
    activeTeaching: true,
    confidence: 0.93
  }),
  windowItem({
    startTime: isoAt(-1, 10, 15),
    endTime: isoAt(-1, 10, 22),
    dominantActivity: "Writing on board and explaining",
    zone: "board_zone",
    movementLevel: "low",
    teacherVisible: true,
    speakingActivityFlag: true,
    facing: "board",
    nearBoard: true,
    activeTeaching: true,
    confidence: 0.91
  }),
  windowItem({
    startTime: isoAt(-1, 10, 22),
    endTime: isoAt(-1, 10, 25),
    dominantActivity: "Seated and inactive",
    zone: "teacher_desk",
    movementLevel: "low",
    teacherVisible: true,
    seated: true,
    prolongedInactivity: true,
    confidence: 0.86
  }),
  windowItem({
    startTime: isoAt(-1, 10, 25),
    endTime: isoAt(-1, 10, 27),
    dominantActivity: "Possible phone usage",
    zone: "teacher_desk",
    movementLevel: "low",
    teacherVisible: true,
    seated: true,
    possiblePhoneUsage: true,
    prolongedInactivity: true,
    confidence: 0.77
  }),
  windowItem({
    startTime: isoAt(-1, 10, 27),
    endTime: isoAt(-1, 10, 40),
    dominantActivity: "Teaching resumed near board",
    zone: "board_zone",
    movementLevel: "medium",
    teacherVisible: true,
    speakingActivityFlag: true,
    facing: "board",
    nearBoard: true,
    activeTeaching: true,
    confidence: 0.9
  })
];

const sessionTwoTimeline = [
  windowItem({
    startTime: isoAt(-2, 11, 0),
    endTime: isoAt(-2, 11, 8),
    dominantActivity: "Explaining to students",
    zone: "student_zone",
    movementLevel: "medium",
    teacherVisible: true,
    speakingActivityFlag: true,
    activeTeaching: true,
    confidence: 0.9
  }),
  windowItem({
    startTime: isoAt(-2, 11, 8),
    endTime: isoAt(-2, 11, 16),
    dominantActivity: "Standing stationary",
    zone: "front_zone",
    movementLevel: "low",
    teacherVisible: true,
    prolongedInactivity: true,
    confidence: 0.8
  }),
  windowItem({
    startTime: isoAt(-2, 11, 16),
    endTime: isoAt(-2, 11, 20),
    dominantActivity: "Teacher absent from frame",
    zone: "off_frame",
    movementLevel: "unknown",
    teacherVisible: false,
    prolongedInactivity: true,
    facing: "unknown",
    confidence: 0.95
  }),
  windowItem({
    startTime: isoAt(-2, 11, 20),
    endTime: isoAt(-2, 11, 28),
    dominantActivity: "Possible phone usage",
    zone: "teacher_desk",
    movementLevel: "low",
    teacherVisible: true,
    seated: true,
    possiblePhoneUsage: true,
    prolongedInactivity: true,
    confidence: 0.76
  }),
  windowItem({
    startTime: isoAt(-2, 11, 28),
    endTime: isoAt(-2, 11, 35),
    dominantActivity: "Writing on board and explaining",
    zone: "board_zone",
    movementLevel: "low",
    teacherVisible: true,
    speakingActivityFlag: true,
    facing: "board",
    nearBoard: true,
    activeTeaching: true,
    confidence: 0.89
  })
];

const sessionThreeTimeline = [
  windowItem({
    startTime: isoAt(-3, 9, 45),
    endTime: isoAt(-3, 9, 55),
    dominantActivity: "Explaining to students",
    zone: "student_zone",
    movementLevel: "medium",
    teacherVisible: true,
    speakingActivityFlag: true,
    activeTeaching: true,
    confidence: 0.92
  }),
  windowItem({
    startTime: isoAt(-3, 9, 55),
    endTime: isoAt(-3, 10, 5),
    dominantActivity: "Walking between rows",
    zone: "student_zone",
    movementLevel: "high",
    teacherVisible: true,
    speakingActivityFlag: true,
    activeTeaching: true,
    confidence: 0.85
  }),
  windowItem({
    startTime: isoAt(-3, 10, 5),
    endTime: isoAt(-3, 10, 12),
    dominantActivity: "Teaching near projector",
    zone: "projector_zone",
    movementLevel: "low",
    teacherVisible: true,
    speakingActivityFlag: true,
    nearProjector: true,
    activeTeaching: true,
    confidence: 0.82
  }),
  windowItem({
    startTime: isoAt(-3, 10, 12),
    endTime: isoAt(-3, 10, 18),
    dominantActivity: "Writing on board and explaining",
    zone: "board_zone",
    movementLevel: "low",
    teacherVisible: true,
    speakingActivityFlag: true,
    facing: "board",
    nearBoard: true,
    activeTeaching: true,
    confidence: 0.9
  })
];

export const demoSessionHistory = [
  {
    id: "session-history-001",
    scheduleId: "schedule-1",
    teacherId: "teacher-001",
    teacherName: "Sita Rana",
    subject: "Science",
    grade: "Grade 7",
    section: "A",
    room: "Room 5",
    periodLabel: "Period 1",
    audioEnabled: true,
    startedAt: isoAt(-1, 10, 0),
    endedAt: isoAt(-1, 10, 40),
    status: "completed",
    verification: {
      method: "face-match",
      matched: true,
      confidence: 0.94,
      timestamp: isoAt(-1, 10, 0)
    },
    timeline: sessionOneTimeline
  },
  {
    id: "session-history-002",
    scheduleId: "schedule-2",
    teacherId: "teacher-002",
    teacherName: "Hari Khadka",
    subject: "Mathematics",
    grade: "Grade 8",
    section: "B",
    room: "Room 9",
    periodLabel: "Period 2",
    audioEnabled: false,
    startedAt: isoAt(-2, 11, 0),
    endedAt: isoAt(-2, 11, 35),
    status: "completed",
    verification: {
      method: "face-match",
      matched: true,
      confidence: 0.89,
      timestamp: isoAt(-2, 11, 0)
    },
    timeline: sessionTwoTimeline
  },
  {
    id: "session-history-003",
    scheduleId: "schedule-3",
    teacherId: "teacher-003",
    teacherName: "Laxmi BK",
    subject: "English",
    grade: "Grade 6",
    section: "A",
    room: "Room 2",
    periodLabel: "Period 3",
    audioEnabled: true,
    startedAt: isoAt(-3, 9, 45),
    endedAt: isoAt(-3, 10, 18),
    status: "completed",
    verification: {
      method: "face-match",
      matched: true,
      confidence: 0.91,
      timestamp: isoAt(-3, 9, 45)
    },
    timeline: sessionThreeTimeline
  }
];

export const reportFilterOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" }
];

export function buildDemoState() {
  return {
    users: demoUsers,
    schedules: demoSchedules,
    activeSession: null,
    sessionHistory: demoSessionHistory
  };
}
