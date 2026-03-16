import { motion } from "framer-motion";

const sizes = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-6 w-6 border-[3px]"
};

export function Spinner({ label = "Loading...", size = "md" }) {
  const spinnerSize = sizes[size] ?? sizes.md;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-3 text-sm text-slate-600"
    >
      <motion.span
        className={`spinner ${spinnerSize}`}
        aria-hidden="true"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      />
      <span>{label}</span>
    </motion.div>
  );
}
