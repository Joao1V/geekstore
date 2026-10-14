'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const MIN_BUTTON_WIDTH = 200;
const MAX_BUTTON_WIDTH = 400; // limite do botão do Google

type GoogleId = {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
  }) => void;
  renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

type Props = {
  /** Recebe o ID token do Google; quem chama troca por sessão na API. */
  onCredential: (credential: string) => void;
  disabled?: boolean;
};

/**
 * Botão oficial "Entrar com Google" (Google Identity Services), com o separador "ou" logo abaixo.
 * Só aparece se `NEXT_PUBLIC_GOOGLE_CLIENT_ID` estiver configurado: sem ele a tela fica só com e-mail e senha.
 */
export function GoogleSignIn({ onCredential, disabled = false }: Props) {
  const slot = useRef<HTMLDivElement>(null);
  const latest = useRef(onCredential);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    latest.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    const google = window.google?.accounts.id;
    const element = slot.current;
    if (!isReady || !GOOGLE_CLIENT_ID || !google || !element) return;
    google.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: ({ credential }) => {
        if (credential) latest.current(credential);
      },
    });
    element.replaceChildren();
    google.renderButton(element, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'center',
      width: Math.min(MAX_BUTTON_WIDTH, Math.max(MIN_BUTTON_WIDTH, element.clientWidth)),
    });
  }, [isReady]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client?hl=pt-BR"
        strategy="afterInteractive"
        onReady={() => setIsReady(true)}
      />
      <div
        ref={slot}
        className={`mt-6 flex min-h-11 justify-center ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      />
      <div className="mt-5 flex items-center gap-3 text-2xs font-bold tracking-widest text-muted uppercase">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}
