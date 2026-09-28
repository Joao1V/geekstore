'use client';

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';
import type { ToastNotice } from './state/cart-store';

const TOAST_DURATION_MS = 5000;

export function StoreAlert({
  notice,
  onDismiss,
}: {
  notice: ToastNotice | null;
  onDismiss: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const Icon =
    notice?.kind === 'success' ? CircleCheck : notice?.kind === 'warning' ? CircleAlert : Info;

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  return (
    <div className="store-alert-region" aria-live="polite" aria-atomic="true">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            className={`store-alert store-alert-${notice.kind}`}
            role="status"
            initial={{ opacity: 0, x: reducedMotion ? 0 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reducedMotion ? 0 : 24 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
          >
            <Icon className="store-alert-icon" size={23} aria-hidden="true" />
            <p>{notice.message}</p>
            <button type="button" aria-label="Fechar aviso" onClick={onDismiss}>
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
