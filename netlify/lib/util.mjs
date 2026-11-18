// Utilidades compartidas por las funciones de la tienda
import { getStore } from '@netlify/blobs';

// Almacén de datos de Netlify (catálogo publicado y pedidos)
export const db = () => getStore({ name: 'tienda', consistency: 'strong' });

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extra }
  });
}

export function preflight(req) {
  return req.method === 'OPTIONS' ? new Response(null, { status: 204, headers: CORS }) : null;
}

// La app de inventario manda la clave de administrador en la cabecera x-admin-key
export function isAdmin(req) {
  const key = process.env.ADMIN_KEY;
  return !!key && key.length >= 16 && req.headers.get('x-admin-key') === key;
}

export const getCatalog = () => db().get('catalogo', { type: 'json' });
export const getOrder = id => db().get('pedidos/' + id, { type: 'json' });
export const saveOrder = order => db().setJSON('pedidos/' + order.id, order);

export const round2 = n => Math.round(Number(n) * 100) / 100;
