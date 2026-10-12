import { json } from '@sveltejs/kit';
import { decks } from 'virtual:decks';
import type { RequestHandler } from './$types';

// The service worker reads this at install time to know which lesson pages to keep for offline use.
export const prerender = true;

export const GET: RequestHandler = () => json(decks.map((deck) => deck.id));
