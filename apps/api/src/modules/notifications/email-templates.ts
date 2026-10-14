export type OrderMailData = {
  number: number;
  contactName: string;
  totalCents: number;
  storeUrl: string;
  orderUrl: string;
  items: Array<{ name: string; variant: string | null; quantity: number; totalCents: number }>;
  shippingService: string;
  /** Pix ou boleto pendente: o que a pessoa precisa para pagar. */
  payment: {
    method: 'pix' | 'card' | 'boleto';
    code: string | null;
    boletoUrl: string | null;
  } | null;
  tracking: { carrier: string; code: string | null } | null;
  cancelReason: string | null;
  pickup: boolean;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const brl = (cents: number): string =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const itemsText = (data: OrderMailData): string =>
  data.items
    .map(
      (item) =>
        `- ${item.quantity}x ${item.name}${item.variant ? ` (${item.variant})` : ''}: ${brl(item.totalCents)}`
    )
    .join('\n');

function layout(title: string, bodyHtml: string, data: OrderMailData): string {
  const rows = data.items
    .map(
      (item) =>
        `<tr><td style="padding:4px 0">${item.quantity}x ${escapeHtml(item.name)}${
          item.variant ? ` <small>(${escapeHtml(item.variant)})</small>` : ''
        }</td><td style="padding:4px 0;text-align:right">${brl(item.totalCents)}</td></tr>`
    )
    .join('');
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f3ef;font-family:Arial,sans-serif;color:#151518">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:24px;font-weight:900;margin:0 0 16px"><span style="color:#ffbd08">Geek</span>Store</p>
<div style="background:#fff;border-radius:12px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
${bodyHtml}
<table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">${rows}
<tr><td style="padding-top:8px;border-top:1px solid #deddd6"><strong>Total</strong></td><td style="padding-top:8px;border-top:1px solid #deddd6;text-align:right"><strong>${brl(data.totalCents)}</strong></td></tr></table>
<p style="margin:20px 0 0"><a href="${escapeHtml(data.orderUrl)}" style="background:#ffbd08;color:#111;text-decoration:none;font-weight:900;padding:12px 18px;border-radius:10px;display:inline-block">Acompanhar o pedido</a></p>
</div>
<p style="font-size:12px;color:#606068;margin-top:16px">GeekStore · <a href="${escapeHtml(data.storeUrl)}" style="color:#606068">${escapeHtml(data.storeUrl)}</a></p>
</div></body></html>`;
}

function build(
  data: OrderMailData,
  subject: string,
  title: string,
  paragraphs: string[]
): RenderedEmail {
  const html = layout(
    title,
    paragraphs
      .map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${p}</p>`)
      .join(''),
    data
  );
  const text = `${title}\n\n${paragraphs
    .map((p) => p.replace(/<[^>]+>/g, ''))
    .join(
      '\n\n'
    )}\n\n${itemsText(data)}\nTotal: ${brl(data.totalCents)}\n\nAcompanhe: ${data.orderUrl}\n`;
  return { subject, html, text };
}

const first = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** Recebemos o pedido e falta pagar (Pix ou boleto). Pedido já pago não usa este modelo. */
export function orderAwaitingPayment(data: OrderMailData): RenderedEmail {
  const pay = data.payment;
  const how =
    pay?.method === 'boleto'
      ? `Pague o boleto${pay.boletoUrl ? ` (<a href="${escapeHtml(pay.boletoUrl)}">abrir boleto</a>)` : ''}. Linha digitável: <code>${escapeHtml(pay.code ?? '')}</code>`
      : `Pague com Pix copia e cola: <code style="word-break:break-all">${escapeHtml(pay?.code ?? '')}</code>`;
  return build(
    data,
    `Pedido #${data.number}: falta só o pagamento`,
    `Falta só o pagamento, ${first(data.contactName)}`,
    [`Recebemos o seu pedido #${data.number} e reservamos os itens por tempo limitado.`, how]
  );
}

export function orderPaid(data: OrderMailData): RenderedEmail {
  return build(data, `Pagamento confirmado: pedido #${data.number}`, 'Pagamento confirmado!', [
    `Obrigado, ${escapeHtml(first(data.contactName))}! O pagamento do pedido #${data.number} foi confirmado.`,
    data.pickup
      ? 'Avisaremos quando ele estiver pronto para retirada na loja.'
      : `Vamos separar e enviar por <strong>${escapeHtml(data.shippingService)}</strong>. Você recebe o código de rastreio assim que sair.`,
  ]);
}

export function orderShipped(data: OrderMailData): RenderedEmail {
  const code = data.tracking?.code
    ? `Código de rastreio: <strong>${escapeHtml(data.tracking.code)}</strong>.`
    : 'Esta entrega não tem código de rastreio.';
  return build(data, `Pedido #${data.number} enviado`, 'Seu pedido está a caminho', [
    `O pedido #${data.number} foi enviado${data.tracking ? ` por ${escapeHtml(data.tracking.carrier)}` : ''}.`,
    code,
  ]);
}

export function orderDelivered(data: OrderMailData): RenderedEmail {
  return build(data, `Pedido #${data.number} entregue`, 'Pedido entregue', [
    `O pedido #${data.number} foi marcado como entregue. Esperamos que a coleção cresça!`,
    'Se algo não saiu como esperado, é só responder este e-mail.',
  ]);
}

export function orderCancelled(data: OrderMailData): RenderedEmail {
  return build(data, `Pedido #${data.number} cancelado`, 'Pedido cancelado', [
    `O pedido #${data.number} foi cancelado${data.cancelReason ? `: ${escapeHtml(data.cancelReason)}` : ''}.`,
    'Se você já pagou, o estorno é tratado pela nossa equipe. Qualquer dúvida, responda este e-mail.',
  ]);
}

export function orderRefunded(data: OrderMailData, refundCents: number): RenderedEmail {
  return build(data, `Estorno do pedido #${data.number}`, 'Estorno realizado', [
    `Estornamos ${brl(refundCents)} do pedido #${data.number}.`,
    'O prazo para o valor aparecer depende da forma de pagamento: Pix e cartão costumam levar de 1 a 2 faturas ou alguns dias úteis.',
  ]);
}

export type DivergenceMailData = {
  rows: Array<{ code: string; field: 'on_hand' | 'reserved'; expected: number; actual: number }>;
};

/** Alerta interno: o saldo guardado não bate com o histórico de movimentações (RF-EST-10). */
export function stockDivergence(data: DivergenceMailData): RenderedEmail {
  const lines = data.rows.map(
    (row) => `${row.code}: ${row.field} deveria ser ${row.expected}, está ${row.actual}`
  );
  const subject = `Estoque divergente: ${data.rows.length} SKU(s)`;
  return {
    subject,
    text: `${subject}\n\n${lines.join('\n')}\n`,
    html: `<p>${escapeHtml(subject)}</p><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`,
  };
}

export type PasswordResetMailData = { name: string; link: string; storeUrl: string };

export function passwordReset(data: PasswordResetMailData): RenderedEmail {
  const subject = 'Redefinir sua senha da GeekStore';
  const first = data.name.trim().split(/\s+/)[0] ?? data.name;
  const text = `Olá, ${first}!\n\nRecebemos um pedido para redefinir sua senha. Use o link abaixo (vale por 1 hora):\n${data.link}\n\nSe não foi você, ignore este e-mail: nada muda na sua conta.\n`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f3ef;font-family:Arial,sans-serif;color:#151518">
<div style="max-width:560px;margin:0 auto;padding:24px"><p style="font-size:24px;font-weight:900;margin:0 0 16px"><span style="color:#ffbd08">Geek</span>Store</p>
<div style="background:#fff;border-radius:12px;padding:24px"><h1 style="font-size:20px;margin:0 0 12px">Redefinir sua senha</h1>
<p style="font-size:15px;line-height:1.5">Olá, ${escapeHtml(first)}! Recebemos um pedido para redefinir sua senha. O link vale por 1 hora.</p>
<p><a href="${escapeHtml(data.link)}" style="background:#ffbd08;color:#111;text-decoration:none;font-weight:900;padding:12px 18px;border-radius:10px;display:inline-block">Criar nova senha</a></p>
<p style="font-size:13px;color:#606068">Se não foi você, ignore este e-mail: nada muda na sua conta.</p></div></div></body></html>`;
  return { subject, html, text };
}
