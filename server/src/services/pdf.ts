import PDFDocument from 'pdfkit';
import { Response } from 'express';

type InvoiceWithItems = {
  invoiceNumber: string;
  invoiceDate: Date;
  customerName: string;
  consigneeAddress: string;
  countryOfOrigin: string | null;
  countryOfDestination: string | null;
  preCarriedBy: string | null;
  placeOfReceipt: string | null;
  vesselFlightNo: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  finalDestination: string | null;
  paymentTerms: string | null;
  totalUSD: number;
  items: Array<{
    articleNumber: string;
    productName: string;
    productSize: string | null;
    material: string | null;
    netWeight: number | null;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
};

const SHIPPER = {
  name: process.env.SHIPPER_NAME || 'Your Company',
  address: process.env.SHIPPER_ADDRESS || '',
  phone: process.env.SHIPPER_PHONE || ''
};

const fmt = (n: number) => n.toFixed(2);

export function renderInvoicePdf(invoice: InvoiceWithItems, res: Response) {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const leftX = 36;
  const rightX = pageWidth / 2 + 6;
  const contentWidth = pageWidth - 72;

  doc.font('Helvetica-Bold').fontSize(16).text('COMMERCIAL INVOICE', leftX, 40, { width: contentWidth, align: 'center' });
  doc.moveTo(leftX, 64).lineTo(pageWidth - 36, 64).stroke();

  let y = 76;
  const blockTop = y;

  doc.font('Helvetica-Bold').fontSize(10).text('Shipper:', leftX, y);
  doc.font('Helvetica').fontSize(9);
  doc.text(SHIPPER.name, leftX, y + 14, { width: pageWidth / 2 - 48 });
  doc.text(SHIPPER.address, leftX, doc.y, { width: pageWidth / 2 - 48 });
  if (SHIPPER.phone) doc.text(`Tel: ${SHIPPER.phone}`, leftX, doc.y, { width: pageWidth / 2 - 48 });
  const leftBottom = doc.y;

  const labelGap = 90;
  doc.font('Helvetica-Bold').fontSize(10).text('Invoice No.', rightX, blockTop);
  doc.font('Helvetica').fontSize(9).text(invoice.invoiceNumber, rightX + labelGap, blockTop);
  doc.font('Helvetica-Bold').fontSize(10).text('Date:', rightX, blockTop + 16);
  doc.font('Helvetica').fontSize(9).text(invoice.invoiceDate.toISOString().slice(0, 10), rightX + labelGap, blockTop + 16);
  doc.font('Helvetica-Bold').fontSize(10).text('Payment Terms:', rightX, blockTop + 32);
  doc.font('Helvetica').fontSize(9).text(invoice.paymentTerms || '-', rightX + labelGap, blockTop + 32, { width: pageWidth - rightX - labelGap - 36 });
  const rightBottom = doc.y;

  y = Math.max(leftBottom, rightBottom) + 16;
  doc.moveTo(leftX, y).lineTo(pageWidth - 36, y).stroke();
  y += 10;

  const block2Top = y;
  doc.font('Helvetica-Bold').fontSize(10).text('Consignee:', leftX, y);
  doc.font('Helvetica').fontSize(9);
  doc.text(invoice.customerName, leftX, y + 14, { width: pageWidth / 2 - 48 });
  doc.text(invoice.consigneeAddress, leftX, doc.y, { width: pageWidth / 2 - 48 });
  const consigneeBottom = doc.y;

  const shippingRows: Array<[string, string]> = [
    ['Country of Origin:', invoice.countryOfOrigin || '-'],
    ['Country of Destination:', invoice.countryOfDestination || '-']
  ];
  let ry = block2Top;
  for (const [label, value] of shippingRows) {
    doc.font('Helvetica-Bold').fontSize(10).text(label, rightX, ry);
    doc.font('Helvetica').fontSize(9).text(value, rightX + labelGap, ry, { width: pageWidth - rightX - labelGap - 36 });
    ry += 16;
  }
  const rightBlockBottom = ry;

  y = Math.max(consigneeBottom, rightBlockBottom) + 16;
  doc.moveTo(leftX, y).lineTo(pageWidth - 36, y).stroke();
  y += 10;

  doc.font('Helvetica-Bold').fontSize(10).text('Transportation', leftX, y);
  y += 16;
  const transportRowsLeft: Array<[string, string]> = [
    ['Pre-Carried By:', invoice.preCarriedBy || '-'],
    ['Place of Receipt:', invoice.placeOfReceipt || '-'],
    ['Vessel / Flight No.:', invoice.vesselFlightNo || '-']
  ];
  const transportRowsRight: Array<[string, string]> = [
    ['Port of Loading:', invoice.portOfLoading || '-'],
    ['Port of Discharge:', invoice.portOfDischarge || '-'],
    ['Final Destination:', invoice.finalDestination || '-']
  ];
  let tly = y;
  for (const [label, value] of transportRowsLeft) {
    doc.font('Helvetica-Bold').fontSize(10).text(label, leftX, tly);
    doc.font('Helvetica').fontSize(9).text(value, leftX + labelGap, tly, { width: pageWidth / 2 - labelGap - 12 });
    tly += 16;
  }
  let try_ = y;
  for (const [label, value] of transportRowsRight) {
    doc.font('Helvetica-Bold').fontSize(10).text(label, rightX, try_);
    doc.font('Helvetica').fontSize(9).text(value, rightX + labelGap, try_, { width: pageWidth - rightX - labelGap - 36 });
    try_ += 16;
  }
  y = Math.max(tly, try_) + 6;
  doc.moveTo(leftX, y).lineTo(pageWidth - 36, y).stroke();
  y += 10;

  const cols = [
    { label: '#', width: 24, align: 'left' as const },
    { label: 'Article No', width: 70, align: 'left' as const },
    { label: 'Description', width: 200, align: 'left' as const },
    { label: 'Qty', width: 40, align: 'right' as const },
    { label: 'Unit Price (USD)', width: 80, align: 'right' as const },
    { label: 'Amount (USD)', width: 85, align: 'right' as const }
  ];
  const tableLeft = leftX;
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);

  const drawRow = (rowY: number, values: string[], bold = false, height = 18) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    let cx = tableLeft;
    values.forEach((v, i) => {
      const col = cols[i];
      doc.text(v, cx + 3, rowY + 5, { width: col.width - 6, align: col.align, ellipsis: true });
      cx += col.width;
    });
    doc.moveTo(tableLeft, rowY + height).lineTo(tableLeft + tableWidth, rowY + height).stroke();
  };

  doc.rect(tableLeft, y, tableWidth, 22).fillAndStroke('#f0f0f0', '#000');
  doc.fillColor('#000');
  let cx = tableLeft;
  doc.font('Helvetica-Bold').fontSize(9);
  cols.forEach((col) => {
    doc.text(col.label, cx + 3, y + 7, { width: col.width - 6, align: col.align });
    cx += col.width;
  });
  doc.moveTo(tableLeft, y).lineTo(tableLeft, y + 22).stroke();
  doc.moveTo(tableLeft + tableWidth, y).lineTo(tableLeft + tableWidth, y + 22).stroke();
  y += 22;

  invoice.items.forEach((it, idx) => {
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = 50;
    }
    const desc = it.productSize ? `${it.productName}\n${it.productSize}` : it.productName;
    const rowHeight = it.productSize ? 28 : 18;
    drawRow(
      y,
      [String(idx + 1), it.articleNumber, desc, String(it.quantity), fmt(it.unitPrice), fmt(it.amount)],
      false,
      rowHeight
    );
    doc.moveTo(tableLeft, y).lineTo(tableLeft, y + rowHeight).stroke();
    doc.moveTo(tableLeft + tableWidth, y).lineTo(tableLeft + tableWidth, y + rowHeight).stroke();
    y += rowHeight;
  });

  const totalRowY = y;
  doc.font('Helvetica-Bold').fontSize(10);
  const totalLabelWidth = cols[0].width + cols[1].width + cols[2].width + cols[3].width;
  doc.text('TOTAL', tableLeft + 3, totalRowY + 6, { width: totalLabelWidth - 6, align: 'right' });
  doc.text(`USD ${fmt(invoice.totalUSD)}`, tableLeft + totalLabelWidth, totalRowY + 6, { width: cols[4].width + cols[5].width - 6, align: 'right' });
  doc.rect(tableLeft, totalRowY, tableWidth, 22).stroke();
  y += 22;

  y += 40;
  if (y > doc.page.height - 80) { doc.addPage(); y = 60; }
  doc.font('Helvetica').fontSize(9).text('Signature & Stamp:', leftX, y);
  doc.moveTo(leftX + 100, y + 10).lineTo(leftX + 300, y + 10).stroke();

  doc.end();
}
