// POST /api/pedido-estado — la app de inventario marca un pedido (registrado, entregado, cancelado)
import { json, preflight, isAdmin, getOrder, saveOrder } from '../lib/util.mjs';

const ALLOWED = ['pagado', 'preparando', 'entregado', 'cancelado'];

export default async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (!isAdmin(req)) return json({ error: 'Clave de administrador incorrecta' }, 401);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Datos no válidos' }, 400); }
  const order = await getOrder(String(body.id || ''));
  if (!order) return json({ error: 'Pedido no encontrado' }, 404);

  if (body.estado) {
    if (!ALLOWED.includes(body.estado)) return json({ error: 'Estado no válido' }, 400);
    order.estado = body.estado;
  }
  if (typeof body.aplicado === 'boolean') order.aplicado = body.aplicado;
  order.updatedAt = new Date().toISOString();
  await saveOrder(order);
  return json(order);
};

export const config = { path: '/api/pedido-estado' };
