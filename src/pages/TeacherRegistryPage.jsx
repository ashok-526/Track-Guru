import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Spinner } from "../components/ui/Spinner";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useFaceRecognition } from "../hooks/useFaceRecognition";

function TeacherFormModal({ isOpen, onClose, onSave, teacher }) {
  const [form, setForm] = useState({
    fullName: "",
    staffId: "",
    email: "",
    title: "",
    subjectSpecialty: "",
    assignedGrades: "",
    phone: ""
  });

  useEffect(() => {
    setForm({
      fullName: teacher?.fullName ?? "",
      staffId: teacher?.staffId ?? "",
      email: teacher?.email ?? "",
      title: teacher?.title ?? "",
      subjectSpecialty: teacher?.subjectSpecialty ?? "",
      assignedGrades: teacher?.assignedGrades ?? "",
      phone: teacher?.phone ?? ""
    });
  }, [teacher]);

  if (!isOpen) {
    return null;
  }

  return (
    <Modal title={teacher ? "Edit Teacher Profile" : "Register New Teacher"} onClose={onClose} isOpen={isOpen}>
      <form
        className="grid gap-5 md:grid-cols-2 mt-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const saved = await onSave(form, teacher);
          if (saved) {
            onClose();
          }
        }}
      >
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-brand-textDark">
            Full Name
          </label>
          <input
            className="field"
            value={form.fullName}
            onChange={(event) =>
              setForm((current) => ({ ...current, fullName: event.target.value }))
            }
            required
            placeholder="e.g. Jane Doe"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-brand-textDark">
            Staff ID
          </label>
          <input
            className="field"
            value={form.staffId}
            onChange={(event) =>
              setForm((current) => ({ ...current, staffId: event.target.value }))
            }
            required
            placeholder="e.g. TCH-001"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-brand-textDark">
            Email
          </label>
          <input
            type="email"
            className="field"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            required
            placeholder="jane@school.edu"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-brand-textDark">
            Title
          </label>
          <input
            className="field"
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="e.g. Senior Teacher"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-brand-textDark">
            Subject Specialty
          </label>
          <input
            className="field"
            value={form.subjectSpecialty}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                subjectSpecialty: event.target.value
              }))
            }
            placeholder="e.g. Mathematics"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-brand-textDark">
            Assigned Grades
          </label>
          <input
            className="field"
            value={form.assignedGrades}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                assignedGrades: event.target.value
              }))
            }
            placeholder="e.g. Grade 7, Grade 8"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-brand-textDark">
            Phone
          </label>
          <input
            className="field"
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
            required
            placeholder="+977 98..."
          />
        </div>
        <div className="md:col-span-2 mt-2">
          <Button type="submit" className="w-full sm:w-auto">
            {teacher ? "Update Teacher Profile" : "Save Teacher Profile"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function FaceEnrollmentModal({ isOpen, onClose, teacher, onSave }) {
  const {
    videoRef,
    modelsReady,
    loadingModels,
    error,
    startCamera,
    stopCamera,
    captureDescriptor
  } = useFaceRecognition(isOpen);
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    setPreviewUrl("");
    startCamera();
    return stopCamera;
  }, [isOpen]);

  if (!isOpen || !teacher) {
    return null;
  }

  return (
    <Modal title={`Enroll Teacher Face: ${teacher.fullName}`} onClose={onClose} isOpen={isOpen}>
      <div className="space-y-5 mt-4">
        <div className="overflow-hidden rounded-2xl border-2 border-brand-border bg-slate-900 shadow-inner">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
        <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4 text-sm font-medium text-brand-primary">
          Three quick captures are averaged into one face descriptor for classroom
          session verification. Please ensure good lighting.
        </div>
        {loadingModels ? <Spinner label="Loading face models..." /> : null}
        {error ? <p className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p> : null}
        {previewUrl ? (
          <div className="rounded-2xl border border-brand-border bg-brand-background p-3 shadow-sm">
            <img
              src={previewUrl}
              alt="Teacher enrollment preview"
              className="aspect-video w-full rounded-xl object-cover"
            />
          </div>
        ) : null}
        <Button
          className="w-full py-3 text-base"
          disabled={!modelsReady || saving}
          onClick={async () => {
            try {
              setSaving(true);
              const capture = await captureDescriptor({
                sampleCount: 3,
                sampleDelayMs: 120,
                noFaceMessage:
                  "No teacher face detected. Keep one face in frame and look at the camera."
              });
              setPreviewUrl(capture.previewUrl);
              const saved = await onSave(teacher, capture.descriptor);
              if (saved) {
                onClose();
              }
            } catch (error) {
              toast.error(error.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? <Spinner label="Saving enrollment..." /> : "Capture and Enroll Face"}
        </Button>
      </div>
    </Modal>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export function TeacherRegistryPage() {
  const { user } = useAuth();
  const { data, loading, saveTeacher, saveTeacherFace, deleteTeacherFace } = useAppData();
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [enrollmentTeacher, setEnrollmentTeacher] = useState(null);

  if (loading || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="Loading teacher registry..." />
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <Card className="p-8 text-center max-w-2xl mx-auto mt-10">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h1 className="text-2xl font-bold text-brand-textDark">Access Restricted</h1>
        <p className="mt-3 text-base text-brand-text">
          Only school administrators can manage teacher records and enrolled face data.
        </p>
      </Card>
    );
  }

  const teachers = data.teachers ?? [];

  return (
    <motion.div 
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-brand-border/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-brand-textDark">Teacher Registry</h1>
          <p className="mt-2 text-sm font-medium text-brand-text">
            Register teachers, keep identity records updated, and manage face data.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingTeacher(null);
            setTeacherModalOpen(true);
          }}
          className="shrink-0"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          Register Teacher
        </Button>
      </motion.div>

      <motion.div variants={itemVariants} className="grid gap-4 sm:grid-cols-3">
        <Card className="p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text">Registered Teachers</p>
          <p className="mt-2 text-4xl font-black text-brand-textDark">{teachers.length}</p>
        </Card>
        <Card className="p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text">Face Enrolled</p>
          <p className="mt-2 text-4xl font-black text-brand-primary">
            {teachers.filter((teacher) => teacher.faceEnrollment?.descriptor?.length).length}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text">Pending Enrollment</p>
          <p className="mt-2 text-4xl font-black text-amber-600">
            {teachers.filter((teacher) => !teacher.faceEnrollment?.descriptor?.length).length}
          </p>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden p-0 border-brand-border/60">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm border-collapse">
              <thead className="bg-brand-surface/50 text-[11px] font-bold uppercase tracking-wider text-brand-text border-b border-brand-border">
                <tr>
                  <th className="px-6 py-4">Teacher Profile</th>
                  <th className="px-6 py-4">Staff ID</th>
                  <th className="px-6 py-4">Subject & Grades</th>
                  <th className="px-6 py-4">Face Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/50">
                {teachers.map((teacher) => (
                  <tr key={teacher.uid} className="transition-colors hover:bg-brand-surface/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-sm border border-brand-primary/20 shrink-0">
                          {teacher.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-brand-textDark">{teacher.fullName}</p>
                          <p className="text-xs font-medium text-brand-text mt-0.5">{teacher.title}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-brand-textDark">{teacher.staffId}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-brand-textDark">{teacher.subjectSpecialty}</p>
                      <p className="text-xs text-brand-text mt-0.5">{teacher.assignedGrades}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          teacher.faceEnrollment
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {teacher.faceEnrollment ? "Enrolled" : "Pending"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="secondary"
                          className="px-3 py-1.5 text-xs min-h-0"
                          onClick={() => {
                            setEditingTeacher(teacher);
                            setTeacherModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          className="px-3 py-1.5 text-xs min-h-0"
                          onClick={() => {
                            setEnrollmentTeacher(teacher);
                          }}
                        >
                          {teacher.faceEnrollment ? "Re-Enroll" : "Enroll"}
                        </Button>
                        {teacher.faceEnrollment ? (
                          <Button
                            variant="secondary"
                            className="px-3 py-1.5 text-xs min-h-0 text-red-600 hover:bg-red-50 hover:border-red-200 hover:text-red-700"
                            onClick={async () => {
                              const confirmed = window.confirm(
                                `Delete enrolled face data for ${teacher.fullName}?`
                              );
                              if (!confirmed) {
                                return;
                              }

                              await deleteTeacherFace(teacher);
                            }}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {teachers.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-brand-text">
                      No teachers registered yet. Click "Register Teacher" to add one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>

      <TeacherFormModal
        isOpen={teacherModalOpen}
        onClose={() => setTeacherModalOpen(false)}
        teacher={editingTeacher}
        onSave={saveTeacher}
      />

      <FaceEnrollmentModal
        isOpen={Boolean(enrollmentTeacher)}
        onClose={() => setEnrollmentTeacher(null)}
        teacher={enrollmentTeacher}
        onSave={saveTeacherFace}
      />
    </motion.div>
  );
}
