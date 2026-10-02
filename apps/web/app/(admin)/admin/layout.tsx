import type { Metadata } from 'next';

// O painel nunca é indexado (o X-Robots-Tag do proxy.ts também cobre `/admin`).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
