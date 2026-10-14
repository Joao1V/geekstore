import type {
  BannerBody,
  BannerOrderBody,
  BannerUpdateBody,
  PageBody,
  PageUpdateBody,
  RedirectBody,
  RedirectListQuery,
  RedirectUpdateBody,
} from '@geekstore/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createBanner,
  deleteBanner,
  listActiveBanners,
  listBanners,
  reorderBanners,
  updateBanner,
} from './banner.service';
import {
  createPage,
  deletePage,
  getPage,
  getPublishedPage,
  listPages,
  listPublishedPages,
  updatePage,
} from './page.service';
import {
  createRedirect,
  deleteRedirect,
  listRedirects,
  redirectMap,
  updateRedirect,
} from './redirect.service';

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

export async function listBannersController() {
  return { data: await listBanners() };
}

export async function createBannerController(
  request: FastifyRequest<{ Body: BannerBody }>,
  reply: FastifyReply
) {
  const data = await createBanner(request.user.sub, request.body);
  return reply.status(201).send({ data });
}

export async function updateBannerController(
  request: FastifyRequest<{ Params: { banner_id: string }; Body: BannerUpdateBody }>
) {
  return { data: await updateBanner(request.user.sub, request.params.banner_id, request.body) };
}

export async function deleteBannerController(
  request: FastifyRequest<{ Params: { banner_id: string } }>,
  reply: FastifyReply
) {
  await deleteBanner(request.user.sub, request.params.banner_id);
  return reply.status(204).send();
}

export async function reorderBannersController(request: FastifyRequest<{ Body: BannerOrderBody }>) {
  return { data: await reorderBanners(request.user.sub, request.body.banner_ids) };
}

export async function listStoreBannersController() {
  return { data: await listActiveBanners() };
}

export async function listRedirectsController(
  request: FastifyRequest<{ Querystring: RedirectListQuery }>
) {
  return listRedirects(request.query);
}

export async function createRedirectController(
  request: FastifyRequest<{ Body: RedirectBody }>,
  reply: FastifyReply
) {
  const data = await createRedirect(request.user.sub, request.body);
  return reply.status(201).send({ data });
}

export async function updateRedirectController(
  request: FastifyRequest<{ Params: { redirect_id: string }; Body: RedirectUpdateBody }>
) {
  return { data: await updateRedirect(request.user.sub, request.params.redirect_id, request.body) };
}

export async function deleteRedirectController(
  request: FastifyRequest<{ Params: { redirect_id: string } }>,
  reply: FastifyReply
) {
  await deleteRedirect(request.user.sub, request.params.redirect_id);
  return reply.status(204).send();
}

export async function storeRedirectMapController(_request: FastifyRequest, reply: FastifyReply) {
  // O site guarda o mapa em memória: um minuto de cache também na borda alivia a API.
  reply.header('cache-control', 'public, max-age=60');
  return { data: await redirectMap() };
}
