'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

import { Action } from '@/components/ui';
import {
  ANALYTICS_ENABLED,
  consentChoice,
  GA4_ID,
  META_PIXEL_ID,
  saveConsent,
} from '@/lib/analytics';

const CONSENT_EVENT = 'geekstore:consent';

/** Carrega GA4 e Meta Pixel só depois do "aceitar" e só se os IDs existirem (LGPD, RNF-08). */
export function Analytics() {
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    const read = () => setGranted(consentChoice() === 'granted');
    read();
    window.addEventListener(CONSENT_EVENT, read);
    return () => window.removeEventListener(CONSENT_EVENT, read);
  }, []);

  if (!ANALYTICS_ENABLED || !granted) return null;
  return (
    <>
      {GA4_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};gtag('js',new Date());gtag('config','${GA4_ID}');`}
          </Script>
        </>
      )}
      {META_PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}

/** Aviso de cookies de medição. Só aparece se há o que medir e a pessoa ainda não escolheu. */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(ANALYTICS_ENABLED && consentChoice() === null);
  }, []);

  if (!visible) return null;
  const choose = (granted: boolean) => {
    saveConsent(granted);
    window.dispatchEvent(new Event(CONSENT_EVENT));
    setVisible(false);
  };
  return (
    <aside
      aria-label="Cookies"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-sm [box-shadow:0_8px_30px_rgba(0,0,0,0.18)]"
    >
      <p className="m-0 flex-1 basis-72">
        Usamos cookies de medição (Google Analytics e Meta) para entender o que funciona na loja.
        Você escolhe se permite.
      </p>
      <div className="flex gap-2">
        <Action className="action-outline" onPress={() => choose(false)}>
          Recusar
        </Action>
        <Action onPress={() => choose(true)}>Aceitar</Action>
      </div>
    </aside>
  );
}
