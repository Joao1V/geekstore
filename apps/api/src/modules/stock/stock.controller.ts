import type {
  StockBulkBody,
  StockLevelListQuery,
  StockMovementBody,
  StockMovementListQuery,
} from '@geekstore/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  bulkSetOnHand,
  createMovement,
  listLevels,
  listLocations,
  listMovements,
} from './stock.service';
import { reconcileStock } from './stock-reconcile.service';

export async function listLocationsController() {
  return { data: await listLocations() };
}

export async function listLevelsController(
  request: FastifyRequest<{ Querystring: StockLevelListQuery }>
) {
  return listLevels(request.query);
}

export async function listMovementsController(
  request: FastifyRequest<{ Querystring: StockMovementListQuery }>
) {
  return listMovements(request.query);
}

export async function createMovementController(
  request: FastifyRequest<{ Body: StockMovementBody }>,
  reply: FastifyReply
) {
  const data = await createMovement(request.user.sub, request.body);
  return reply.status(201).send({ data });
}

export async function bulkSetLevelsController(request: FastifyRequest<{ Body: StockBulkBody }>) {
  return { data: { updated: await bulkSetOnHand(request.user.sub, request.body) } };
}

export async function reconcileController() {
  return { data: await reconcileStock() };
}
