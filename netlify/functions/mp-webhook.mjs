// POST /api/mp-webhook — Mercado Pago avisa cuando cambia un pago.
// Por seguridad no se confía en el aviso: se consulta el pago directamente a Mercado Pago.
import { json, getOrder, saveOrder, getCatalog, db } from '../lib/util.mjs';

const FINAL = ['pagado', 'entregado', 'revisar_monto'];

export default async (req) => {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return new Response('ok');
  const url = new URL(req.url);
  let body = {};
  try { body = await req.json(); } catch { /* aviso sin cuerpo */ }

  const type = body.type || body.topic || url.searchParams.get('type') || url.searchParams.get('topic');
  const paymentId = body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
  if (type !== 'payment' || !paymentId) return new Response('ok');

  const r = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(paymentId), {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!r.ok) return new Response('reintentar', { status: 500 }); // Mercado Pago reintentará
  const pay = await r.json();

  const order = pay.external_reference ? await getOrder(pay.external_reference) : null;
  if (!order) return new Response('ok');

  const wasFinal = FINAL.includes(order.estado);
  order.pago = { id: pay.id, status: pay.status, detalle: pay.status_detail, monto: pay.transaction_amount, fecha: pay.date_approved || pay.date_last_updated };

  if (!wasFinal) {
    if (pay.status === 'approved') {
      order.estado = Math.abs(Number(pay.transaction_amount) - order.total) > 1 ? 'revisar_monto' : 'pagado';
      order.pagadoAt = new Date().toISOString();
    } else if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(pay.status)) {
      order.estado = 'pago_rechazado';
    } else {
      order.estado = 'pendiente_pago';
    }
  }
  await saveOrder(order);

  // Pago recién aprobado: descontar del stock publicado para que otros clientes vean lo que queda
  if (!wasFinal && FINAL.includes(order.estado)) {
    const cat = await getCatalog();
    if (cat) {
      for (const l of order.items) {
        const p = cat.products.find(x => x.id === l.id);
        if (p) p.stock = Math.round((p.stock - l.qty) * 1000) / 1000;
      }
      await db().setJSON('catalogo', cat);
    }
  }
  return json({ ok: true });
};

export const config = { path: '/api/mp-webhook' };
