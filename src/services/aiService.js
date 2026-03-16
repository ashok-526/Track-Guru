const OBSERVATION_WINDOW_SECONDS = 30;
export const LIVE_MONITOR_SAMPLE_SECONDS = 10;
export const LIVE_MONITOR_UPDATE_SECONDS = 30;

const ACTIVITY_LIBRARY = [
  {
    key: "explaining_to_students",
    dominantActivity: "Explaining to students",
    zone: "student_zone",
    movementLevel: "medium",
    teacherVisible: true,
    activeTeaching: true,
    seated: false,
    phoneUsage: false,
    facing: "students",
    nearBoard: false,
    nearProjector: false,
    inactivity: false,
    speechProbability: 0.85,
    confidence: 0.92,
    weight: 28
  },
  {
    key: "writing_and_explaining",
    dominantActivity: "Writing on board and explaining",
    zone: "board_zone",
    movementLevel: "low",
    teacherVisible: true,
    activeTeaching: true,
    seated: false,
    phoneUsage: false,
    facing: "board",
    nearBoard: true,
    nearProjector: false,
    inactivity: false,
    speechProbability: 0.72,
    confidence: 0.9,
    weight: 22
  },
  {
    key: "walking_rows",
    dominantActivity: "Walking between rows",
    zone: "student_zone",
    movementLevel: "high",
    teacherVisible: true,
    activeTeaching: true,
    seated: false,
    phoneUsage: false,
    facing: "students",
    nearBoard: false,
    nearProjector: false,
    inactivity: false,
    speechProbability: 0.58,
    confidence: 0.84,
    weight: 14
  },
  {
    key: "near_projector",
    dominantActivity: "Teaching near projector",
    zone: "projector_zone",
    movementLevel: "low",
    teacherVisible: true,
    activeTeaching: true,
    seated: false,
    phoneUsage: false,
    facing: "students",
    nearBoard: false,
    nearProjector: true,
    inactivity: false,
    speechProbability: 0.67,
    confidence: 0.83,
    weight: 10
  },
  {
    key: "stationary_front",
    dominantActivity: "Standing stationary",
    zone: "front_zone",
    movementLevel: "low",
    teacherVisible: true,
    activeTeaching: false,
    seated: false,
    phoneUsage: false,
    facing: "students",
    nearBoard: false,
    nearProjector: false,
    inactivity: true,
    speechProbability: 0.24,
    confidence: 0.78,
    weight: 9
  },
  {
    key: "seated_idle",
    dominantActivity: "Seated and inactive",
    zone: "teacher_desk",
    movementLevel: "low",
    teacherVisible: true,
    activeTeaching: false,
    seated: true,
    phoneUsage: false,
    facing: "students",
    nearBoard: false,
    nearProjector: false,
    inactivity: true,
    speechProbability: 0.08,
    confidence: 0.88,
    weight: 8
  },
  {
    key: "possible_phone_usage",
    dominantActivity: "Possible phone usage",
    zone: "teacher_desk",
    movementLevel: "low",
    teacherVisible: true,
    activeTeaching: false,
    seated: true,
    phoneUsage: true,
    facing: "device",
    nearBoard: false,
    nearProjector: false,
    inactivity: true,
    speechProbability: 0.03,
    confidence: 0.76,
    weight: 5
  },
  {
    key: "off_frame",
    dominantActivity: "Teacher absent from frame",
    zone: "off_frame",
    movementLevel: "unknown",
    teacherVisible: false,
    activeTeaching: false,
    seated: false,
    phoneUsage: false,
    facing: "unknown",
    nearBoard: false,
    nearProjector: false,
    inactivity: true,
    speechProbability: 0,
    confidence: 0.94,
    weight: 4
  }
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value, decimals = 1) {
  return Number(value.toFixed(decimals));
}

function weightedPick(seed, items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let cursor = seed * total;

  for (const item of items) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

function hashString(value) {
  return Array.from(value).reduce((hash, character) => {
    return (hash * 31 + character.charCodeAt(0)) % 2147483647;
  }, 7);
}

function toIsoWithClock(baseDate, clock) {
  const [hours, minutes] = clock.split(":").map(Number);
  const nextDate = new Date(baseDate);
  nextDate.setHours(hours, minutes, 0, 0);
  return nextDate.toISOString();
}

function durationMsBetween(startTime, endTime) {
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  return Math.max(endMs - startMs, 1000);
}

function durationMinutesBetween(startTime, endTime) {
  return durationMsBetween(startTime, endTime) / 60000;
}

function averageDurationMinutes(windows, predicate) {
  const minutes = windows
    .filter(predicate)
    .reduce((sum, windowItem) => sum + durationMinutesBetween(windowItem.startTime, windowItem.endTime), 0);
  return roundTo(minutes, 1);
}

function averagePoint(points) {
  if (!points?.length) {
    return null;
  }

  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length
  };
}

function dominantValue(items, fallback = "unknown") {
  if (!items.length) {
    return fallback;
  }

  const counts = new Map();
  items.forEach((item) => {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  });

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0];
}

function movementRank(level) {
  if (level === "high") {
    return 3;
  }

  if (level === "medium") {
    return 2;
  }

  if (level === "low") {
    return 1;
  }

  return 0;
}

function inferZone(centerX, centerY) {
  if (centerY > 0.72) {
    return "teacher_desk";
  }

  if (centerX < 0.3) {
    return "board_zone";
  }

  if (centerX > 0.78) {
    return "projector_zone";
  }

  if (centerY > 0.56) {
    return "student_zone";
  }

  return "front_zone";
}

function inferFacing(landmarks, zone) {
  if (!landmarks?.leftEye || !landmarks?.rightEye || !landmarks?.nose) {
    if (zone === "board_zone") {
      return "board";
    }

    if (zone === "projector_zone") {
      return "projector";
    }

    return "students";
  }

  const eyeCenterX = (landmarks.leftEye.x + landmarks.rightEye.x) / 2;
  const eyeCenterY = (landmarks.leftEye.y + landmarks.rightEye.y) / 2;
  const eyeDistance = Math.max(Math.abs(landmarks.rightEye.x - landmarks.leftEye.x), 8);
  const yaw = (landmarks.nose.x - eyeCenterX) / eyeDistance;
  const headDown =
    landmarks.mouth &&
    (landmarks.nose.y - eyeCenterY) / Math.max(landmarks.mouth.y - eyeCenterY, 1) > 0.58;

  if (headDown) {
    return "device";
  }

  if (Math.abs(yaw) < 0.12) {
    return "students";
  }

  if (zone === "board_zone") {
    return "board";
  }

  if (zone === "projector_zone") {
    return "projector";
  }

  return yaw < 0 ? "left" : "right";
}

function inferMovement(boxMetrics, previousSample) {
  if (!previousSample?.teacherVisible || !previousSample.metrics) {
    return { movementLevel: "low", movementScore: 0 };
  }

  const delta = Math.hypot(
    boxMetrics.centerX - previousSample.metrics.centerX,
    boxMetrics.centerY - previousSample.metrics.centerY
  );

  if (delta > 0.18) {
    return { movementLevel: "high", movementScore: roundTo(delta, 3) };
  }

  if (delta > 0.07) {
    return { movementLevel: "medium", movementScore: roundTo(delta, 3) };
  }

  return { movementLevel: "low", movementScore: roundTo(delta, 3) };
}

function summaryTextFromAnalytics({
  teacherVisible,
  activeTeachingPercent,
  inactivityPercent,
  seatedPercent,
  phoneUsagePercent,
  zone,
  movementLevel,
  dominantActivity
}) {
  if (!teacherVisible) {
    return "Teacher was mostly absent from frame during this 30-second update.";
  }

  if (phoneUsagePercent >= 25) {
    return "Teacher stayed near the desk with possible phone usage for part of this update.";
  }

  if (zone === "board_zone" && activeTeachingPercent >= 45) {
    return "Teacher spent most of this update writing on the board and explaining.";
  }

  if (zone === "projector_zone" && activeTeachingPercent >= 45) {
    return "Teacher taught from the projector side of the room during this update.";
  }

  if (movementLevel === "high" && activeTeachingPercent >= 35) {
    return "Teacher moved across the classroom and interacted actively during this update.";
  }

  if (seatedPercent >= 45 && inactivityPercent >= 45) {
    return "Teacher remained seated with low classroom activity during most of this update.";
  }

  if (dominantActivity === "Standing stationary") {
    return "Teacher stayed visible at the front with limited movement during this update.";
  }

  return "Teacher mainly explained while facing the class during this update.";
}

function aggregateMovementLevel(samples) {
  if (!samples.length) {
    return "unknown";
  }

  const highestRank = Math.max(...samples.map((sample) => movementRank(sample.movementLevel)));

  if (highestRank >= 3) {
    return "high";
  }

  if (highestRank >= 2) {
    return "medium";
  }

  return "low";
}

function blankObservedSignals() {
  return {
    facing: "unknown",
    nearBoard: false,
    nearProjector: false,
    seated: false,
    activeTeaching: false,
    prolongedInactivity: true
  };
}

export function buildObservationWindow({
  seedValue,
  startTime,
  endTime,
  audioEnabled
}) {
  const selected = weightedPick(seedValue, ACTIVITY_LIBRARY);
  const speakingActivityFlag = audioEnabled
    ? seedValue < selected.speechProbability
    : false;
  const confidence = clamp(
    selected.confidence - (audioEnabled ? 0 : 0.04) + (speakingActivityFlag ? 0.03 : 0),
    0.52,
    0.98
  );

  return {
    id: `window-${crypto.randomUUID()}`,
    startTime,
    endTime,
    teacherVisible: selected.teacherVisible,
    dominantActivity: selected.dominantActivity,
    zone: selected.zone,
    movementLevel: selected.movementLevel,
    possiblePhoneUsage: selected.phoneUsage,
    speakingActivityFlag,
    confidence: Number(confidence.toFixed(2)),
    observedSignals: {
      facing: selected.facing,
      nearBoard: selected.nearBoard,
      nearProjector: selected.nearProjector,
      seated: selected.seated,
      activeTeaching: selected.activeTeaching,
      prolongedInactivity: selected.inactivity
    }
  };
}

export function appendGeneratedObservation(session) {
  const previousWindows = session.timeline ?? [];
  const nextIndex = previousWindows.length;
  const sessionAnchor = new Date(session.startedAt);
  const startTime = new Date(sessionAnchor.getTime() + nextIndex * OBSERVATION_WINDOW_SECONDS * 1000);
  const endTime = new Date(startTime.getTime() + OBSERVATION_WINDOW_SECONDS * 1000);
  const seedSource = `${session.id}:${session.teacherId}:${nextIndex}:${session.audioEnabled}`;
  const seedValue = (hashString(seedSource) % 1000) / 1000;

  return buildObservationWindow({
    seedValue,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    audioEnabled: session.audioEnabled
  });
}

export function buildLiveMonitorSample({
  sampledAt,
  frameWidth,
  frameHeight,
  box,
  landmarks,
  similarity = 0,
  previousSample = null,
  audioLevel = 0,
  audioEnabled = false
}) {
  if (!box || !frameWidth || !frameHeight) {
    return {
      id: `sample-${crypto.randomUUID()}`,
      sampledAt,
      teacherVisible: false,
      dominantActivity: "Teacher absent from frame",
      zone: "off_frame",
      movementLevel: "unknown",
      possiblePhoneUsage: false,
      speakingActivityFlag: false,
      confidence: 0.84,
      observedSignals: blankObservedSignals(),
      metrics: {
        similarity: 0,
        centerX: 0,
        centerY: 0,
        areaRatio: 0,
        movementScore: 0,
        audioLevel: roundTo(audioLevel, 3)
      }
    };
  }

  const boxMetrics = {
    centerX: (box.x + box.width / 2) / frameWidth,
    centerY: (box.y + box.height / 2) / frameHeight,
    areaRatio: (box.width * box.height) / (frameWidth * frameHeight),
    heightRatio: box.height / frameHeight
  };

  const zone = inferZone(boxMetrics.centerX, boxMetrics.centerY);
  const facing = inferFacing(landmarks, zone);
  const { movementLevel, movementScore } = inferMovement(boxMetrics, previousSample);
  const speakingActivityFlag = audioEnabled ? audioLevel >= 0.08 : false;
  const seated = boxMetrics.centerY > 0.66 && boxMetrics.heightRatio < 0.34;
  const nearBoard = zone === "board_zone";
  const nearProjector = zone === "projector_zone";
  const possiblePhoneUsage =
    seated && movementLevel === "low" && facing === "device" && !speakingActivityFlag;
  const activeTeaching =
    !possiblePhoneUsage &&
    (
      nearBoard ||
      nearProjector ||
      speakingActivityFlag ||
      movementLevel !== "low" ||
      (!seated && facing === "students")
    );
  const prolongedInactivity = !activeTeaching && (movementLevel === "low" || seated);

  let dominantActivity = "Standing stationary";
  if (possiblePhoneUsage) {
    dominantActivity = "Possible phone usage";
  } else if (seated && prolongedInactivity) {
    dominantActivity = "Seated and inactive";
  } else if (nearBoard && (speakingActivityFlag || facing === "board")) {
    dominantActivity = "Writing on board and explaining";
  } else if (nearProjector && activeTeaching) {
    dominantActivity = "Teaching near projector";
  } else if (movementLevel === "high" || (zone === "student_zone" && movementLevel !== "low")) {
    dominantActivity = "Walking between rows";
  } else if (activeTeaching) {
    dominantActivity = "Explaining to students";
  }

  return {
    id: `sample-${crypto.randomUUID()}`,
    sampledAt,
    teacherVisible: true,
    dominantActivity,
    zone,
    movementLevel,
    possiblePhoneUsage,
    speakingActivityFlag,
    confidence: roundTo(
      clamp(0.56 + similarity * 0.28 + (speakingActivityFlag ? 0.05 : 0) + (movementScore > 0.07 ? 0.04 : 0), 0.52, 0.98),
      2
    ),
    observedSignals: {
      facing,
      nearBoard,
      nearProjector,
      seated,
      activeTeaching,
      prolongedInactivity
    },
    metrics: {
      similarity: roundTo(similarity, 2),
      centerX: roundTo(boxMetrics.centerX, 3),
      centerY: roundTo(boxMetrics.centerY, 3),
      areaRatio: roundTo(boxMetrics.areaRatio, 3),
      movementScore,
      audioLevel: roundTo(audioLevel, 3)
    }
  };
}

export function buildObservationWindowFromSamples({
  samples,
  startTime,
  endTime
}) {
  const usableSamples = samples.filter(Boolean);

  if (!usableSamples.length) {
    return {
      id: `window-${crypto.randomUUID()}`,
      startTime,
      endTime,
      teacherVisible: false,
      dominantActivity: "Teacher absent from frame",
      zone: "off_frame",
      movementLevel: "unknown",
      possiblePhoneUsage: false,
      speakingActivityFlag: false,
      confidence: 0.58,
      observedSignals: blankObservedSignals(),
      analytics: {
        sampleCount: 0,
        visiblePercent: 0,
        activeTeachingPercent: 0,
        inactivityPercent: 100,
        seatedPercent: 0,
        phoneUsagePercent: 0,
        speakingPercent: 0,
        summaryText: "No usable classroom samples were captured in this update."
      }
    };
  }

  const visibleSamples = usableSamples.filter((sample) => sample.teacherVisible);
  const teacherVisible = visibleSamples.length / usableSamples.length >= 0.35;
  const activeTeachingPercent = Math.round(
    (usableSamples.filter((sample) => sample.observedSignals.activeTeaching).length /
      usableSamples.length) *
      100
  );
  const inactivityPercent = Math.round(
    (usableSamples.filter((sample) => sample.observedSignals.prolongedInactivity).length /
      usableSamples.length) *
      100
  );
  const seatedPercent = Math.round(
    (usableSamples.filter((sample) => sample.observedSignals.seated).length / usableSamples.length) *
      100
  );
  const phoneUsagePercent = Math.round(
    (usableSamples.filter((sample) => sample.possiblePhoneUsage).length / usableSamples.length) * 100
  );
  const speakingPercent = Math.round(
    (usableSamples.filter((sample) => sample.speakingActivityFlag).length / usableSamples.length) * 100
  );
  const visiblePercent = Math.round((visibleSamples.length / usableSamples.length) * 100);
  const movementLevel = aggregateMovementLevel(visibleSamples);
  const zone = teacherVisible
    ? dominantValue(visibleSamples.map((sample) => sample.zone), "front_zone")
    : "off_frame";
  const dominantActivity = teacherVisible
    ? dominantValue(visibleSamples.map((sample) => sample.dominantActivity), "Standing stationary")
    : "Teacher absent from frame";
  const summaryText = summaryTextFromAnalytics({
    teacherVisible,
    activeTeachingPercent,
    inactivityPercent,
    seatedPercent,
    phoneUsagePercent,
    zone,
    movementLevel,
    dominantActivity
  });

  return {
    id: `window-${crypto.randomUUID()}`,
    startTime,
    endTime,
    teacherVisible,
    dominantActivity,
    zone,
    movementLevel,
    possiblePhoneUsage: phoneUsagePercent >= 25,
    speakingActivityFlag: speakingPercent >= 25,
    confidence: roundTo(
      usableSamples.reduce((sum, sample) => sum + sample.confidence, 0) / usableSamples.length,
      2
    ),
    observedSignals: {
      facing: teacherVisible
        ? dominantValue(visibleSamples.map((sample) => sample.observedSignals.facing), "students")
        : "unknown",
      nearBoard:
        visibleSamples.filter((sample) => sample.observedSignals.nearBoard).length /
          Math.max(visibleSamples.length, 1) >=
        0.3,
      nearProjector:
        visibleSamples.filter((sample) => sample.observedSignals.nearProjector).length /
          Math.max(visibleSamples.length, 1) >=
        0.3,
      seated: seatedPercent >= 45,
      activeTeaching: activeTeachingPercent >= 35,
      prolongedInactivity: inactivityPercent >= 45
    },
    analytics: {
      sampleCount: usableSamples.length,
      visiblePercent,
      activeTeachingPercent,
      inactivityPercent,
      seatedPercent,
      phoneUsagePercent,
      speakingPercent,
      averageSimilarity: roundTo(
        visibleSamples.reduce((sum, sample) => sum + (sample.metrics?.similarity ?? 0), 0) /
          Math.max(visibleSamples.length, 1),
        2
      ),
      summaryText
    }
  };
}

function mergeMajorEvents(windows) {
  if (!windows.length) {
    return [];
  }

  const groups = [];

  windows.forEach((windowItem) => {
    const lastGroup = groups[groups.length - 1];
    if (
      lastGroup &&
      lastGroup.dominantActivity === windowItem.dominantActivity &&
      lastGroup.phoneUsageFlag === windowItem.possiblePhoneUsage &&
      lastGroup.teacherVisible === windowItem.teacherVisible
    ) {
      lastGroup.endTime = windowItem.endTime;
      lastGroup.durationMs += durationMsBetween(windowItem.startTime, windowItem.endTime);
      return;
    }

    groups.push({
      dominantActivity: windowItem.dominantActivity,
      phoneUsageFlag: windowItem.possiblePhoneUsage,
      teacherVisible: windowItem.teacherVisible,
      startTime: windowItem.startTime,
      endTime: windowItem.endTime,
      durationMs: durationMsBetween(windowItem.startTime, windowItem.endTime)
    });
  });

  return groups.map((group) => ({
    startTime: group.startTime,
    endTime: group.endTime,
    statement: `${group.dominantActivity}${group.phoneUsageFlag ? " with possible phone usage" : ""}`
  }));
}

export function calculateSessionSummary(session) {
  const windows = session.timeline ?? [];
  const totalDurationMinutes = roundTo(
    windows.reduce(
      (sum, windowItem) => sum + durationMinutesBetween(windowItem.startTime, windowItem.endTime),
      0
    ),
    1
  );
  const visibleMinutes = averageDurationMinutes(windows, (windowItem) => windowItem.teacherVisible);
  const activeTeachingMinutes = averageDurationMinutes(
    windows,
    (windowItem) => windowItem.observedSignals.activeTeaching
  );
  const inactiveMinutes = averageDurationMinutes(
    windows,
    (windowItem) => windowItem.observedSignals.prolongedInactivity
  );
  const seatedMinutes = averageDurationMinutes(
    windows,
    (windowItem) => windowItem.observedSignals.seated
  );
  const walkingMinutes = averageDurationMinutes(
    windows,
    (windowItem) => windowItem.movementLevel === "high"
  );
  const phoneUsageMinutes = averageDurationMinutes(
    windows,
    (windowItem) => windowItem.possiblePhoneUsage
  );
  const absentMinutes = averageDurationMinutes(
    windows,
    (windowItem) => !windowItem.teacherVisible
  );
  const majorEvents = mergeMajorEvents(windows);

  return {
    totalDurationMinutes,
    visibleMinutes,
    activeTeachingMinutes,
    inactiveMinutes,
    seatedMinutes,
    walkingMinutes,
    phoneUsageMinutes,
    absentMinutes,
    majorEvents,
    narrative: windows.length
      ? `Teacher activity analytics captured ${windows.length} classroom updates for ${session.subject} in ${session.room}.`
      : "No classroom observations were captured for this session."
  };
}

export function calculateEngagementDescription(session) {
  const summary = calculateSessionSummary(session);
  const total = Math.max(summary.totalDurationMinutes, 0.5);
  const activePct = (summary.activeTeachingMinutes / total) * 100;
  const visiblePct = (summary.visibleMinutes / total) * 100;
  const inactivePct = (summary.inactiveMinutes / total) * 100;
  const phonePct = (summary.phoneUsageMinutes / total) * 100;
  const absentPct = (summary.absentMinutes / total) * 100;
  const seatedPct = (summary.seatedMinutes / total) * 100;

  const score = clamp(
    Math.round(
      activePct * 0.45 +
        visiblePct * 0.2 +
        Math.min(summary.walkingMinutes * 2.4, 14) -
        inactivePct * 0.28 -
        phonePct * 0.55 -
        absentPct * 0.35 -
        seatedPct * 0.12
    ),
    12,
    96
  );

  let label = "Stable Classroom Activity";
  if (score >= 82) {
    label = "High Classroom Activity";
  } else if (score < 58) {
    label = "Review Required";
  } else if (score < 72) {
    label = "Moderate Classroom Activity";
  }

  const reasons = [];
  reasons.push(`${Math.round(activePct)}% of observed time was marked as active teaching.`);
  reasons.push(`${Math.round(visiblePct)}% of the period kept the teacher visible in frame.`);

  if (summary.phoneUsageMinutes > 0) {
    reasons.push(`Possible phone usage appeared for ${summary.phoneUsageMinutes} minutes.`);
  }
  if (summary.absentMinutes > 0) {
    reasons.push(`Teacher was absent from frame for ${summary.absentMinutes} minutes.`);
  }
  if (summary.inactiveMinutes >= 3) {
    reasons.push(`Prolonged inactivity appeared for ${summary.inactiveMinutes} minutes.`);
  }
  if (summary.walkingMinutes >= 2) {
    reasons.push(`Walking or movement was observed for ${summary.walkingMinutes} minutes.`);
  }

  return {
    label,
    score,
    components: {
      activeTeachingPct: Math.round(activePct),
      visibilityPct: Math.round(visiblePct),
      inactivityPct: Math.round(inactivePct),
      phoneUsagePct: Math.round(phonePct),
      absentPct: Math.round(absentPct),
      seatedPct: Math.round(seatedPct)
    },
    reasons
  };
}

export function decorateSession(session) {
  const summary = calculateSessionSummary(session);
  const engagement = calculateEngagementDescription(session);

  return {
    ...session,
    summary,
    engagement
  };
}

export function buildSessionAlertList(sessions) {
  return sessions
    .flatMap((session) => {
      const decorated = session.summary ? session : decorateSession(session);
      const alerts = [];

      if (decorated.engagement.score < 58) {
        alerts.push({
          id: `alert-low-${decorated.id}`,
          type: "low-engagement",
          teacherId: decorated.teacherId,
          teacherName: decorated.teacherName,
          sessionId: decorated.id,
          severity: "medium",
          message: `${decorated.teacherName} had low classroom activity in ${decorated.subject}.`,
          occurredAt: decorated.endedAt ?? decorated.startedAt
        });
      }

      if (decorated.summary.phoneUsageMinutes >= 1) {
        alerts.push({
          id: `alert-phone-${decorated.id}`,
          type: "phone-usage",
          teacherId: decorated.teacherId,
          teacherName: decorated.teacherName,
          sessionId: decorated.id,
          severity: decorated.summary.phoneUsageMinutes >= 2 ? "high" : "medium",
          message: `Possible phone usage detected for ${decorated.summary.phoneUsageMinutes} minutes during ${decorated.subject}.`,
          occurredAt: decorated.endedAt ?? decorated.startedAt
        });
      }

      if (decorated.summary.absentMinutes >= 2) {
        alerts.push({
          id: `alert-absence-${decorated.id}`,
          type: "absence",
          teacherId: decorated.teacherId,
          teacherName: decorated.teacherName,
          sessionId: decorated.id,
          severity: "medium",
          message: `${decorated.teacherName} was absent from frame for ${decorated.summary.absentMinutes} minutes.`,
          occurredAt: decorated.endedAt ?? decorated.startedAt
        });
      }

      return alerts;
    })
    .sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt));
}

export function buildTeacherTrendRows(teachers, sessions) {
  return teachers.map((teacher) => {
    const teacherSessions = sessions.filter((session) => session.teacherId === teacher.uid);
    const decoratedSessions = teacherSessions.map((session) =>
      session.summary ? session : decorateSession(session)
    );
    const averageScore = decoratedSessions.length
      ? Math.round(
          decoratedSessions.reduce((sum, session) => sum + session.engagement.score, 0) /
            decoratedSessions.length
        )
      : 0;
    const attendanceCompliance = teacher.scheduleCount
      ? Math.round((decoratedSessions.length / teacher.scheduleCount) * 100)
      : 0;

    return {
      teacherId: teacher.uid,
      teacherName: teacher.fullName,
      subject: teacher.subjectSpecialty,
      sessionsObserved: decoratedSessions.length,
      averageScore,
      attendanceCompliance: clamp(attendanceCompliance, 0, 100)
    };
  });
}

export function buildScheduleClock(baseDate, startClock, endClock) {
  return {
    scheduledStart: toIsoWithClock(baseDate, startClock),
    scheduledEnd: toIsoWithClock(baseDate, endClock)
  };
}
