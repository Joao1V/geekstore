'use client';

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';
import type { ToastNotice } from './state/cart-store';

const TOAST_DURATION_MS = 5000;

const KIND_STYLES = {
  success: { border: 'border-l-[#23844d]', icon: 'text-[#23844d] dark:text-[#63d895]' },
  warning: { border: 'border-l-[#c18412]', icon: 'text-[#c18412]' },
  info: { border: 'border-l-[#4886dd]', icon: 'text-[#4886dd]' },
};

export function StoreAlert({
  notice,
  onDismiss,
}: {
  notice: ToastNotice | null;
  onDismiss: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const kindStyles = KIND_STYLES[notice?.kind ?? 'info'];
  const Icon =
    notice?.kind === 'success' ? CircleCheck : notice?.kind === 'warning' ? CircleAlert : Info;

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  return (
    <div
      className="pointer-events-none fixed right-[max(24px,env(safe-area-inset-right))] bottom-[max(24px,env(safe-area-inset-bottom))] z-[1000] w-[min(380px,calc(100vw-32px))] max-md:right-4 max-md:bottom-[max(16px,env(safe-area-inset-bottom))] max-md:in-has-[.mobile-buy]:bottom-[90px]"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border border-l-4 border-border bg-surface px-4 py-[17px] text-foreground [box-shadow:0_8px_30px_#0002] ${kindStyles.border}`}
            role="status"
            initial={{ opacity: 0, x: reducedMotion ? 0 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reducedMotion ? 0 : 24 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
          >
            <Icon className={`shrink-0 ${kindStyles.icon}`} size={23} aria-hidden="true" />
            <p className="flex-1 text-sm leading-normal font-bold">{notice.message}</p>
            <button
              type="button"
              className="grid h-8 min-w-8 place-items-center rounded-md bg-transparent text-muted"
              aria-label="Fechar aviso"
              onClick={onDismiss}
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
