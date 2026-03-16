import * as faceapi from "face-api.js";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Spinner } from "../components/ui/Spinner";
import { TeacherVisionSummary } from "../components/vision/TeacherVisionSummary";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useFaceRecognition } from "../hooks/useFaceRecognition";
import { getFaceDetectorOptions } from "../lib/faceRecognition";
import { analyzeLiveMonitorSession } from "../services/liveMonitorVisionService";
import {
  buildLiveMonitorSample,
  buildObservationWindowFromSamples,
  LIVE_MONITOR_SAMPLE_SECONDS,
  LIVE_MONITOR_UPDATE_SECONDS
} from "../services/aiService";

const FACE_DISTANCE_THRESHOLD = 0.52;
const LIVE_MONITOR_FACE_THRESHOLD = 0.58;
const FACE_MATCH_MARGIN_THRESHOLD = 0.04;
const MONITOR_CAMERA_BOOT_DELAY_MS = 350;
const SCREENSHOT_CAPTURE_SECONDS = 5;

function similarityFromDistance(distance, threshold = FACE_DISTANCE_THRESHOLD) {
  return Math.max(0, Math.min(100, Math.round((1 - distance / threshold) * 100)));
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

function getRecorderMimeType() {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  return (
    candidates.find((candidate) => window.MediaRecorder.isTypeSupported(candidate)) ?? ""
  );
}

function extractDetectionLandmarks(detection) {
  if (!detection?.landmarks) {
    return null;
  }

  return {
    leftEye: averagePoint(detection.landmarks.getLeftEye()),
    rightEye: averagePoint(detection.landmarks.getRightEye()),
    nose: averagePoint(detection.landmarks.getNose()),
    mouth: averagePoint(detection.landmarks.getMouth())
  };
}

function findBestTeacherFaceMatch(descriptor, teachers) {
  const candidates = teachers
    .filter((teacher) => teacher.faceEnrollment?.descriptor?.length)
    .map((teacher) => {
      const distance = faceapi.euclideanDistance(
        new Float32Array(teacher.faceEnrollment.descriptor),
        descriptor
      );

      return {
        teacher,
        distance,
        similarity: similarityFromDistance(distance)
      };
    })
    .sort((left, right) => left.distance - right.distance);

  const best = candidates[0];
  const second = candidates[1];

  if (!best || best.distance > FACE_DISTANCE_THRESHOLD) {
    return null;
  }

  if (second && second.distance - best.distance < FACE_MATCH_MARGIN_THRESHOLD) {
    return null;
  }

  return best;
}

function selectTeacherDetection({
  detections,
  teacher,
  previousSample,
  frameWidth,
  frameHeight
}) {
  if (!detections.length) {
    return null;
  }

  const previousCenter =
    previousSample?.teacherVisible && previousSample.metrics
      ? {
          x: previousSample.metrics.centerX,
          y: previousSample.metrics.centerY
        }
      : null;

  if (teacher?.faceEnrollment?.descriptor?.length) {
    const storedDescriptor = new Float32Array(teacher.faceEnrollment.descriptor);
    const matches = detections
      .filter((detection) => detection.descriptor)
      .map((detection) => {
        const distance = faceapi.euclideanDistance(storedDescriptor, detection.descriptor);
        return {
          detection,
          distance,
          similarity: similarityFromDistance(distance, LIVE_MONITOR_FACE_THRESHOLD) / 100
        };
      })
      .sort((left, right) => left.distance - right.distance);

    if (matches[0] && matches[0].distance <= LIVE_MONITOR_FACE_THRESHOLD) {
      return matches[0];
    }
  }

  if (previousCenter) {
    const spatialCandidates = detections
      .map((detection) => {
        const box = detection.detection.box;
        const centerX = (box.x + box.width / 2) / frameWidth;
        const centerY = (box.y + box.height / 2) / frameHeight;
        return {
          detection,
          delta: Math.hypot(centerX - previousCenter.x, centerY - previousCenter.y),
          similarity: previousSample.metrics?.similarity ?? 0.66
        };
      })
      .sort((left, right) => left.delta - right.delta);

    if (spatialCandidates[0] && spatialCandidates[0].delta <= 0.18) {
      return spatialCandidates[0];
    }
  }

  if (!teacher?.faceEnrollment || detections.length === 1) {
    const [largest] = [...detections].sort((left, right) => {
      const leftArea = left.detection.box.width * left.detection.box.height;
      const rightArea = right.detection.box.width * right.detection.box.height;
      return rightArea - leftArea;
    });

    if (largest) {
      return {
        detection: largest,
        similarity: previousSample?.metrics?.similarity ?? 0.62
      };
    }
  }

  return null;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatCountdown(milliseconds) {
  const safeValue = Math.max(0, milliseconds);
  const totalSeconds = Math.ceil(safeValue / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatRelativeTime(value) {
  const deltaSeconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));

  if (deltaSeconds < 60) {
    return `${deltaSeconds}s ago`;
  }

  const minutes = Math.floor(deltaSeconds / 60);
  return `${minutes}m ago`;
}

function describeCaptureQuality(quality) {
  if (!quality) {
    return "Waiting for the first validated frame.";
  }

  return `Brightness ${quality.brightness} • Contrast ${quality.contrast}`;
}

function SessionTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    function tick() {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(
        h > 0
          ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
          : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-900 px-3.5 py-1.5">
      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
      <span className="font-mono text-sm font-bold tabular-nums text-white">{elapsed}</span>
    </div>
  );
}

function SessionStartModal({
  isOpen,
  onClose,
  onStart,
  schedule,
  teachers
}) {
  const {
    videoRef,
    modelsReady,
    loadingModels,
    error,
    startCamera,
    stopCamera,
    captureDescriptor
  } = useFaceRecognition(isOpen);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [scanResult, setScanResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [faceBox, setFaceBox] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [liveMatchName, setLiveMatchName] = useState(null);
  const [liveMatchCorrect, setLiveMatchCorrect] = useState(false);
  const containerRef = useRef(null);
  const detectLoopRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    setScanResult(null);
    setAudioEnabled(true);
    setFaceBox(null);
    setFaceDetected(false);
    setLiveMatchName(null);
    setLiveMatchCorrect(false);
    startCamera({ preferredFacingMode: "user" });
    return () => {
      stopCamera();
      if (detectLoopRef.current) cancelAnimationFrame(detectLoopRef.current);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!modelsReady || !isOpen || submitting) {
      setFaceBox(null);
      setFaceDetected(false);
      setLiveMatchName(null);
      setLiveMatchCorrect(false);
      if (detectLoopRef.current) cancelAnimationFrame(detectLoopRef.current);
      return undefined;
    }

    let active = true;
    const options = getFaceDetectorOptions();

    async function detect() {
      const video = videoRef.current;
      if (!active || !video || video.readyState < 2) {
        detectLoopRef.current = requestAnimationFrame(() => setTimeout(detect, 200));
        return;
      }

      try {
        const result = await faceapi
          .detectSingleFace(video, options)
          .withFaceLandmarks(true)
          .withFaceDescriptor();
        if (!active) return;

        if (result) {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const container = containerRef.current;
          const cw = container?.offsetWidth ?? vw;
          const ch = container?.offsetHeight ?? vh;
          const sx = cw / vw;
          const sy = ch / vh;
          const box = result.detection.box;
          setFaceBox({ x: box.x * sx, y: box.y * sy, w: box.width * sx, h: box.height * sy });
          setFaceDetected(true);

          const match = findBestTeacherFaceMatch(result.descriptor, teachers);
          if (match) {
            setLiveMatchName(match.teacher.fullName);
            setLiveMatchCorrect(match.teacher.uid === schedule?.teacherId);
          } else {
            setLiveMatchName(null);
            setLiveMatchCorrect(false);
          }
        } else {
          setFaceBox(null);
          setFaceDetected(false);
          setLiveMatchName(null);
          setLiveMatchCorrect(false);
        }
      } catch { /* skip */ }

      if (active) {
        detectLoopRef.current = requestAnimationFrame(() => setTimeout(detect, 250));
      }
    }

    detect();
    return () => {
      active = false;
      if (detectLoopRef.current) cancelAnimationFrame(detectLoopRef.current);
    };
  }, [modelsReady, isOpen, submitting, teachers, schedule?.teacherId]);

  if (!isOpen || !schedule) return null;

  async function handleVerify() {
    try {
      setSubmitting(true);
      setScanResult(null);
      const capture = await captureDescriptor({
        sampleCount: 2,
        sampleDelayMs: 120,
        noFaceMessage: "No face detected. Keep the teacher's face visible."
      });

      const match = findBestTeacherFaceMatch(capture.descriptor, teachers);
      if (!match) {
        setScanResult({ status: "error", title: "Not recognized", description: "Face did not match any enrolled teacher." });
        return;
      }
      if (match.teacher.uid !== schedule.teacherId) {
        setScanResult({ status: "warning", title: "Wrong teacher", description: `Matched ${match.teacher.fullName}, but ${schedule.teacherName} is scheduled.` });
        return;
      }

      const started = await onStart({
        scheduleId: schedule.id,
        matchedTeacher: match.teacher,
        audioEnabled,
        verification: { confidence: match.similarity / 100, override: false }
      });
      if (started) onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const boxIsWrong = liveMatchName && !liveMatchCorrect;
  const boxColor = boxIsWrong ? "border-red-400" : liveMatchCorrect ? "border-emerald-400" : "border-primary-400";
  const boxGlow = boxIsWrong
    ? "0 0 14px rgba(239,68,68,0.35)"
    : liveMatchCorrect
      ? "0 0 14px rgba(34,197,94,0.35)"
      : "0 0 12px rgba(0,108,196,0.25)";
  const cornerColor = boxIsWrong ? "border-red-400" : liveMatchCorrect ? "border-emerald-400" : "border-primary-400";

  return (
    <Modal title="Verify Teacher" onClose={onClose}>
      <div className="space-y-4">
        {/* Schedule info */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-surface-900">{schedule.subject} &middot; {schedule.grade} {schedule.section}</p>
            <p className="text-xs text-surface-500">{schedule.startClock}–{schedule.endClock} &middot; {schedule.room}</p>
          </div>
          <span className="shrink-0 rounded-lg border border-surface-200 bg-white px-2.5 py-1 text-xs font-semibold text-surface-700">{schedule.teacherName}</span>
        </div>

        {/* Camera with live tracking */}
        <div ref={containerRef} className="relative overflow-hidden rounded-2xl border border-surface-200 bg-slate-950">
          <video ref={videoRef} autoPlay muted playsInline className="aspect-[4/3] w-full object-cover" />

          {faceBox && !submitting && (
            <div
              className={`pointer-events-none absolute rounded-lg border-2 transition-all duration-150 ease-out ${boxColor}`}
              style={{ left: faceBox.x, top: faceBox.y, width: faceBox.w, height: faceBox.h, boxShadow: boxGlow }}
            >
              <span className={`absolute -left-[2px] -top-[2px] h-4 w-4 border-l-[3px] border-t-[3px] rounded-tl-md ${cornerColor}`} />
              <span className={`absolute -right-[2px] -top-[2px] h-4 w-4 border-r-[3px] border-t-[3px] rounded-tr-md ${cornerColor}`} />
              <span className={`absolute -bottom-[2px] -left-[2px] h-4 w-4 border-b-[3px] border-l-[3px] rounded-bl-md ${cornerColor}`} />
              <span className={`absolute -bottom-[2px] -right-[2px] h-4 w-4 border-b-[3px] border-r-[3px] rounded-br-md ${cornerColor}`} />

              {liveMatchName && (
                <span className={`absolute -top-7 left-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold text-white shadow-sm ${boxIsWrong ? "bg-red-500" : "bg-emerald-500"}`}>
                  {liveMatchName}
                </span>
              )}

              {!liveMatchName && (
                <div className="face-scan-line absolute left-1 right-1 h-[2px] rounded-full" style={{ background: "linear-gradient(90deg, transparent, rgba(0,108,196,0.5), transparent)" }} />
              )}
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/80 to-transparent px-4 pb-3 pt-10">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${
                boxIsWrong ? "bg-red-400 animate-pulse"
                  : liveMatchCorrect ? "bg-emerald-400 animate-pulse"
                    : faceDetected ? "bg-primary-400 animate-pulse"
                      : "bg-amber-400"
              }`} />
              <span className="text-xs font-semibold text-white/90">
                {submitting ? "Verifying..."
                  : liveMatchCorrect ? `${liveMatchName} — ready`
                    : boxIsWrong ? `${liveMatchName} — wrong teacher`
                      : faceDetected ? "Identifying..."
                        : "No face — move closer"}
              </span>
            </div>
            {faceDetected && !submitting && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                liveMatchCorrect ? "bg-emerald-500/20 text-emerald-300"
                  : boxIsWrong ? "bg-red-500/20 text-red-300"
                    : "bg-white/10 text-white/70"
              }`}>
                {liveMatchCorrect ? "MATCHED" : boxIsWrong ? "MISMATCH" : "TRACKING"}
              </span>
            )}
          </div>

          {submitting && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/30">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 rounded-full border-[3px] border-emerald-400/30 border-t-emerald-400 animate-spin" />
                <p className="text-xs font-semibold text-white">Verifying identity...</p>
              </div>
            </div>
          )}
        </div>

        {loadingModels && <Spinner label="Loading face models..." />}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {scanResult && (
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
            scanResult.status === "error" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
          }`}>
            <svg className={`mt-0.5 h-5 w-5 shrink-0 ${scanResult.status === "error" ? "text-red-500" : "text-amber-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className={`text-sm font-semibold ${scanResult.status === "error" ? "text-red-800" : "text-amber-800"}`}>{scanResult.title}</p>
              <p className={`mt-0.5 text-sm ${scanResult.status === "error" ? "text-red-700" : "text-amber-700"}`}>{scanResult.description}</p>
            </div>
          </div>
        )}

        <Button className="w-full" disabled={!modelsReady || submitting} onClick={handleVerify}>
          {submitting ? <Spinner label="Verifying..." size="sm" /> : "Verify & Start Session"}
        </Button>
      </div>
    </Modal>
  );
}

export function AttendancePage() {
  const { user } = useAuth();
  const {
    data,
    loading,
    captureObservation,
    saveSessionScreenshot,
    endSession,
    startVerifiedSession
  } = useAppData();
  const {
    videoRef: monitorVideoRef,
    modelsReady: monitorModelsReady,
    loadingModels: monitorLoadingModels,
    cameraActive: monitorCameraActive,
    videoReady: monitorVideoReady,
    mediaStream: monitorMediaStream,
    error: monitorError,
    startCamera: startMonitorCamera,
    stopCamera: stopMonitorCamera,
    captureFrameDetections,
    captureValidatedFrameSnapshot
  } = useFaceRecognition(Boolean(data?.activeSession));
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [liveFaceBox, setLiveFaceBox] = useState(null);
  const liveContainerRef = useRef(null);
  const liveDetectLoopRef = useRef(null);
  const [autoMonitoring, setAutoMonitoring] = useState(false);
  const [latestSample, setLatestSample] = useState(null);
  const [cycleSampleCount, setCycleSampleCount] = useState(0);
  const [currentCycleStartedAt, setCurrentCycleStartedAt] = useState(null);
  const [updateCountdownMs, setUpdateCountdownMs] = useState(
    LIVE_MONITOR_UPDATE_SECONDS * 1000
  );
  const [, setRecordingActive] = useState(false);
  const [audioMeterActive, setAudioMeterActive] = useState(false);
  const [monitorClips, setMonitorClips] = useState({});
  const [endingSession, setEndingSession] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [captureStatus, setCaptureStatus] = useState("Waiting for the first validated frame.");
  const [lastCaptureQuality, setLastCaptureQuality] = useState(null);
  const captureLockRef = useRef(false);
  const sampleIntervalRef = useRef(null);
  const screenshotIntervalRef = useRef(null);
  const screenshotCaptureLockRef = useRef(false);
  const lastScreenshotAtRef = useRef(0);
  const recorderRef = useRef(null);
  const chunkStartRef = useRef(null);
  const sampleBufferRef = useRef([]);
  const activeSessionRef = useRef(null);
  const activeTeacherRef = useRef(null);
  const latestSampleRef = useRef(null);
  const audioLevelRef = useRef(0);
  const audioContextRef = useRef(null);
  const audioRafRef = useRef(null);
  const clipMapRef = useRef({});

  const teachers = data?.teachers ?? [];
  const activeSession = data?.activeSession ?? null;
  const activeTeacher = activeSession
    ? teachers.find((teacher) => teacher.uid === activeSession.teacherId) ?? null
    : null;
  const recentSessionWithVisionAnalysis =
    data?.sessionHistory?.find((session) => session.visionAnalysis) ?? null;
  const canOverride = user.role === "admin";
  const liveUpdates = activeSession
    ? [...activeSession.timeline]
        .filter((windowItem) => windowItem.analytics)
        .sort((left, right) => new Date(right.endTime) - new Date(left.endTime))
    : [];
  const recentLiveUpdates = liveUpdates.slice(0, 6);
  const latestScreenshot =
    activeSession?.screenshots?.[activeSession.screenshots.length - 1] ?? null;
  const recentScreenshots = activeSession
    ? [...(activeSession.screenshots ?? [])].reverse().slice(0, 8)
    : [];
  const nextFrameCountdownMs = lastScreenshotAtRef.current
    ? Math.max(0, SCREENSHOT_CAPTURE_SECONDS * 1000 - (Date.now() - lastScreenshotAtRef.current))
    : SCREENSHOT_CAPTURE_SECONDS * 1000;
  const progressPercent = currentCycleStartedAt
    ? Math.min(
        100,
        Math.round(
          ((LIVE_MONITOR_UPDATE_SECONDS * 1000 - updateCountdownMs) /
            (LIVE_MONITOR_UPDATE_SECONDS * 1000)) *
            100
        )
      )
    : 0;

  useEffect(() => {
    activeSessionRef.current = activeSession;
    activeTeacherRef.current = activeTeacher;
  }, [activeSession, activeTeacher]);

  useEffect(() => {
    clipMapRef.current = monitorClips;
  }, [monitorClips]);

  useEffect(() => {
    return () => {
      Object.values(clipMapRef.current).forEach((clip) => {
        if (clip?.url) {
          URL.revokeObjectURL(clip.url);
        }
      });
    };
  }, []);

  useEffect(() => {
    Object.values(clipMapRef.current).forEach((clip) => {
      if (clip?.url) {
        URL.revokeObjectURL(clip.url);
      }
    });
    clipMapRef.current = {};
    setMonitorClips({});
    sampleBufferRef.current = [];
    latestSampleRef.current = null;
    setLatestSample(null);
    setCycleSampleCount(0);
    chunkStartRef.current = null;
    setCurrentCycleStartedAt(null);
    setUpdateCountdownMs(LIVE_MONITOR_UPDATE_SECONDS * 1000);
    setRecordingActive(false);
    audioLevelRef.current = 0;
    setAudioMeterActive(false);
    setAnalysisError("");
    lastScreenshotAtRef.current = 0;
    setCaptureStatus("Waiting for the first validated frame.");
    setLastCaptureQuality(null);
  }, [activeSession?.id]);

  function beginMonitoringCycle(startedAt) {
    chunkStartRef.current = startedAt;
    setCurrentCycleStartedAt(startedAt);
    setUpdateCountdownMs(LIVE_MONITOR_UPDATE_SECONDS * 1000);
  }

  async function startReviewRecorder(stream) {
    if (!stream || typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
      setRecordingActive(false);
      return;
    }

    if (recorderRef.current?.state === "recording") {
      return;
    }

    try {
      const mimeType = getRecorderMimeType();
      const recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType })
        : new window.MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          chunks.push(event.data);
        }
      };

      recorder._chunks = chunks;
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecordingActive(true);
    } catch {
      setRecordingActive(false);
    }
  }

  async function stopReviewRecorder({ discard = false } = {}) {
    const recorder = recorderRef.current;

    if (!recorder) {
      setRecordingActive(false);
      return null;
    }

    return await new Promise((resolve) => {
      const finish = () => {
        const chunks = recorder._chunks ?? [];
        recorderRef.current = null;
        setRecordingActive(false);

        if (discard || !chunks.length) {
          resolve(null);
          return;
        }

        const blob = new Blob(chunks, {
          type: recorder.mimeType || "video/webm"
        });
        const url = URL.createObjectURL(blob);
        resolve({
          url,
          mimeType: blob.type,
          size: blob.size
        });
      };

      if (recorder.state === "inactive") {
        finish();
        return;
      }

      recorder.addEventListener("stop", finish, { once: true });
      recorder.stop();
    });
  }

  async function finalizeMonitorUpdate({
    force = false,
    sampledAt = new Date().toISOString(),
    restartRecording = true
  } = {}) {
    const session = activeSessionRef.current;

    if (!session || !sampleBufferRef.current.length) {
      return null;
    }

    const cycleStart = chunkStartRef.current ?? sampledAt;
    const elapsedMs = new Date(sampledAt).getTime() - new Date(cycleStart).getTime();

    if (!force && elapsedMs < LIVE_MONITOR_UPDATE_SECONDS * 1000) {
      return null;
    }

    const windowId = `window-${crypto.randomUUID()}`;
    const windowData = {
      ...buildObservationWindowFromSamples({
        samples: sampleBufferRef.current,
        startTime: cycleStart,
        endTime: sampledAt
      }),
      id: windowId
    };

    const clip = await stopReviewRecorder();
    if (clip?.url) {
      setMonitorClips((current) => ({
        ...current,
        [windowId]: clip
      }));
    }

    sampleBufferRef.current = [];
    setCycleSampleCount(0);
    beginMonitoringCycle(sampledAt);

    await captureObservation(session.id, windowData);

    if (restartRecording && autoMonitoring && monitorMediaStream) {
      await startReviewRecorder(monitorMediaStream);
    }

    return windowData;
  }

  useEffect(() => {
    if (!activeSession) {
      stopMonitorCamera();
      setAutoMonitoring(false);
      return undefined;
    }

    let active = true;

    async function openMonitorCamera() {
      await new Promise((resolve) => {
        window.setTimeout(resolve, MONITOR_CAMERA_BOOT_DELAY_MS);
      });

      if (!active) {
        return;
      }

      const started = await startMonitorCamera({
        includeAudio: Boolean(activeSession.audioEnabled)
      });

      if (active && started) {
        setAutoMonitoring(true);
      }
    }

    openMonitorCamera();

    return () => {
      active = false;
      setAutoMonitoring(false);
      void stopReviewRecorder({ discard: true });
      stopMonitorCamera();
    };
  }, [activeSession?.id]);

  async function captureAndStoreMinuteScreenshot({ force = false } = {}) {
    const session = activeSessionRef.current;

    if (
      !session ||
      !monitorCameraActive ||
      !monitorVideoReady ||
      screenshotCaptureLockRef.current ||
      endingSession
    ) {
      return;
    }

    const now = Date.now();
    if (!force && now - lastScreenshotAtRef.current < SCREENSHOT_CAPTURE_SECONDS * 1000 * 0.8) {
      return;
    }

    screenshotCaptureLockRef.current = true;

    try {
      const capturedAt = new Date().toISOString();
      const { imageUrl, quality } = await captureValidatedFrameSnapshot({
        maxWidth: 256,
        quality: 0.7,
        maxAttempts: force ? 5 : 4
      });

      await saveSessionScreenshot(session.id, {
        id: `shot-${crypto.randomUUID()}`,
        capturedAt,
        imageUrl
      });
      lastScreenshotAtRef.current = now;
      setLastCaptureQuality(quality);
      setCaptureStatus(`Validated frame saved at ${formatDateTime(capturedAt)}.`);
    } catch (error) {
      setLastCaptureQuality(error.quality ?? null);
      setCaptureStatus(error.message);
      console.error("Minute screenshot capture failed", error);
    } finally {
      screenshotCaptureLockRef.current = false;
    }
  }

  useEffect(() => {
    if (monitorError) {
      setAutoMonitoring(false);
    }
  }, [monitorError]);

  useEffect(() => {
    if (!activeSession || !autoMonitoring || !monitorCameraActive || !monitorVideoReady) {
      if (screenshotIntervalRef.current) {
        window.clearInterval(screenshotIntervalRef.current);
        screenshotIntervalRef.current = null;
      }

      return undefined;
    }

    void captureAndStoreMinuteScreenshot();
    screenshotIntervalRef.current = window.setInterval(() => {
      void captureAndStoreMinuteScreenshot();
    }, SCREENSHOT_CAPTURE_SECONDS * 1000);

    return () => {
      if (screenshotIntervalRef.current) {
        window.clearInterval(screenshotIntervalRef.current);
        screenshotIntervalRef.current = null;
      }
    };
  }, [activeSession?.id, autoMonitoring, monitorCameraActive, monitorVideoReady, endingSession]);

  useEffect(() => {
    if (
      !autoMonitoring ||
      !activeSession?.audioEnabled ||
      !monitorMediaStream ||
      !monitorMediaStream.getAudioTracks().length
    ) {
      setAudioMeterActive(false);
      audioLevelRef.current = 0;

      if (audioRafRef.current) {
        window.cancelAnimationFrame(audioRafRef.current);
        audioRafRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }

      return undefined;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      setAudioMeterActive(false);
      return undefined;
    }

    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(monitorMediaStream);
    const analyser = audioContext.createAnalyser();
    const dataArray = new Uint8Array(analyser.fftSize);

    analyser.fftSize = 1024;
    source.connect(analyser);
    audioContextRef.current = audioContext;

    const updateAudioLevel = () => {
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;

      for (const value of dataArray) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }

      audioLevelRef.current = Math.sqrt(sum / dataArray.length);
      audioRafRef.current = window.requestAnimationFrame(updateAudioLevel);
    };

    audioContext.resume().catch(() => {});
    updateAudioLevel();
    setAudioMeterActive(true);

    return () => {
      if (audioRafRef.current) {
        window.cancelAnimationFrame(audioRafRef.current);
        audioRafRef.current = null;
      }

      analyser.disconnect();
      source.disconnect();
      audioContext.close().catch(() => {});
      audioContextRef.current = null;
      audioLevelRef.current = 0;
      setAudioMeterActive(false);
    };
  }, [autoMonitoring, activeSession?.id, activeSession?.audioEnabled, monitorMediaStream]);

  useEffect(() => {
    if (
      !autoMonitoring ||
      !activeSession ||
      !monitorCameraActive ||
      !monitorModelsReady ||
      !monitorMediaStream
    ) {
      return undefined;
    }

    let cancelled = false;

    async function runSample() {
      if (cancelled || captureLockRef.current) {
        return;
      }

      captureLockRef.current = true;

      try {
        const sampledAt = new Date().toISOString();
        if (!chunkStartRef.current) {
          beginMonitoringCycle(sampledAt);
        }

        const { detections, frameWidth, frameHeight } = await captureFrameDetections({
          includeDescriptors: true
        });
        const previousSample =
          sampleBufferRef.current[sampleBufferRef.current.length - 1] ?? latestSampleRef.current;
        const selected = selectTeacherDetection({
          detections,
          teacher: activeTeacherRef.current,
          previousSample,
          frameWidth,
          frameHeight
        });

        const nextSample = selected
          ? buildLiveMonitorSample({
              sampledAt,
              frameWidth,
              frameHeight,
              box: selected.detection.detection.box,
              landmarks: extractDetectionLandmarks(selected.detection),
              similarity: selected.similarity,
              previousSample,
              audioLevel: audioLevelRef.current,
              audioEnabled: Boolean(activeSessionRef.current?.audioEnabled)
            })
          : buildLiveMonitorSample({
              sampledAt,
              frameWidth,
              frameHeight,
              box: null,
              previousSample,
              audioLevel: audioLevelRef.current,
              audioEnabled: Boolean(activeSessionRef.current?.audioEnabled)
            });

        sampleBufferRef.current = [...sampleBufferRef.current, nextSample];
        latestSampleRef.current = nextSample;
        setLatestSample(nextSample);
        setCycleSampleCount(sampleBufferRef.current.length);

        const elapsedMs =
          new Date(sampledAt).getTime() - new Date(chunkStartRef.current).getTime();

        if (elapsedMs >= LIVE_MONITOR_UPDATE_SECONDS * 1000) {
          await finalizeMonitorUpdate({ sampledAt });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Live monitor sample failed", error);
        }
      } finally {
        captureLockRef.current = false;
      }
    }

    async function startLoop() {
      await startReviewRecorder(monitorMediaStream);
      await runSample();
      sampleIntervalRef.current = window.setInterval(() => {
        void runSample();
      }, LIVE_MONITOR_SAMPLE_SECONDS * 1000);
    }

    startLoop();

    return () => {
      cancelled = true;

      if (sampleIntervalRef.current) {
        window.clearInterval(sampleIntervalRef.current);
        sampleIntervalRef.current = null;
      }

      void stopReviewRecorder({ discard: true });
    };
  }, [
    autoMonitoring,
    activeSession?.id,
    monitorCameraActive,
    monitorModelsReady,
    monitorMediaStream
  ]);

  useEffect(() => {
    if (!autoMonitoring || !currentCycleStartedAt) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      const dueAt =
        new Date(currentCycleStartedAt).getTime() + LIVE_MONITOR_UPDATE_SECONDS * 1000;
      setUpdateCountdownMs(Math.max(0, dueAt - Date.now()));
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [autoMonitoring, currentCycleStartedAt]);

  useEffect(() => {
    if (!activeSession || !monitorModelsReady || !monitorVideoReady || endingSession) {
      setLiveFaceBox(null);
      if (liveDetectLoopRef.current) cancelAnimationFrame(liveDetectLoopRef.current);
      return undefined;
    }

    let active = true;
    const options = getFaceDetectorOptions();

    async function detect() {
      const video = monitorVideoRef.current;
      if (!active || !video || video.readyState < 2) {
        liveDetectLoopRef.current = requestAnimationFrame(() => setTimeout(detect, 300));
        return;
      }

      try {
        const result = await faceapi.detectSingleFace(video, options);
        if (!active) return;

        if (result) {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const container = liveContainerRef.current;
          const cw = container?.offsetWidth ?? vw;
          const ch = container?.offsetHeight ?? vh;
          const sx = cw / vw;
          const sy = ch / vh;
          setLiveFaceBox({
            x: result.box.x * sx,
            y: result.box.y * sy,
            w: result.box.width * sx,
            h: result.box.height * sy,
          });
        } else {
          setLiveFaceBox(null);
        }
      } catch { /* skip */ }

      if (active) {
        liveDetectLoopRef.current = requestAnimationFrame(() => setTimeout(detect, 300));
      }
    }

    detect();
    return () => {
      active = false;
      if (liveDetectLoopRef.current) cancelAnimationFrame(liveDetectLoopRef.current);
    };
  }, [activeSession?.id, monitorModelsReady, monitorVideoReady, endingSession]);

  async function handleToggleMonitoring() {
    if (!activeSession) {
      return;
    }

    if (autoMonitoring) {
      await finalizeMonitorUpdate({ force: true, restartRecording: false });
      setAutoMonitoring(false);
      return;
    }

    beginMonitoringCycle(new Date().toISOString());
    setAutoMonitoring(true);
  }

  async function handleGenerateUpdateNow() {
    if (!activeSession || !cycleSampleCount) {
      toast.error("The monitor needs a few live samples before it can generate an update.");
      return;
    }

    await finalizeMonitorUpdate({ force: true });
  }

  async function handleEndSession() {
    if (!activeSession) {
      return;
    }

    setEndingSession(true);
    setAnalysisError("");

    try {
      await finalizeMonitorUpdate({ force: true, restartRecording: false });
      await captureAndStoreMinuteScreenshot({ force: true });

      const screenshots = activeSessionRef.current?.screenshots ?? [];
      let visionAnalysis = null;

      if (screenshots.length) {
        try {
          const analysis = await analyzeLiveMonitorSession({
            session: activeSessionRef.current,
            screenshots
          });

          visionAnalysis = {
            generatedAt: analysis.generatedAt,
            observations: analysis.observations,
            ...analysis.report
          };
        } catch (error) {
          setAnalysisError(error.message);
          toast.error(error.message);
        }
      }

      await endSession(activeSession.id, { visionAnalysis });
    } catch (error) {
      setAnalysisError(error.message);
      toast.error(error.message);
    } finally {
      setEndingSession(false);
    }
  }

  if (loading || !data) {
    return <Spinner label="Loading live session monitor..." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-surface-900 tracking-tight">Live Monitor</h1>
        {activeSession && (
          <span className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        )}
      </div>

      {!activeSession ? (
        <>
          {recentSessionWithVisionAnalysis ? (
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                    <svg className="h-4 w-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-surface-900">Last Session</p>
                    <p className="truncate text-xs text-surface-500">
                      {recentSessionWithVisionAnalysis.teacherName} &middot; {recentSessionWithVisionAnalysis.subject} &middot; {recentSessionWithVisionAnalysis.grade} {recentSessionWithVisionAnalysis.section}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1 text-xs font-medium text-surface-600">
                  {formatDateTime(recentSessionWithVisionAnalysis.visionAnalysis.generatedAt || recentSessionWithVisionAnalysis.endedAt)}
                </span>
              </div>
              <div className="mt-3 border-t border-surface-200 pt-3">
                <TeacherVisionSummary analysis={recentSessionWithVisionAnalysis.visionAnalysis} />
              </div>
            </Card>
          ) : null}

          <Card className="p-6">
            <h2 className="text-lg font-bold text-surface-900">Today's Schedule</h2>
            <p className="mt-1 text-sm text-surface-500">Select a period to start monitoring.</p>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {data.todaySchedule.length === 0 ? (
                <p className="text-sm text-surface-500">No periods scheduled.</p>
              ) : (
                data.todaySchedule.map((schedule) => {
                  const teacher = teachers.find((item) => item.uid === schedule.teacherId);
                  return (
                    <div key={schedule.id} className="rounded-2xl border border-surface-200 bg-surface-50 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-surface-900">{schedule.subject} &middot; {schedule.grade} {schedule.section}</p>
                          <p className="mt-1 text-sm text-surface-500">{schedule.periodLabel} &middot; {schedule.startClock}-{schedule.endClock} &middot; {schedule.room}</p>
                        </div>
                        <span className="chip bg-white text-surface-900">{schedule.teacherName}</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-4">
                        <span className={`text-xs font-medium ${teacher?.faceEnrollment ? "text-emerald-600" : "text-surface-500"}`}>
                          {teacher?.faceEnrollment ? "Face enrolled" : "Not enrolled"}
                        </span>
                        <Button onClick={() => { setSelectedSchedule(schedule); setStartModalOpen(true); }}>
                          Verify & Start
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">

          {/* ── Left: Live Camera ── */}
          <Card className="overflow-hidden p-0">
            {/* Session bar */}
            <div className="flex items-center justify-between gap-4 border-b border-surface-200 bg-white px-5 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-surface-900">{activeSession.teacherName}</p>
                  <p className="truncate text-xs text-surface-500">{activeSession.subject} &middot; {activeSession.grade} {activeSession.section} &middot; {activeSession.room}</p>
                </div>
              </div>
              <SessionTimer startedAt={activeSession.startedAt} />
            </div>

            {/* Video */}
            <div ref={liveContainerRef} className="relative bg-slate-950">
              <video ref={monitorVideoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />

              {/* Face tracking box */}
              {liveFaceBox && (
                <div
                  className="pointer-events-none absolute rounded-lg border-2 border-emerald-400 transition-all duration-150 ease-out"
                  style={{
                    left: liveFaceBox.x,
                    top: liveFaceBox.y,
                    width: liveFaceBox.w,
                    height: liveFaceBox.h,
                    boxShadow: "0 0 12px rgba(34,197,94,0.3), inset 0 0 12px rgba(34,197,94,0.06)",
                  }}
                >
                  <span className="absolute -left-[2px] -top-[2px] h-3.5 w-3.5 border-l-[3px] border-t-[3px] border-emerald-400 rounded-tl-md" />
                  <span className="absolute -right-[2px] -top-[2px] h-3.5 w-3.5 border-r-[3px] border-t-[3px] border-emerald-400 rounded-tr-md" />
                  <span className="absolute -bottom-[2px] -left-[2px] h-3.5 w-3.5 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-md" />
                  <span className="absolute -bottom-[2px] -right-[2px] h-3.5 w-3.5 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-md" />
                  <div className="face-scan-line absolute left-1 right-1 h-[2px] rounded-full" style={{ background: "linear-gradient(90deg, transparent, rgba(34,197,94,0.5), transparent)" }} />
                </div>
              )}

              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-slate-950/60 to-transparent px-4 py-3">
                <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur">
                  <span className={`h-2 w-2 rounded-full ${monitorVideoReady ? "bg-emerald-400" : "bg-amber-300"}`} />
                  {monitorVideoReady ? "Live" : "Connecting"}
                </div>
                <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
                  {activeSession.screenshots?.length ?? 0} frames
                </div>
              </div>
              {!monitorVideoReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 text-white backdrop-blur-sm">
                  <Spinner label="Connecting..." />
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-3 border-t border-surface-200 bg-white px-5 py-3">
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={!monitorCameraActive || endingSession}
                  onClick={handleToggleMonitoring}
                >
                  {autoMonitoring ? "Pause" : "Resume"}
                </Button>
                {!monitorCameraActive && (
                  <Button variant="secondary" onClick={() => startMonitorCamera({ includeAudio: Boolean(activeSession.audioEnabled) })}>
                    Retry Camera
                  </Button>
                )}
              </div>
              <Button disabled={endingSession} onClick={handleEndSession} className="bg-red-600 hover:bg-red-700 shadow-none">
                {endingSession ? <Spinner label="Ending..." size="sm" /> : "End Session"}
              </Button>
            </div>

            {monitorError && <p className="px-5 py-2 text-sm text-red-600">{monitorError}</p>}
            {analysisError && <p className="px-5 py-2 text-sm text-red-600">{analysisError}</p>}
          </Card>

          {/* ── Right: Screenshots ── */}
          <Card className="overflow-hidden p-0 flex flex-col">
            <div className="flex items-center justify-between border-b border-surface-200 bg-white px-5 py-3">
              <h2 className="text-sm font-bold text-surface-900">Captured Frames</h2>
              <span className="text-xs text-surface-500">{recentScreenshots.length} saved</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {recentScreenshots.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-surface-200 bg-surface-50 p-8">
                  <p className="text-center text-sm text-surface-500">Frames will appear here as the session runs.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {recentScreenshots.slice(0, 8).map((screenshot) => (
                    <div key={screenshot.id} className="rounded-xl border border-surface-200 bg-surface-50 p-2">
                      <div className="overflow-hidden rounded-lg border border-surface-200 bg-white">
                        <img src={screenshot.imageUrl} alt="Captured frame" className="aspect-video w-full object-cover" />
                      </div>
                      <p className="mt-2 text-center text-[11px] text-surface-500">{formatRelativeTime(screenshot.capturedAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      <SessionStartModal
        isOpen={startModalOpen}
        onClose={() => setStartModalOpen(false)}
        onStart={startVerifiedSession}
        schedule={selectedSchedule}
        teachers={teachers}
      />
    </div>
  );
}
