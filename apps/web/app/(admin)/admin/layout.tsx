import type { Metadata } from 'next';

import { ADMIN_UI_STORAGE_KEY } from '@/modules/admin/state/ui-store';

// O painel nunca é indexado (o X-Robots-Tag do proxy.ts também cobre `/admin`).
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Aplica o tema salvo antes da primeira pintura, para quem usa o escuro não ver um clarão ao
// recarregar. Texto fixo (nada vem do usuário); falha em silêncio se o localStorage estiver bloqueado.
const THEME_SCRIPT = `try{var t=JSON.parse(localStorage.getItem(${JSON.stringify(ADMIN_UI_STORAGE_KEY)})||'{}').state;if(t&&t.theme)document.documentElement.dataset.theme=t.theme}catch(e){}`;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: script estático acima, sem dados do usuário */}
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      {children}
    </div>
  );
}
