// GET /api/pedidos — lista de pedidos para la app de inventario (requiere clave de administrador)
import { json, preflight, isAdmin, db } from '../lib/util.mjs';

export default async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (!isAdmin(req)) return json({ error: 'Clave de administrador incorrecta' }, 401);

  const { blobs } = await db().list({ prefix: 'pedidos/' });
  // Los IDs llevan la fecha codificada: ordenar por clave = ordenar por fecha
  const keys = blobs.map(b => b.key).sort((a, b) => {
    const ta = parseInt(a.slice(9, -3), 36), tb = parseInt(b.slice(9, -3), 36);
    return tb - ta;
  }).slice(0, 200);
  const orders = (await Promise.all(keys.map(k => db().get(k, { type: 'json' })))).filter(Boolean);
  return json(orders);
};

export const config = { path: '/api/pedidos' };
