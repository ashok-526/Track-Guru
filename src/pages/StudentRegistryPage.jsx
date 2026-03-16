import * as faceapi from "face-api.js";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { getFaceDetectorOptions } from "../lib/faceRecognition";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Spinner } from "../components/ui/Spinner";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useFaceRecognition } from "../hooks/useFaceRecognition";

function TeacherFormModal({ isOpen, onClose, onSave, teacher }) {
  const [form, setForm] = useState({
    fullName: "", staffId: "", email: "", title: "",
    subjectSpecialty: "", assignedGrades: "", phone: "",
  });

  useEffect(() => {
    setForm({
      fullName: teacher?.fullName ?? "", staffId: teacher?.staffId ?? "",
      email: teacher?.email ?? "", title: teacher?.title ?? "",
      subjectSpecialty: teacher?.subjectSpecialty ?? "",
      assignedGrades: teacher?.assignedGrades ?? "", phone: teacher?.phone ?? "",
    });
  }, [teacher]);

  if (!isOpen) return null;

  return (
    <Modal title={teacher ? "Edit Teacher" : "Register Teacher"} onClose={onClose}>
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={async (e) => { e.preventDefault(); const saved = await onSave(form, teacher); if (saved) onClose(); }}
      >
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-surface-700">Full Name</label>
          <input className="field" value={form.fullName} onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-surface-700">Staff ID</label>
          <input className="field" value={form.staffId} onChange={(e) => setForm((c) => ({ ...c, staffId: e.target.value }))} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-surface-700">Email</label>
          <input type="email" className="field" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-surface-700">Title</label>
          <input className="field" value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} placeholder="Science Teacher" required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-surface-700">Subject</label>
          <input className="field" value={form.subjectSpecialty} onChange={(e) => setForm((c) => ({ ...c, subjectSpecialty: e.target.value }))} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-surface-700">Grades</label>
          <input className="field" value={form.assignedGrades} onChange={(e) => setForm((c) => ({ ...c, assignedGrades: e.target.value }))} placeholder="Grade 7, Grade 8" required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-surface-700">Phone</label>
          <input className="field" value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} required />
        </div>
        <div className="md:col-span-2">
          <Button type="submit">{teacher ? "Update Teacher" : "Save Teacher"}</Button>
        </div>
      </form>
    </Modal>
  );
}

const ENROLL_DUPLICATE_THRESHOLD = 0.38;

function findDuplicateFace(descriptor, teachers, excludeUid) {
  if (!descriptor) return null;
  const normalizedInput = new Float32Array(descriptor);

  let bestMatch = null;
  let bestDist = Infinity;

  for (const t of teachers) {
    if (t.uid === excludeUid) continue;
    if (!t.faceEnrollment?.descriptor?.length) continue;
    const dist = faceapi.euclideanDistance(
      new Float32Array(t.faceEnrollment.descriptor),
      normalizedInput
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = t;
    }
  }

  if (bestMatch && bestDist < ENROLL_DUPLICATE_THRESHOLD) return bestMatch;
  return null;
}

function FaceEnrollmentModal({ isOpen, onClose, teacher, onSave, teachers = [] }) {
  const { videoRef, modelsReady, loadingModels, error, startCamera, stopCamera, captureDescriptor } = useFaceRecognition(isOpen);
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [duplicateError, setDuplicateError] = useState(null);
  const [faceBox, setFaceBox] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const containerRef = useRef(null);
  const detectLoopRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    setPreviewUrl("");
    setSaving(false);
    setEnrolled(false);
    setDuplicateError(null);
    setFaceBox(null);
    setFaceDetected(false);
    startCamera();
    return () => {
      stopCamera();
      if (detectLoopRef.current) cancelAnimationFrame(detectLoopRef.current);
    };
  }, [isOpen]);

  const [liveMatchName, setLiveMatchName] = useState(null);

  useEffect(() => {
    if (!modelsReady || !isOpen || enrolled || saving) {
      setFaceBox(null);
      setFaceDetected(false);
      setLiveMatchName(null);
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
          setFaceBox({
            x: box.x * sx,
            y: box.y * sy,
            w: box.width * sx,
            h: box.height * sy,
          });
          setFaceDetected(true);

          const dup = findDuplicateFace(result.descriptor, teachers, teacher.uid);
          setLiveMatchName(dup ? dup.fullName : null);
        } else {
          setFaceBox(null);
          setFaceDetected(false);
          setLiveMatchName(null);
        }
      } catch {
        /* detection frame skipped */
      }

      if (active) {
        detectLoopRef.current = requestAnimationFrame(() => setTimeout(detect, 250));
      }
    }

    detect();
    return () => {
      active = false;
      if (detectLoopRef.current) cancelAnimationFrame(detectLoopRef.current);
    };
  }, [modelsReady, isOpen, enrolled, saving, teachers]);

  if (!isOpen || !teacher) return null;

  async function handleCapture() {
    try {
      setSaving(true);
      setDuplicateError(null);
      const capture = await captureDescriptor({
        sampleCount: 3,
        sampleDelayMs: 120,
        noFaceMessage: "No face detected. Keep one face in frame."
      });
      setPreviewUrl(capture.previewUrl);

      const dup = findDuplicateFace(capture.descriptor, teachers, teacher.uid);
      if (dup) {
        setDuplicateError(dup.fullName);
        toast.error(`This face is already enrolled as ${dup.fullName}.`);
        return;
      }

      const saved = await onSave(teacher, capture.descriptor);
      if (saved) setEnrolled(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={enrolled ? "Enrollment Complete" : `Enroll Face — ${teacher.fullName}`} onClose={onClose}>
      <div className="space-y-5">

        {enrolled ? (
          <div className="flex flex-col items-center gap-4 py-4">
            {previewUrl && (
              <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-emerald-400 shadow-lg">
                <img src={previewUrl} alt="Enrolled" className="h-full w-full object-cover" />
              </div>
            )}
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-surface-900">{teacher.fullName}</p>
              <p className="mt-1 text-sm font-semibold text-emerald-600">Enrolled successfully</p>
            </div>
            <Button className="mt-2" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <>
            <div ref={containerRef} className="relative overflow-hidden rounded-2xl border border-surface-200 bg-slate-950">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="aspect-[4/3] w-full object-cover"
              />

              {/* Live face tracking box */}
              {faceBox && !saving && (
                <div
                  className={`pointer-events-none absolute rounded-lg transition-all duration-150 ease-out border-2 ${
                    liveMatchName ? "border-red-400" : "border-emerald-400"
                  }`}
                  style={{
                    left: faceBox.x,
                    top: faceBox.y,
                    width: faceBox.w,
                    height: faceBox.h,
                    boxShadow: liveMatchName
                      ? "0 0 14px rgba(239,68,68,0.35), inset 0 0 14px rgba(239,68,68,0.08)"
                      : "0 0 12px rgba(34,197,94,0.3), inset 0 0 12px rgba(34,197,94,0.08)",
                  }}
                >
                  <span className={`absolute -left-[2px] -top-[2px] h-4 w-4 border-l-[3px] border-t-[3px] rounded-tl-md ${liveMatchName ? "border-red-400" : "border-emerald-400"}`} />
                  <span className={`absolute -right-[2px] -top-[2px] h-4 w-4 border-r-[3px] border-t-[3px] rounded-tr-md ${liveMatchName ? "border-red-400" : "border-emerald-400"}`} />
                  <span className={`absolute -bottom-[2px] -left-[2px] h-4 w-4 border-b-[3px] border-l-[3px] rounded-bl-md ${liveMatchName ? "border-red-400" : "border-emerald-400"}`} />
                  <span className={`absolute -bottom-[2px] -right-[2px] h-4 w-4 border-b-[3px] border-r-[3px] rounded-br-md ${liveMatchName ? "border-red-400" : "border-emerald-400"}`} />

                  {/* Name label above the box */}
                  {liveMatchName && (
                    <span className="absolute -top-7 left-0 rounded-md bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm whitespace-nowrap">
                      {liveMatchName}
                    </span>
                  )}

                  {/* Scan line */}
                  {!liveMatchName && (
                    <div
                      className="face-scan-line absolute left-1 right-1 h-[2px] rounded-full"
                      style={{ background: "linear-gradient(90deg, transparent, rgba(34,197,94,0.6), transparent)" }}
                    />
                  )}
                </div>
              )}

              {/* Status bar */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/80 to-transparent px-4 pb-3 pt-10">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${
                    liveMatchName ? "bg-red-400 animate-pulse"
                      : faceDetected ? "bg-emerald-400 animate-pulse"
                        : "bg-amber-400"
                  }`} />
                  <span className="text-xs font-semibold text-white/90">
                    {saving
                      ? "Scanning..."
                      : liveMatchName
                        ? `Already enrolled as ${liveMatchName}`
                        : faceDetected
                          ? "Face detected"
                          : "No face — move closer"}
                  </span>
                </div>
                {faceDetected && !saving && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    liveMatchName
                      ? "bg-red-500/20 text-red-300"
                      : "bg-emerald-500/20 text-emerald-300"
                  }`}>
                    {liveMatchName ? "DUPLICATE" : "TRACKING"}
                  </span>
                )}
              </div>

              {saving && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/30">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 rounded-full border-[3px] border-emerald-400/30 border-t-emerald-400 animate-spin" />
                    <p className="text-xs font-semibold text-white">Capturing face data...</p>
                  </div>
                </div>
              )}
            </div>

            {loadingModels && <Spinner label="Loading face models..." />}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {duplicateError && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-red-800">Duplicate face detected</p>
                  <p className="mt-0.5 text-sm text-red-700">
                    This face is already enrolled as <span className="font-bold">{duplicateError}</span>. Each person can only be enrolled under one account.
                  </p>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              disabled={!modelsReady || saving}
              onClick={handleCapture}
            >
              {saving
                ? <Spinner label="Scanning..." size="sm" />
                : duplicateError
                  ? "Try Again"
                  : "Capture Face"}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function StudentRegistryPage() {
  const { user } = useAuth();
  const { data, loading, saveTeacher, saveTeacherFace, deleteTeacherFace } = useAppData();
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [enrollmentTeacher, setEnrollmentTeacher] = useState(null);
  const [search, setSearch] = useState("");

  if (loading || !data) return <Spinner label="Loading registry..." />;

  if (user.role !== "admin") {
    return (
      <Card className="p-6">
        <h1 className="text-xl font-bold text-surface-900">Teacher Registry</h1>
        <p className="mt-2 text-sm text-surface-500">Only school admins can manage teacher records.</p>
      </Card>
    );
  }

  const allTeachers = data.teachers ?? [];
  const enrolled = allTeachers.filter((t) => t.faceEnrollment?.descriptor?.length).length;
  const teachers = search.trim()
    ? allTeachers.filter((t) =>
        t.fullName.toLowerCase().includes(search.toLowerCase()) ||
        t.staffId.toLowerCase().includes(search.toLowerCase()) ||
        t.subjectSpecialty.toLowerCase().includes(search.toLowerCase())
      )
    : allTeachers;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-surface-900">Teacher Registry</h1>
          <p className="mt-0.5 text-sm text-surface-500">
            {allTeachers.length} registered &middot; {enrolled} face enrolled
          </p>
        </div>
        <Button onClick={() => { setEditingTeacher(null); setTeacherModalOpen(true); }}>
          + Add Teacher
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 rounded-[0.625rem] border border-[var(--color-border)] bg-white px-3 focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_3px_var(--color-primary-glow)]">
        <svg className="h-4 w-4 shrink-0 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          className="w-full border-0 bg-transparent py-2.5 text-sm text-surface-900 outline-none placeholder:text-surface-400"
          placeholder="Search by name, ID, or subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Teacher cards */}
      {teachers.length === 0 ? (
        <Card className="px-6 py-12 text-center">
          <p className="text-sm text-surface-500">{search ? "No teachers match your search." : "No teachers registered yet."}</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {teachers.map((teacher, i) => {
            const hasEnrollment = Boolean(teacher.faceEnrollment?.descriptor?.length);
            return (
              <motion.div
                key={teacher.uid}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
              >
                <Card className="flex flex-col p-4">
                  {/* Top row: avatar + info + status */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-600">
                      {initials(teacher.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-surface-900">{teacher.fullName}</p>
                      <p className="truncate text-xs text-surface-500">{teacher.title} &middot; {teacher.subjectSpecialty}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      hasEnrollment
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}>
                      {hasEnrollment ? "Enrolled" : "Pending"}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-surface-200 pt-3 text-xs">
                    <div>
                      <span className="text-surface-500">Staff ID</span>
                      <p className="font-medium text-surface-800">{teacher.staffId}</p>
                    </div>
                    <div>
                      <span className="text-surface-500">Grades</span>
                      <p className="font-medium text-surface-800">{teacher.assignedGrades}</p>
                    </div>
                    {teacher.email && (
                      <div className="col-span-2">
                        <span className="text-surface-500">Email</span>
                        <p className="truncate font-medium text-surface-800">{teacher.email}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex items-center gap-2 border-t border-surface-200 pt-3">
                    <button
                      type="button"
                      onClick={() => { setEditingTeacher(teacher); setTeacherModalOpen(true); }}
                      className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-semibold text-surface-700 transition hover:bg-surface-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnrollmentTeacher(teacher)}
                      className="rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-600"
                    >
                      {hasEnrollment ? "Re-Enroll" : "Enroll Face"}
                    </button>
                    {hasEnrollment && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(`Delete face data for ${teacher.fullName}?`)) await deleteTeacherFace(teacher);
                        }}
                        className="ml-auto rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Delete Face
                      </button>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <TeacherFormModal isOpen={teacherModalOpen} onClose={() => setTeacherModalOpen(false)} teacher={editingTeacher} onSave={saveTeacher} />
      <FaceEnrollmentModal isOpen={Boolean(enrollmentTeacher)} onClose={() => setEnrollmentTeacher(null)} teacher={enrollmentTeacher} onSave={saveTeacherFace} teachers={allTeachers} />
    </div>
  );
}
