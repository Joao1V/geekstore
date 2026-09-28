'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ y: reducedMotion ? 0 : 14 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      animate={reducedMotion ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: reducedMotion ? 0 : 0.45, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
