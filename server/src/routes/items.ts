import { Router } from 'express';
import { prisma } from '../db';

export const itemsRouter = Router();

itemsRouter.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.item.findMany({ orderBy: { id: 'desc' } });
    res.json(items);
  } catch (e) { next(e); }
});

itemsRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.item.findUnique({ where: { id: Number(req.params.id) } });
    if (!item) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(item);
  } catch (e) { next(e); }
});

const DIMENSION_UNITS = ['cm', 'in', 'ft'] as const;
type DimensionUnit = typeof DIMENSION_UNITS[number];

const CURRENCIES = ['USD', 'EUR'] as const;
type Currency = typeof CURRENCIES[number];

function normalizeCurrency(v: unknown): Currency | null {
  if (v === null || v === undefined || v === '') return null;
  return CURRENCIES.includes(v as Currency) ? (v as Currency) : null;
}

const toFloat = (v: any) => (v === '' || v == null ? null : Number(v));
const toFloatOpt = (v: any) => (v === undefined ? undefined : v === '' || v == null ? null : Number(v));

function validatePositive(name: string, v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return `${name} must be a positive number`;
  return null;
}

function normalizeUnit(v: unknown): DimensionUnit | null {
  if (v === null || v === undefined || v === '') return null;
  return DIMENSION_UNITS.includes(v as DimensionUnit) ? (v as DimensionUnit) : null;
}

itemsRouter.post('/', async (req, res, next) => {
  try {
    const { articleNumber, productName, imageUrl, productSize, material, length, width, height, dimensionUnit, netWeight, grossWeight, cbm, priceUSD, currency, exchangeRate } = req.body;
    if (!articleNumber || !productName || priceUSD === undefined) {
      res.status(400).json({ error: 'articleNumber, productName and priceUSD are required' });
      return;
    }
    for (const [name, val] of [['length', length], ['width', width], ['height', height]] as const) {
      const err = validatePositive(name, val);
      if (err) { res.status(400).json({ error: err }); return; }
    }
    if (dimensionUnit != null && dimensionUnit !== '' && !DIMENSION_UNITS.includes(dimensionUnit)) {
      res.status(400).json({ error: 'dimensionUnit must be one of cm, in, ft' });
      return;
    }
    if (currency != null && currency !== '' && !CURRENCIES.includes(currency)) {
      res.status(400).json({ error: 'currency must be one of USD, EUR' });
      return;
    }
    const item = await prisma.item.create({
      data: {
        articleNumber: String(articleNumber).trim(),
        productName: String(productName).trim(),
        imageUrl: imageUrl || null,
        productSize: productSize || null,
        material: material || null,
        length: toFloat(length),
        width: toFloat(width),
        height: toFloat(height),
        dimensionUnit: normalizeUnit(dimensionUnit),
        netWeight: toFloat(netWeight),
        grossWeight: toFloat(grossWeight),
        cbm: toFloat(cbm),
        priceUSD: Number(priceUSD),
        currency: normalizeCurrency(currency),
        exchangeRate: toFloat(exchangeRate),
        priceUpdatedAt: new Date()
      }
    });
    res.status(201).json(item);
  } catch (e: any) {
    if (e?.code === 'P2002') {
      res.status(409).json({ error: 'Article number already exists' });
      return;
    }
    next(e);
  }
});

itemsRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { articleNumber, productName, imageUrl, productSize, material, length, width, height, dimensionUnit, netWeight, grossWeight, cbm, priceUSD, currency, exchangeRate } = req.body;
    for (const [name, val] of [['length', length], ['width', width], ['height', height]] as const) {
      const err = validatePositive(name, val);
      if (err) { res.status(400).json({ error: err }); return; }
    }
    if (dimensionUnit !== undefined && dimensionUnit !== null && dimensionUnit !== '' && !DIMENSION_UNITS.includes(dimensionUnit)) {
      res.status(400).json({ error: 'dimensionUnit must be one of cm, in, ft' });
      return;
    }
    if (currency !== undefined && currency !== null && currency !== '' && !CURRENCIES.includes(currency)) {
      res.status(400).json({ error: 'currency must be one of USD, EUR' });
      return;
    }
    let priceUpdate: { priceUSD?: number; priceUpdatedAt?: Date } = {};
    if (priceUSD !== undefined) {
      const newPrice = Number(priceUSD);
      const existing = await prisma.item.findUnique({ where: { id }, select: { priceUSD: true, currency: true } });
      priceUpdate.priceUSD = newPrice;
      const currencyChanged = currency !== undefined && normalizeCurrency(currency) !== (existing?.currency ?? null);
      if (existing && (existing.priceUSD !== newPrice || currencyChanged)) {
        priceUpdate.priceUpdatedAt = new Date();
      }
    }
    const item = await prisma.item.update({
      where: { id },
      data: {
        articleNumber: articleNumber !== undefined ? String(articleNumber).trim() : undefined,
        productName: productName !== undefined ? String(productName).trim() : undefined,
        imageUrl: imageUrl !== undefined ? imageUrl || null : undefined,
        productSize: productSize !== undefined ? productSize || null : undefined,
        material: material !== undefined ? material || null : undefined,
        length: toFloatOpt(length),
        width: toFloatOpt(width),
        height: toFloatOpt(height),
        dimensionUnit: dimensionUnit === undefined ? undefined : normalizeUnit(dimensionUnit),
        netWeight: toFloatOpt(netWeight),
        grossWeight: toFloatOpt(grossWeight),
        cbm: toFloatOpt(cbm),
        currency: currency === undefined ? undefined : normalizeCurrency(currency),
        exchangeRate: toFloatOpt(exchangeRate),
        ...priceUpdate
      }
    });
    res.json(item);
  } catch (e: any) {
    if (e?.code === 'P2002') {
      res.status(409).json({ error: 'Article number already exists' });
      return;
    }
    if (e?.code === 'P2025') {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    next(e);
  }
});

itemsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ref = await prisma.invoiceItem.findFirst({ where: { itemId: id } });
    if (ref) {
      res.status(409).json({ error: 'Item is referenced by one or more invoices and cannot be deleted' });
      return;
    }
    await prisma.item.delete({ where: { id } });
    res.status(204).end();
  } catch (e: any) {
    if (e?.code === 'P2025') {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    next(e);
  }
});
