// Utilidades compartidas por las funciones de la tienda
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';

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
const cleanKey = k => String(k || '').trim();
export function isAdmin(req) {
  const key = cleanKey(process.env.ADMIN_KEY);
  return key.length >= 16 && cleanKey(req.headers.get('x-admin-key')) === key;
}

// "Huella" de una clave: 6 caracteres que permiten comparar sin revelarla
const huella = k => k ? createHash('sha256').update(k).digest('hex').slice(0, 6).toUpperCase() : 'VACÍA';

// Respuesta cuando la clave no coincide, con las huellas para diagnosticar
export function unauthorized(req) {
  const server = cleanKey(process.env.ADMIN_KEY);
  const sent = cleanKey(req.headers.get('x-admin-key'));
  const msg = !server
    ? 'Netlify no tiene la variable ADMIN_KEY (o falta volver a desplegar).'
    : `Clave de administrador incorrecta. Huella del programa: ${huella(sent)} · Huella de Netlify: ${huella(server)}`;
  return json({ error: msg }, 401);
}

export const getCatalog = () => db().get('catalogo', { type: 'json' });
export const getOrder = id => db().get('pedidos/' + id, { type: 'json' });
export const saveOrder = order => db().setJSON('pedidos/' + order.id, order);

export const round2 = n => Math.round(Number(n) * 100) / 100;
