"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// A checkbox with a spring-animated checkmark and box fill/border transition
// — used anywhere a plain <input type="checkbox"> would look too bare (e.g.
// the Super Admin plan-section picker).
export function AnimatedCheckbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className="flex items-center gap-2.5 text-sm text-ink disabled:opacity-50 disabled:cursor-not-allowed group"
    >
      <motion.span
        className={cn(
          "relative flex items-center justify-center w-5 h-5 rounded-md border-2 flex-none",
          checked ? "border-amber-400 bg-amber-400" : "border-stone-300 dark:border-stone-600 group-hover:border-amber-400",
        )}
        animate={{ scale: checked ? [1, 1.15, 1] : 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <AnimatePresence>
          {checked && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="text-stone-900"
            >
              <Check size={13} strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
      {label && <span>{label}</span>}
    </button>
  );
}
