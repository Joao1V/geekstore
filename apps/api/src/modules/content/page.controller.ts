import type { PageBody, PageUpdateBody } from '@geekstore/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  createPage,
  deletePage,
  getPage,
  getPublishedPage,
  listPages,
  listPublishedPages,
  updatePage,
} from './page.service';

type PageParams = { page_id: string };

export async function listPagesController() {
  return { data: await listPages() };
}

export async function getPageController(request: FastifyRequest<{ Params: PageParams }>) {
  return { data: await getPage(request.params.page_id) };
}

export async function createPageController(
  request: FastifyRequest<{ Body: PageBody }>,
  reply: FastifyReply
) {
  const data = await createPage(request.user.sub, request.body);
  return reply.status(201).send({ data });
}

export async function updatePageController(
  request: FastifyRequest<{ Params: PageParams; Body: PageUpdateBody }>
) {
  return { data: await updatePage(request.user.sub, request.params.page_id, request.body) };
}

export async function deletePageController(
  request: FastifyRequest<{ Params: PageParams }>,
  reply: FastifyReply
) {
  await deletePage(request.user.sub, request.params.page_id);
  return reply.status(204).send();
}

export async function listStorePagesController() {
  return { data: await listPublishedPages() };
}

export async function getStorePageController(
  request: FastifyRequest<{ Params: { slug: string } }>
) {
  return { data: await getPublishedPage(request.params.slug) };
}
