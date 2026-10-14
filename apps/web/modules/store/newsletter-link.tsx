'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Action } from '@/components/ui';
import { getErrorMessage } from './lib/errors';
import { useConfirmNewsletter, useUnsubscribeNewsletter } from './services/engagement/mutations';

type Mode = 'confirm' | 'unsubscribe';

const COPY: Record<Mode, { title: string; text: string; button: string; done: string }> = {
  confirm: {
    title: 'Confirmar inscrição',
    text: 'Clique para confirmar que você quer receber as novidades e ofertas da GeekStore.',
    button: 'Confirmar inscrição',
    done: 'Inscrição confirmada! Você vai receber as novidades da GeekStore.',
  },
  unsubscribe: {
    title: 'Cancelar inscrição',
    text: 'Tem certeza de que não quer mais receber a newsletter da GeekStore?',
    button: 'Cancelar inscrição',
    done: 'Pronto, você não receberá mais a newsletter. Sentiremos sua falta!',
  },
};

/** Página do link do e-mail da newsletter (confirmar ou cancelar). Pede um clique: scanners de e-mail não confirmam sozinhos. */
export function NewsletterLink({ mode }: { mode: Mode }) {
  const token = useSearchParams().get('token') ?? '';
  const confirm = useConfirmNewsletter();
  const unsubscribe = useUnsubscribeNewsletter();
  const action = mode === 'confirm' ? confirm : unsubscribe;
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const copy = COPY[mode];

  const run = async () => {
    setError('');
    try {
      await action.mutateAsync(token);
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <section className="wrap section mx-auto max-w-[560px] text-center">
      <MailCheck className="mx-auto mb-3" size={40} aria-hidden="true" />
      <h1 className="section-title">{copy.title}</h1>
      {done ? (
        <p role="status" className="notice p-4 text-sm">
          {copy.done}
        </p>
      ) : !token ? (
        <p role="alert" className="error">
          Este link está incompleto.
        </p>
      ) : (
        <>
          <p className="muted text-sm">{copy.text}</p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Action onPress={run} disabled={action.isPending}>
            {action.isPending ? 'Enviando…' : copy.button}
          </Action>
        </>
      )}
      <p className="mt-6">
        <Link className="orange" href="/">
          Voltar para a loja
        </Link>
      </p>
    </section>
  );
}
