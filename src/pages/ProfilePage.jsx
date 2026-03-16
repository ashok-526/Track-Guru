import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function ProfilePage() {
  const { user } = useAuth();
  const { data, loading, updateProfile } = useAppData();
  const [form, setForm] = useState({
    fullName: user.fullName,
    email: user.email,
    phone: user.phone ?? "",
  });
  const [saving, setSaving] = useState(false);

  if (loading || !data) return <Spinner label="Loading profile..." />;

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    try { await updateProfile(form); } finally { setSaving(false); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 text-xl font-bold text-primary-600">
              {initials(user.fullName)}
            </div>
            <p className="mt-4 text-lg font-bold text-surface-900">{user.fullName}</p>
            <p className="mt-1 text-sm text-surface-500">{user.staffId}</p>
            <p className="mt-1 text-sm text-surface-500">{user.title}</p>
            <p className="mt-4 rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-xs font-semibold text-primary-600">
              School Admin
            </p>
          </div>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}>
        <Card className="p-6">
          <h1 className="text-xl font-bold text-surface-900">Profile</h1>
          <p className="mt-1 text-sm text-surface-500 mb-6">Update your contact details.</p>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSave}>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Full Name</label>
              <input className="field" value={form.fullName} onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Staff ID</label>
              <input className="field" value={user.staffId} disabled />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Email</label>
              <input type="email" className="field" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Phone</label>
              <input className="field" value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Access Scope</label>
              <input className="field" value="Full school monitoring and reporting" disabled />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner label="Saving..." size="sm" /> : "Save Changes"}
              </Button>
            </div>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
