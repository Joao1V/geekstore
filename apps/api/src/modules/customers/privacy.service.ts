import { prisma } from '@geekstore/db';
import type { CustomerDataExport, CustomerDeleteBody } from '@geekstore/shared';

import { BadRequestError, NotFoundError } from '../../core/_errors';

/**
 * Cópia dos dados da pessoa (LGPD, RF-CLI-07): o que guardamos sobre ela, em formato legível por
 * máquina. Não inclui a senha (guardamos só o hash) nem dados de cartão (nunca passam por aqui).
 */
export async function exportCustomerData(customerId: string): Promise<CustomerDataExport> {
  const customer = await prisma.customer.findUnique({
    where: { customer_id: customerId },
    include: {
      addresses: { orderBy: { created_at: 'asc' } },
      orders: {
        orderBy: { created_at: 'asc' },
        include: { items: true, payments: true, shipments: true },
      },
    },
  });
  if (!customer) throw new NotFoundError('Conta não encontrada.');
  return {
    generated_at: new Date().toISOString(),
    customer: {
      email: customer.email,
      name: customer.name,
      document: customer.document,
      phone: customer.phone,
      has_google_login: customer.google_sub !== null,
      created_at: customer.created_at.toISOString(),
    },
    addresses: customer.addresses.map(({ customer_id: _owner, address_id: _id, ...address }) => ({
      ...address,
    })),
    orders: customer.orders.map((order) => ({
      number: order.number,
      created_at: order.created_at.toISOString(),
      status: order.status,
      payment_status: order.payment_status,
      fulfillment_status: order.fulfillment_status,
      subtotal_cents: order.subtotal_cents,
      shipping_cents: order.shipping_cents,
      discount_cents: order.discount_cents,
      total_cents: order.total_cents,
      shipping_service: order.shipping_service,
      shipping_address: order.shipping_address,
      contact: {
        name: order.contact_name,
        email: order.contact_email,
        phone: order.contact_phone,
        document: order.contact_document,
      },
      items: order.items.map((item) => ({
        sku_code: item.sku_code,
        name: item.name,
        variant: item.variant,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
      })),
      payments: order.payments.map((payment) => ({
        method: payment.method,
        status: payment.status,
        amount_cents: payment.amount_cents,
      })),
      shipments: order.shipments.map((shipment) => ({
        carrier: shipment.carrier,
        tracking_code: shipment.tracking_code,
        status: shipment.status,
      })),
    })),
  };
}

/**
 * Exclui a conta (LGPD, RF-CLI-07): some o cadastro, os endereços, as sessões e os links de senha.
 * Os pedidos já feitos ficam: a lei fiscal obriga a guardar a nota e os dados da venda por 5 anos. Eles
 * deixam de apontar para a conta (o vínculo é desfeito) e só a equipe os enxerga.
 */
export async function deleteCustomerAccount(
  customerId: string,
  body: CustomerDeleteBody
): Promise<void> {
  const customer = await prisma.customer.findUnique({ where: { customer_id: customerId } });
  if (!customer) throw new NotFoundError('Conta não encontrada.');
  if (customer.email.toLowerCase() !== body.confirm_email) {
    throw new BadRequestError('O e-mail digitado não é o da conta.');
  }
  await prisma.customer.delete({ where: { customer_id: customerId } });
}
