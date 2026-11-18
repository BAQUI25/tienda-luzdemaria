// POST /api/publicar — la app de inventario sube el catálogo (requiere clave de administrador)
import { json, preflight, isAdmin, db } from '../lib/util.mjs';

export default async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  if (!isAdmin(req)) return json({ error: 'Clave de administrador incorrecta' }, 401);

  let cat;
  try { cat = await req.json(); } catch { return json({ error: 'Datos no válidos' }, 400); }
  if (!cat || !Array.isArray(cat.products)) return json({ error: 'Falta la lista de productos' }, 400);

  // Se guardan solo los campos que la tienda necesita
  const clean = {
    version: 1,
    publishedAt: new Date().toISOString(),
    store: {
      name: String(cat.store?.name || 'Minimercado').slice(0, 80),
      currency: String(cat.store?.currency || '$').slice(0, 4),
      decimals: Number(cat.store?.decimals) === 2 ? 2 : 0
    },
    categories: (cat.categories || []).map(c => String(c).slice(0, 60)).slice(0, 40),
    products: cat.products.slice(0, 2000).map(p => ({
      id: String(p.id),
      code: String(p.code || ''),
      name: String(p.name || '').slice(0, 120),
      category: String(p.category || 'Otros').slice(0, 60),
      unit: p.unit === 'kg' ? 'kg' : 'unidad',
      price: Math.max(0, Number(p.price) || 0),
      stock: Number(p.stock) || 0,
      emoji: String(p.emoji || '').slice(0, 16),
      color: /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : '',
      photo: typeof p.photo === 'string' && p.photo.startsWith('data:image/') ? p.photo : ''
    })).filter(p => p.name && p.price > 0)
  };
  await db().setJSON('catalogo', clean);
  return json({ ok: true, productos: clean.products.length, publishedAt: clean.publishedAt });
};

export const config = { path: '/api/publicar' };
