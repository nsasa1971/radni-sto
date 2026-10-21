import { getStore } from '@netlify/blobs';
import { handle } from '../lib/api-handler.mjs';

export default async (req) =>
  handle(req, { store: getStore({ name: 'radni-sto', consistency: 'strong' }), env: (k) => Netlify.env.get(k) });

export const config = { path: ['/api/status', '/api/sync', '/api/run'] };
