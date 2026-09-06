import { Router } from 'express';
import { prisma } from '../db';
import { generateInvoiceNumber } from '../services/invoiceNumber';
import { renderInvoicePdf } from '../services/pdf';

export const invoicesRouter = Router();

invoicesRouter.get('/', async (_req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { id: 'desc' },
      include: { items: true }
    });
    res.json(invoices);
  } catch (e) { next(e); }
});

invoicesRouter.get('/:id', async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(req.params.id) },
      include: { items: true }
    });
    if (!invoice) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(invoice);
  } catch (e) { next(e); }
});

invoicesRouter.post('/', async (req, res, next) => {
  try {
    const {
      customerName,
      consigneeAddress,
      countryOfOrigin,
      countryOfDestination,
      preCarriedBy,
      placeOfReceipt,
      vesselFlightNo,
      portOfLoading,
      portOfDischarge,
      finalDestination,
      paymentTerms,
      invoiceDate,
      items
    } = req.body;

    if (!customerName || !consigneeAddress) {
      res.status(400).json({ error: 'customerName and consigneeAddress are required' });
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'At least one item is required' });
      return;
    }

    const created = await prisma.$transaction(async (tx) => {
      const itemIds = items.map((it: any) => Number(it.itemId));
      const dbItems = await tx.item.findMany({ where: { id: { in: itemIds } } });
      const byId = new Map(dbItems.map((i) => [i.id, i]));

      const lines = items.map((it: any) => {
        const dbItem = byId.get(Number(it.itemId));
        if (!dbItem) throw new Error(`Item ${it.itemId} not found`);
        const qty = Number(it.quantity);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantity must be a positive number');
        const unitPrice = dbItem.priceUSD;
        const amount = +(qty * unitPrice).toFixed(2);
        return {
          itemId: dbItem.id,
          articleNumber: dbItem.articleNumber,
          productName: dbItem.productName,
          productSize: dbItem.productSize,
          material: dbItem.material,
          netWeight: dbItem.netWeight,
          quantity: qty,
          unitPrice,
          amount
        };
      });

      const totalUSD = +lines.reduce((s, l) => s + l.amount, 0).toFixed(2);
      const invoiceNumber = await generateInvoiceNumber(tx);

      return tx.invoice.create({
        data: {
          invoiceNumber,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
          customerName: String(customerName).trim(),
          consigneeAddress: String(consigneeAddress).trim(),
          countryOfOrigin: countryOfOrigin || null,
          countryOfDestination: countryOfDestination || null,
          preCarriedBy: preCarriedBy || null,
          placeOfReceipt: placeOfReceipt || null,
          vesselFlightNo: vesselFlightNo || null,
          portOfLoading: portOfLoading || null,
          portOfDischarge: portOfDischarge || null,
          finalDestination: finalDestination || null,
          paymentTerms: paymentTerms || null,
          totalUSD,
          items: { create: lines }
        },
        include: { items: true }
      });
    });

    res.status(201).json(created);
  } catch (e) { next(e); }
});

invoicesRouter.get('/:id/pdf', async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(req.params.id) },
      include: { items: true }
    });
    if (!invoice) { res.status(404).json({ error: 'Not found' }); return; }
    renderInvoicePdf(invoice, res);
  } catch (e) { next(e); }
});
