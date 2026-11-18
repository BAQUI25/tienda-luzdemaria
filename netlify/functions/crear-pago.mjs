// POST /api/crear-pago — el cliente confirma su carrito; se crea el pedido y el pago en Mercado Pago.
// Los precios y el stock se toman SIEMPRE del catálogo publicado (no del navegador del cliente).
import { json, preflight, getCatalog, saveOrder, round2 } from '../lib/util.mjs';

const txt = (v, max) => String(v ?? '').trim().slice(0, max);

export default async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return json({ error: 'Los pagos en línea aún no están configurados en esta tienda.' }, 503);
  const currency = process.env.MP_CURRENCY || 'COP';

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Datos no válidos' }, 400); }

  const cat = await getCatalog();
  if (!cat) return json({ error: 'La tienda aún no ha sido publicada' }, 503);
  const byId = new Map(cat.products.map(p => [p.id, p]));
  const decimals = cat.store?.decimals === 2 ? 2 : 0;
  const roundMoney = n => decimals ? round2(n) : Math.round(n);

  // ---- Validar carrito ----
  const items = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  if (!items.length) return json({ error: 'El carrito está vacío' }, 400);
  const lines = [];
  for (const it of items) {
    const p = byId.get(String(it.id));
    if (!p) return json({ error: 'Un producto del carrito ya no está disponible. Actualice la página.' }, 409);
    let qty = Number(it.qty);
    if (p.unit === 'kg') {
      qty = Math.round(qty * 4) / 4; // de a 250 g
      if (!(qty >= 0.25 && qty <= 20)) return json({ error: `Cantidad no válida para ${p.name}` }, 400);
    } else {
      qty = Math.floor(qty);
      if (!(qty >= 1 && qty <= 100)) return json({ error: `Cantidad no válida para ${p.name}` }, 400);
    }
    if (qty > p.stock) {
      return json({ error: `No hay suficiente stock de ${p.name} (quedan ${p.stock}${p.unit === 'kg' ? ' kg' : ''}).` }, 409);
    }
    lines.push({ id: p.id, code: p.code, name: p.name, unit: p.unit, qty, price: p.price, subtotal: roundMoney(p.price * qty) });
  }
  const total = roundMoney(lines.reduce((s, l) => s + l.subtotal, 0));

  // ---- Datos del cliente ----
  const c = body.cliente || {};
  const cliente = {
    nombre: txt(c.nombre, 80), telefono: txt(c.telefono, 30), email: txt(c.email, 100),
    entrega: c.entrega === 'despacho' ? 'despacho' : 'retiro',
    direccion: txt(c.direccion, 200), nota: txt(c.nota, 300)
  };
  if (!cliente.nombre || !cliente.telefono) return json({ error: 'Nombre y teléfono son obligatorios' }, 400);
  if (cliente.entrega === 'despacho' && !cliente.direccion) return json({ error: 'Indique la dirección de despacho' }, 400);

  // ---- Crear pedido y preferencia de pago ----
  const id = 'P' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  const origin = new URL(req.url).origin;
  const order = { id, createdAt: new Date().toISOString(), estado: 'pendiente_pago', items: lines, total, cliente, aplicado: false };
  await saveOrder(order);

  const pref = {
    items: lines.map(l => ({
      id: l.id,
      title: l.unit === 'kg' ? `${l.name} (${String(l.qty).replace('.', ',')} kg)` : l.name,
      quantity: l.unit === 'kg' ? 1 : l.qty,
      unit_price: l.unit === 'kg' ? l.subtotal : l.price,
      currency_id: currency
    })),
    external_reference: id,
    payer: { name: cliente.nombre, ...(cliente.email ? { email: cliente.email } : {}) },
    back_urls: {
      success: `${origin}/?pago=ok&pedido=${id}`,
      failure: `${origin}/?pago=fallo&pedido=${id}`,
      pending: `${origin}/?pago=pendiente&pedido=${id}`
    },
    auto_return: 'approved',
    notification_url: `${origin}/api/mp-webhook`,
    statement_descriptor: (cat.store?.name || 'MINIMERCADO').slice(0, 22)
  };

  const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify(pref)
  });
  if (!r.ok) {
    console.error('Mercado Pago respondió', r.status, await r.text());
    order.estado = 'error_pago';
    await saveOrder(order);
    return json({ error: 'No se pudo iniciar el pago. Intente nuevamente en unos minutos.' }, 502);
  }
  const data = await r.json();
  order.preferenceId = data.id;
  await saveOrder(order);
  return json({ url: data.init_point, pedido: id, total });
};

export const config = { path: '/api/crear-pago' };
