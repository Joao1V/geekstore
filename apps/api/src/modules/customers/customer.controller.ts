import type {
  AddressBody,
  AddressUpdateBody,
  CustomerLoginBody,
  CustomerRegisterBody,
  CustomerSession,
  CustomerUpdateBody,
} from '@geekstore/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { UnauthorizedError } from '../../core/_errors';
import { envConfig } from '../../core/config';
import {
  createAddress,
  deleteAddress,
  getCustomer,
  listAddresses,
  updateAddress,
  updateCustomer,
} from './customer.service';
import {
  createCustomerSession,
  registerCustomer,
  revokeCustomerRefreshToken,
  rotateCustomerRefreshToken,
  verifyCustomerCredentials,
} from './customer-auth.service';
import { requireCustomerId, signCustomerToken } from './customer-token';

const REFRESH_COOKIE = 'geekstore_customer_refresh';
const COOKIE_PATH = '/api/customer/auth';

function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: envConfig.server.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: COOKIE_PATH,
    expires: expiresAt,
    signed: true,
  };
}

function readRefreshCookie(request: FastifyRequest): string {
  const raw = request.cookies[REFRESH_COOKIE];
  const unsigned = raw ? request.unsignCookie(raw) : null;
  if (!unsigned?.valid || !unsigned.value) throw new UnauthorizedError('Sessão inválida.');
  return unsigned.value;
}

async function startSession(
  request: FastifyRequest,
  reply: FastifyReply,
  customer: CustomerSession['customer'],
  status = 200
) {
  const { token, expiresAt } = await createCustomerSession(customer.customer_id);
  reply.setCookie(REFRESH_COOKIE, token, cookieOptions(expiresAt));
  const session: CustomerSession = {
    access_token: signCustomerToken(request, customer.customer_id),
    customer,
  };
  return reply.status(status).send({ data: session });
}

export async function registerController(
  request: FastifyRequest<{ Body: CustomerRegisterBody }>,
  reply: FastifyReply
) {
  const customer = await registerCustomer(request.body);
  return startSession(request, reply, customer, 201);
}

export async function loginController(
  request: FastifyRequest<{ Body: CustomerLoginBody }>,
  reply: FastifyReply
) {
  return startSession(request, reply, await verifyCustomerCredentials(request.body));
}

export async function refreshController(request: FastifyRequest, reply: FastifyReply) {
  const { token, expiresAt, customer } = await rotateCustomerRefreshToken(
    readRefreshCookie(request)
  );
  reply.setCookie(REFRESH_COOKIE, token, cookieOptions(expiresAt));
  const session: CustomerSession = {
    access_token: signCustomerToken(request, customer.customer_id),
    customer,
  };
  return reply.send({ data: session });
}

export async function logoutController(request: FastifyRequest, reply: FastifyReply) {
  const raw = request.cookies[REFRESH_COOKIE];
  const unsigned = raw ? request.unsignCookie(raw) : null;
  if (unsigned?.valid && unsigned.value) await revokeCustomerRefreshToken(unsigned.value);
  reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  return reply.status(204).send();
}

export async function meController(request: FastifyRequest) {
  return { data: await getCustomer(requireCustomerId(request)) };
}

export async function updateMeController(request: FastifyRequest<{ Body: CustomerUpdateBody }>) {
  return { data: await updateCustomer(requireCustomerId(request), request.body) };
}

export async function listAddressesController(request: FastifyRequest) {
  return { data: await listAddresses(requireCustomerId(request)) };
}

export async function createAddressController(
  request: FastifyRequest<{ Body: AddressBody }>,
  reply: FastifyReply
) {
  const data = await createAddress(requireCustomerId(request), request.body);
  return reply.status(201).send({ data });
}

export async function updateAddressController(
  request: FastifyRequest<{ Params: { address_id: string }; Body: AddressUpdateBody }>
) {
  const data = await updateAddress(
    requireCustomerId(request),
    request.params.address_id,
    request.body
  );
  return { data };
}

export async function deleteAddressController(
  request: FastifyRequest<{ Params: { address_id: string } }>,
  reply: FastifyReply
) {
  await deleteAddress(requireCustomerId(request), request.params.address_id);
  return reply.status(204).send();
}
