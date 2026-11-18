// GET /api/catalogo — productos, precios y stock publicados desde el inventario
import { json, preflight, getCatalog } from '../lib/util.mjs';

export default async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const cat = await getCatalog();
  if (!cat) return json({ error: 'La tienda aún no ha sido publicada' }, 404);
  return json(cat, 200, { 'cache-control': 'public, max-age=20' });
};

export const config = { path: '/api/catalogo' };
