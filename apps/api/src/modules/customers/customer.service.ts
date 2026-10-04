import { prisma } from '@geekstore/db';
import type {
  Address,
  AddressBody,
  AddressUpdateBody,
  Customer,
  CustomerUpdateBody,
} from '@geekstore/shared';

import { BadRequestError, NotFoundError } from '../../core/_errors';
import { toCustomer } from './customer-auth.service';

const MAX_ADDRESSES = 10;

type AddressRow = Awaited<ReturnType<typeof prisma.address.findMany>>[number];

const toAddress = (row: AddressRow): Address => ({
  address_id: row.address_id,
  recipient: row.recipient,
  zip: row.zip,
  street: row.street,
  number: row.number,
  complement: row.complement,
  neighborhood: row.neighborhood,
  city: row.city,
  state: row.state,
  is_default: row.is_default,
});

export async function getCustomer(customerId: string): Promise<Customer> {
  const row = await prisma.customer.findUnique({ where: { customer_id: customerId } });
  if (!row) throw new NotFoundError('Conta não encontrada.');
  return toCustomer(row);
}

export async function updateCustomer(
  customerId: string,
  body: CustomerUpdateBody
): Promise<Customer> {
  const row = await prisma.customer.update({
    where: { customer_id: customerId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.document !== undefined ? { document: body.document } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
    },
  });
  return toCustomer(row);
}

export async function listAddresses(customerId: string): Promise<Address[]> {
  const rows = await prisma.address.findMany({
    where: { customer_id: customerId },
    orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
  });
  return rows.map(toAddress);
}

export async function createAddress(customerId: string, body: AddressBody): Promise<Address> {
  return prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { customer_id: customerId } });
    if (count >= MAX_ADDRESSES) {
      throw new BadRequestError(`Você pode ter até ${MAX_ADDRESSES} endereços.`);
    }
    // O primeiro endereço é sempre o padrão.
    const makeDefault = body.is_default || count === 0;
    if (makeDefault) {
      await tx.address.updateMany({
        where: { customer_id: customerId },
        data: { is_default: false },
      });
    }
    const row = await tx.address.create({
      data: {
        customer_id: customerId,
        recipient: body.recipient,
        zip: body.zip,
        street: body.street,
        number: body.number,
        complement: body.complement ?? null,
        neighborhood: body.neighborhood,
        city: body.city,
        state: body.state,
        is_default: makeDefault,
      },
    });
    return toAddress(row);
  });
}

async function ownedAddress(customerId: string, addressId: string): Promise<AddressRow> {
  const row = await prisma.address.findFirst({
    where: { address_id: addressId, customer_id: customerId },
  });
  // Endereço de outra pessoa responde igual a inexistente.
  if (!row) throw new NotFoundError('Endereço não encontrado.');
  return row;
}

export async function updateAddress(
  customerId: string,
  addressId: string,
  body: AddressUpdateBody
): Promise<Address> {
  await ownedAddress(customerId, addressId);
  return prisma.$transaction(async (tx) => {
    if (body.is_default) {
      await tx.address.updateMany({
        where: { customer_id: customerId },
        data: { is_default: false },
      });
    }
    const { is_default, complement, ...rest } = body;
    const row = await tx.address.update({
      where: { address_id: addressId },
      data: {
        ...rest,
        ...(complement !== undefined ? { complement } : {}),
        ...(is_default !== undefined ? { is_default } : {}),
      },
    });
    return toAddress(row);
  });
}

export async function deleteAddress(customerId: string, addressId: string): Promise<void> {
  const address = await ownedAddress(customerId, addressId);
  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { address_id: addressId } });
    if (address.is_default) {
      // Apagou o padrão: o endereço mais antigo que sobrou assume.
      const next = await tx.address.findFirst({
        where: { customer_id: customerId },
        orderBy: { created_at: 'asc' },
      });
      if (next)
        await tx.address.update({
          where: { address_id: next.address_id },
          data: { is_default: true },
        });
    }
  });
}
