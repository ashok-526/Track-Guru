function getApiBaseUrl() {
  const configured = import.meta.env.VITE_LIVE_MONITOR_API_BASE_URL;
  return (configured || "/api").replace(/\/$/, "");
}

export async function analyzeLiveMonitorSession({ session, screenshots }) {
  const response = await fetch(`${getApiBaseUrl()}/live-monitor/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      session: {
        id: session.id,
        teacherName: session.teacherName,
        subject: session.subject,
        grade: session.grade,
        section: session.section,
        room: session.room,
        periodLabel: session.periodLabel,
        startedAt: session.startedAt
      },
      screenshots
    })
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || "Live monitor image analysis failed.");
  }

  return payload;
}
