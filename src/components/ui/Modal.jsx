import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Modal({ children, onClose, title }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/40 backdrop-blur-sm p-4"
        onClick={onClose}
        role="presentation"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="card-surface max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <h3 className="text-lg font-bold text-surface-900">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm font-medium text-surface-600 transition hover:bg-surface-50 hover:text-surface-900"
            >
              Close
            </button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
