import { getRegion } from './privacy';
import { api, visitorMutation } from './api-client';
import { ratingValues, type Rating } from '@/data/ratings';
export type Comment = { id: string; uid: string; text: string; createdAt: number | null };
export type SocialData = { counts: Record<Rating, number>; ownRating: Rating | ''; ownUid: string | null; comments: Comment[] };
function requireRegion() { if (getRegion() !== 'open') throw new Error('Region unavailable'); }
const path = (id: string) => `/wallpapers/${encodeURIComponent(id)}`;
export async function readSocial(wallpaperId: string): Promise<SocialData> {
  requireRegion(); return api(`${path(wallpaperId)}/social`);
}
export async function saveRating(wallpaperId: string, value: Rating) {
  requireRegion(); if (!ratingValues.includes(value)) throw new Error('Invalid rating');
  await visitorMutation(`${path(wallpaperId)}/rating`, 'PUT', 'rating', { value });
}
export async function postComment(wallpaperId: string, value: string) {
  requireRegion(); const text = value.trim();
  if (text.length < 2 || text.length > 1000) throw new Error('Invalid comment');
  await visitorMutation(`${path(wallpaperId)}/comments`, 'POST', 'comment', { text });
}
export async function actOnComment(wallpaperId: string, comment: Comment) {
  requireRegion();
  const social = await readSocial(wallpaperId);
  const own = comment.uid === social.ownUid;
  await visitorMutation(`${path(wallpaperId)}/comments/${encodeURIComponent(comment.id)}${own ? '' : '/report'}`, own ? 'DELETE' : 'POST', own ? 'comment_delete' : 'comment_report');
  return own ? 'deleted' as const : 'reported' as const;
}
