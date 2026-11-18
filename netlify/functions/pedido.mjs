// GET /api/pedido?id=... — el cliente consulta el estado de su pedido al volver de Mercado Pago.
// Solo devuelve datos no sensibles (sin teléfono ni dirección).
import { json, preflight, getOrder } from '../lib/util.mjs';

export default async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^P[A-Z0-9]{6,20}$/.test(id)) return json({ error: 'Pedido no válido' }, 400);
  const o = await getOrder(id);
  if (!o) return json({ error: 'Pedido no encontrado' }, 404);
  return json({
    id: o.id, estado: o.estado, total: o.total, entrega: o.cliente?.entrega,
    items: o.items.map(l => ({ name: l.name, qty: l.qty, unit: l.unit, subtotal: l.subtotal }))
  });
};

export const config = { path: '/api/pedido' };
