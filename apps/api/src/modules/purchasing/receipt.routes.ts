import {
  receiptImportBodySchema,
  receiptItemParamsSchema,
  receiptItemUpdateBodySchema,
  receiptListQuerySchema,
  receiptListResponseSchema,
  receiptManualBodySchema,
  receiptParamsSchema,
  receiptResponseSchema,
  skuSuggestionListResponseSchema,
} from '@geekstore/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { requirePermission } from '../../core/hooks';
import {
  createManualReceiptController,
  deleteReceiptController,
  getReceiptController,
  importReceiptController,
  listReceiptsController,
  postReceiptController,
  suggestionsController,
  updateReceiptItemController,
} from './receipt.controller';

const tags = ['Compras'];
const read = { onRequest: requirePermission('stock:read') };
const write = { onRequest: requirePermission('stock:write') };
// O XML de uma nota grande passa de 1 MB.
const XML_BODY_LIMIT = 6 * 1024 * 1024;

export async function purchasingRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/receipts',
    {
      ...read,
      schema: {
        tags,
        summary: 'Lista as notas de entrada',
        querystring: receiptListQuerySchema,
        response: { 200: receiptListResponseSchema },
      },
    },
    listReceiptsController
  );
  app.get(
    '/receipts/:receipt_id',
    {
      ...read,
      schema: {
        tags,
        summary: 'Detalhe da nota de entrada, com os itens e o SKU ligado a cada um',
        params: receiptParamsSchema,
        response: { 200: receiptResponseSchema },
      },
    },
    getReceiptController
  );
  app.post(
    '/receipts/import',
    {
      ...write,
      bodyLimit: XML_BODY_LIMIT,
      schema: {
        tags,
        summary:
          'Importa o XML da NF-e como rascunho (liga sozinho o que o EAN ou o fornecedor já conhece)',
        body: receiptImportBodySchema,
        response: { 201: receiptResponseSchema },
      },
    },
    importReceiptController
  );
  app.post(
    '/receipts',
    {
      ...write,
      schema: {
        tags,
        summary: 'Cria um rascunho de nota sem XML, com os itens digitados',
        body: receiptManualBodySchema,
        response: { 201: receiptResponseSchema },
      },
    },
    createManualReceiptController
  );
  app.patch(
    '/receipts/:receipt_id/items/:item_id',
    {
      ...write,
      schema: {
        tags,
        summary: 'Liga o item a um SKU, ignora o item ou corrige quantidade e custo (só rascunho)',
        params: receiptItemParamsSchema,
        body: receiptItemUpdateBodySchema,
        response: { 200: receiptResponseSchema },
      },
    },
    updateReceiptItemController
  );
  app.get(
    '/receipts/:receipt_id/items/:item_id/suggestions',
    {
      ...read,
      schema: {
        tags,
        summary: 'SKUs parecidos com a descrição do item (sugestão, quem decide é a pessoa)',
        params: receiptItemParamsSchema,
        response: { 200: skuSuggestionListResponseSchema },
      },
    },
    suggestionsController
  );
  app.post(
    '/receipts/:receipt_id/post',
    {
      ...write,
      schema: {
        tags,
        summary: 'Lança a nota: gera as entradas no estoque e atualiza o custo médio',
        params: receiptParamsSchema,
        response: { 200: receiptResponseSchema },
      },
    },
    postReceiptController
  );
  app.delete(
    '/receipts/:receipt_id',
    {
      ...write,
      schema: { tags, summary: 'Apaga um rascunho de nota', params: receiptParamsSchema },
    },
    deleteReceiptController
  );
}
