import type { RequestHandler } from './$types';

// Liveness only: deliberately does not open the database.
export const GET: RequestHandler = () => new Response('ok');
