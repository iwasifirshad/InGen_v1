import ExcelJS from 'exceljs';
import { DimensionUnit, Item } from '../types';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PRODUCT_ROW_HEIGHT = 120;
const IMAGE_MAX_WIDTH = 165;
const IMAGE_MAX_HEIGHT = 145;

const CBM_FACTORS: Record<DimensionUnit, number> = {
  cm: 0.000001,
  in: 0.000016387064,
  ft: 0.028316846592
};

const HEADERS = [
  'Article No.',
  'Picture',
  'Product Size',
  'Carton Size - Length',
  'Carton Size - Width',
  'Carton Size - Height',
  'CBM / Carton',
  'Material(s)',
  'Price in USD($)'
];

function formatMaterial(material: string | null): string {
  if (!material) return '';
  return material
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.includes(':')) return part.replace(/^([^:]+):\s*/, '$1 - ');
      return part.replace(
        /^(.+?)\s+(\d+(?:\.\d+)?\s*(?:kg|kgs?|g|gms?|grams?|sheet|sheets?))$/i,
        '$1 - $2'
      );
    })
    .join('\n');
}

function cbmValue(item: Item, rowNumber: number): ExcelJS.CellValue {
  const hasDimensions =
    item.length != null && item.length > 0 &&
    item.width != null && item.width > 0 &&
    item.height != null && item.height > 0 &&
    item.dimensionUnit != null;

  if (hasDimensions) {
    const factor = CBM_FACTORS[item.dimensionUnit!];
    return {
      formula: `D${rowNumber}*E${rowNumber}*F${rowNumber}*${factor}`,
      result: item.length! * item.width! * item.height! * factor
    };
  }

  return item.cbm ?? '';
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('The product image could not be decoded'));
    };
    image.src = objectUrl;
  });
}

async function prepareImage(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Image request failed (${response.status})`);
  }

  const image = await loadImage(await response.blob());
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) {
    throw new Error('The product image has invalid dimensions');
  }

  const renderScale = Math.min(1, 512 / sourceWidth, 512 / sourceHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * renderScale));
  canvas.height = Math.max(1, Math.round(sourceHeight * renderScale));
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Image conversion is not supported by this browser');
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return {
    base64: canvas.toDataURL('image/png'),
    width: sourceWidth,
    height: sourceHeight
  };
}

async function addProductImage(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  item: Item,
  rowNumber: number
) {
  const pictureCell = worksheet.getCell(rowNumber, 2);
  if (!item.imageUrl) {
    pictureCell.value = 'No image';
    pictureCell.font = { color: { argb: 'FF777777' }, italic: true };
    return;
  }

  try {
    const image = await prepareImage(item.imageUrl);
    const displayScale = Math.min(IMAGE_MAX_WIDTH / image.width, IMAGE_MAX_HEIGHT / image.height);
    const width = image.width * displayScale;
    const height = image.height * displayScale;
    const imageId = workbook.addImage({ base64: image.base64, extension: 'png' });

    worksheet.addImage(imageId, {
      tl: { col: 1.08, row: rowNumber - 0.92 },
      ext: { width, height },
      editAs: 'oneCell'
    });
  } catch {
    pictureCell.value = 'Image unavailable';
    pictureCell.font = { color: { argb: 'FFB00020' }, italic: true };
  }
}

function safeFilenamePart(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim().slice(0, 60) || 'Product';
}

function quotationFilename(items: Item[]): string {
  if (items.length === 1) {
    return `Quotation_${safeFilenamePart(items[0].articleNumber)}.xlsx`;
  }

  const articleNumbers = items.slice(0, 3).map((item) => safeFilenamePart(item.articleNumber)).join('_');
  const remainder = items.length > 3 ? `_and_${items.length - 3}_more` : '';
  return `Quotation_${articleNumbers}${remainder}.xlsx`;
}

function downloadWorkbook(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer as BlobPart], { type: XLSX_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function createQuotationWorkbook(
  selectedProducts: Item[],
  quotationDate: string | Date = new Date()
): Promise<ExcelJS.Workbook> {
  if (selectedProducts.length === 0) {
    throw new Error('Select at least one product');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'InGen';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Quotation', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    }
  });

  worksheet.columns = [
    { width: 16 },
    { width: 28 },
    { width: 24 },
    { width: 21 },
    { width: 21 },
    { width: 21 },
    { width: 17 },
    { width: 35 },
    { width: 16 }
  ];

  const headerRow = worksheet.addRow(HEADERS);
  headerRow.height = 34;
  for (let columnNumber = 1; columnNumber <= HEADERS.length; columnNumber += 1) {
    const cell = headerRow.getCell(columnNumber);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    cell.font = { bold: true, color: { argb: 'FF000000' }, size: 12 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  }

  for (const item of selectedProducts) {
    const row = worksheet.addRow([
      item.articleNumber,
      '',
      item.productSize ?? '',
      item.length ?? '',
      item.width ?? '',
      item.height ?? '',
      '',
      formatMaterial(item.material),
      item.priceUSD
    ]);
    row.height = PRODUCT_ROW_HEIGHT;
    row.getCell(7).value = cbmValue(item, row.number);

    for (let columnNumber = 1; columnNumber <= HEADERS.length; columnNumber += 1) {
      const cell = row.getCell(columnNumber);
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    }

    row.getCell(1).numFmt = '@';
    row.getCell(4).numFmt = '0';
    row.getCell(5).numFmt = '0';
    row.getCell(6).numFmt = '0';
    row.getCell(7).numFmt = '0.000';
    row.getCell(9).numFmt = '0.00';

    await addProductImage(workbook, worksheet, item, row.number);
  }

  worksheet.autoFilter = { from: 'A1', to: 'I1' };
  return workbook;
}

export async function generateQuotationExcel(
  selectedProducts: Item[],
  quotationDate: string | Date = new Date()
): Promise<void> {
  const workbook = await createQuotationWorkbook(selectedProducts, quotationDate);
  const buffer = await workbook.xlsx.writeBuffer();
  downloadWorkbook(buffer, quotationFilename(selectedProducts));
}