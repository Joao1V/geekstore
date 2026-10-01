import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

const DISABLE_REACT_DEV_TRACKS = process.env.NODE_ENV === 'development';

export const metadata: Metadata = {
  title: { default: 'GeekStore — Seu universo, sua coleção', template: '%s | GeekStore' },
  description:
    'Explore a nova experiência GeekStore: colecionáveis, games, roupas e RPG. Catálogo de demonstração.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <head>
        {DISABLE_REACT_DEV_TRACKS && (
          // Só em desenvolvimento. O React 19.2+ registra o diff das props no painel "Components" do
          // DevTools e esse diff percorre a coleção interna do React Aria (ListBox, ComboBox,
          // Select), cujo getter `childNodes` lança de propósito: "Uncaught Error: childNodes is
          // not supported", que aborta os efeitos seguintes e quebra a lista. O registro só liga se
          // `console.timeStamp` existir. Precisa ser inline no <head>: roda antes dos chunks do React.
          // Em produção o React não tem esse registro. Remover quando o React Aria corrigir.
          // biome-ignore lint/security/noDangerouslySetInnerHtml: literal fixo, sem entrada de usuário
          <script dangerouslySetInnerHTML={{ __html: 'console.timeStamp=undefined' }} />
        )}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bangers&family=Nunito+Sans:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
