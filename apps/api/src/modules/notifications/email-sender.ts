import { envConfig } from '../../core/config/env';

export type EmailMessageInput = { to: string; subject: string; html: string; text: string };
export type EmailSender = {
  readonly name: string;
  /** Devolve o id da mensagem no provedor, quando houver. */
  send(message: EmailMessageInput): Promise<{ id: string | null }>;
};

const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10_000;

/** Só registra no console: para desenvolver sem provedor de e-mail. */
export const logEmailSender: EmailSender = {
  name: 'log',
  async send(message) {
    console.info(`[email] para ${message.to}: ${message.subject}`);
    return { id: null };
  },
};

export function createResendSender(apiKey: string, from: string): EmailSender {
  return {
    name: 'resend',
    async send(message) {
      const response = await fetch(RESEND_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Resend respondeu ${response.status}: ${detail.slice(0, 200)}`);
      }
      const body = (await response.json()) as { id?: string };
      return { id: body.id ?? null };
    },
  };
}

export function getEmailSender(): EmailSender {
  const { PROVIDER, RESEND_API_KEY, FROM } = envConfig.email;
  return PROVIDER === 'resend' && RESEND_API_KEY
    ? createResendSender(RESEND_API_KEY, FROM)
    : logEmailSender;
}
