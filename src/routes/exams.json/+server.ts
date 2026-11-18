import { json } from '@sveltejs/kit';
import { curriculum } from 'virtual:curriculum';
import type { RequestHandler } from './$types';

// The service worker reads this at install time to keep the exam pages for offline use.
export const prerender = true;

export const GET: RequestHandler = () =>
	json(curriculum.branches.flatMap((branch) => branch.paths).flatMap((path) => path.checkpoints.map((checkpoint) => checkpoint.id)));
