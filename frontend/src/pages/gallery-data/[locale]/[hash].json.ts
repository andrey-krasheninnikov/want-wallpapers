import type { APIRoute } from 'astro';
import { locales } from '@/data/catalog';
import { buildGalleryData } from '@/lib/build-gallery-data';

export async function getStaticPaths() {
  return Promise.all(locales.map(async locale => {
    const { hash, json } = await buildGalleryData(locale);
    return { params: { locale, hash }, props: { json } };
  }));
}

export const GET: APIRoute = ({ props }) => new Response(props.json, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
