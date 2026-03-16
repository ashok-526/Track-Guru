import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { useAuth } from "../context/AuthContext";

const demoLogins = [
  { label: "School Admin", staffId: "NGA-ADM-001", password: "password123" }
];

const features = [
  { title: "Live Monitor", desc: "Start verified sessions and follow classroom activity in real time." },
  { title: "Smart Reports", desc: "Trends, flags, and compliance summaries — all in one view." },
  { title: "Face Verification", desc: "Secure session starts with built-in face recognition." },
  { title: "Teacher Registry", desc: "Manage profiles, enrollments, and assigned schedules." },
];

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export function LandingPage() {
  const { login, loading } = useAuth();
  const [form, setForm] = useState({ staffId: "", password: "" });

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await login({ staffId: form.staffId, password: form.password });
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/60 via-white to-surface-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,_rgba(0,108,196,0.12),transparent_72%)]" />

      {/* ── Navbar ── */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-30 border-b border-surface-200/60 bg-white/80 backdrop-blur-lg"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="#home" className="flex items-center">
            <img src="/logo.png" alt="Track Guru" className="h-8 object-contain" />
          </a>

          <nav className="hidden items-center gap-1 rounded-xl bg-surface-100/80 p-1 md:flex">
            {["Home", "Features", "Login"].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase()}`}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-surface-600 transition hover:bg-white hover:text-primary-500"
              >
                {label}
              </a>
            ))}
          </nav>

          <a href="#login">
            <Button className="px-5 text-sm">Get Started</Button>
          </a>
        </div>
      </motion.header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">

        {/* ── Hero ── */}
        <section id="home" className="pb-16 pt-16 md:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-2xl text-center"
          >
            <span className="mb-4 inline-flex rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-xs font-semibold text-primary-600">
              Classroom Activity Platform
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-surface-900 sm:text-5xl">
              Monitor classrooms with <span className="text-primary-500">clarity</span>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-surface-500">
              Track live sessions, verify teacher attendance, and review performance
              reports — all from one clean admin dashboard.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a href="#login"><Button className="px-6">Sign In</Button></a>
              <a href="#features"><Button variant="secondary" className="px-6">See Features</Button></a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3"
          >
            {[
              { val: "Live", sub: "Session tracking" },
              { val: "Verified", sub: "Face-matched starts" },
              { val: "Reports", sub: "Readable summaries" },
            ].map((stat) => (
              <div key={stat.val} className="rounded-2xl border border-surface-200 bg-white/80 px-5 py-4 text-center shadow-soft">
                <p className="text-xl font-extrabold text-primary-500">{stat.val}</p>
                <p className="mt-1 text-xs text-surface-500">{stat.sub}</p>
              </div>
            ))}
          </motion.div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="pb-16">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid gap-4 sm:grid-cols-2"
          >
            {features.map((f) => (
              <motion.div key={f.title} variants={fadeUp}>
                <Card className="p-6 h-full">
                  <p className="text-sm font-bold text-surface-900">{f.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-surface-500">{f.desc}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Login + Demo ── */}
        <section id="login" className="mx-auto grid max-w-4xl gap-6 pb-20 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <Card className="p-6 sm:p-8">
              <h2 className="text-xl font-bold text-surface-900">Admin Login</h2>
              <p className="mt-1 text-sm text-surface-500">Sign in to continue.</p>
              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Staff ID</label>
                  <input
                    className="field"
                    placeholder="Enter staff ID"
                    value={form.staffId}
                    onChange={(e) => setForm((c) => ({ ...c, staffId: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Password</label>
                  <input
                    type="password"
                    className="field"
                    placeholder="Enter password"
                    value={form.password}
                    onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  {loading ? <Spinner label="Signing in..." size="sm" /> : "Login"}
                </Button>
              </form>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="flex flex-col gap-4"
          >
            <Card className="flex-1 p-6">
              <p className="text-sm font-bold text-surface-900">Demo Account</p>
              <div className="mt-4 space-y-3">
                {demoLogins.map((row) => (
                  <div key={row.staffId} className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">{row.label}</p>
                    <p className="mt-2 text-sm text-surface-800">ID: <span className="font-semibold">{row.staffId}</span></p>
                    <p className="text-sm text-surface-800">Pass: <span className="font-semibold">{row.password}</span></p>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-surface-500">
                Face verification starts when you launch a live monitoring session after login.
              </p>
            </Card>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
