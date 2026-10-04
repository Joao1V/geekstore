import type {
  ReceiptImportBody,
  ReceiptItemUpdateBody,
  ReceiptListQuery,
  ReceiptManualBody,
} from '@geekstore/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  createManualReceipt,
  deleteReceipt,
  getReceipt,
  importReceiptXml,
  listReceipts,
  postReceipt,
  suggestForItem,
  updateReceiptItem,
} from './receipt.service';

type ReceiptParams = { receipt_id: string };
type ItemParams = ReceiptParams & { item_id: string };

export async function listReceiptsController(
  request: FastifyRequest<{ Querystring: ReceiptListQuery }>
) {
  return listReceipts(request.query);
}

export async function getReceiptController(request: FastifyRequest<{ Params: ReceiptParams }>) {
  return { data: await getReceipt(request.params.receipt_id) };
}

export async function importReceiptController(
  request: FastifyRequest<{ Body: ReceiptImportBody }>,
  reply: FastifyReply
) {
  const data = await importReceiptXml(request.user.sub, request.body);
  return reply.status(201).send({ data });
}

export async function createManualReceiptController(
  request: FastifyRequest<{ Body: ReceiptManualBody }>,
  reply: FastifyReply
) {
  const data = await createManualReceipt(request.user.sub, request.body);
  return reply.status(201).send({ data });
}

export async function updateReceiptItemController(
  request: FastifyRequest<{ Params: ItemParams; Body: ReceiptItemUpdateBody }>
) {
  const { receipt_id, item_id } = request.params;
  return { data: await updateReceiptItem(request.user.sub, receipt_id, item_id, request.body) };
}

export async function suggestionsController(request: FastifyRequest<{ Params: ItemParams }>) {
  const { receipt_id, item_id } = request.params;
  return { data: await suggestForItem(receipt_id, item_id) };
}

export async function postReceiptController(request: FastifyRequest<{ Params: ReceiptParams }>) {
  return { data: await postReceipt(request.user.sub, request.params.receipt_id) };
}

export async function deleteReceiptController(
  request: FastifyRequest<{ Params: ReceiptParams }>,
  reply: FastifyReply
) {
  await deleteReceipt(request.user.sub, request.params.receipt_id);
  return reply.status(204).send();
}
