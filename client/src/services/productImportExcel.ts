import ExcelJS from 'exceljs';
import { Item } from '../types';

export const PRODUCT_IMPORT_HEADERS = [
  'Article No.',
  'Picture',
  'Product Size',
  'Carton Size - Length',
  'Carton Size - Width',
  'Carton Size - Height',
  'CBM / Carton',
  'Material(s)',
  'Price in USD($)'
] as const;

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const UNIT_TO_CBM_FACTOR = 0.000001;

type HeaderName = typeof PRODUCT_IMPORT_HEADERS[number];

export type ImportedProductPayload = {
  sourceRow: number;
  articleNumber: string;
  productName: string;
  imageUrl: null;
  productSize: string | null;
  material: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  dimensionUnit: 'cm' | null;
  netWeight: null;
  grossWeight: null;
  cbm: number | null;
  priceUSD: number;
  currency: 'USD';
  exchangeRate: null;
};

export type ProductImportPreviewRow = ImportedProductPayload & {
  errors: string[];
  duplicate: boolean;
  valid: boolean;
};

export type ProductImportResult = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  products: ProductImportPreviewRow[];
  structureErrors: string[];
};

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim();
    }
    if ('result' in value) return String(value.result ?? '').trim();
    if ('text' in value) return String(value.text ?? '').trim();
    if ('hyperlink' in value && 'text' in value) return String(value.text ?? '').trim();
  }
  return String(value).trim();
}

function parseNumber(label: string, value: string, required: boolean, errors: string[]): number | null {
  const text = value.trim();
  if (!text) {
    if (required) errors.push(`${label} is required`);
    return null;
  }

  const numberText = text.replace(/[$,]/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(numberText)) {
    errors.push(`${label} must be a valid number`);
    return null;
  }

  const parsed = Number(numberText);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    errors.push(`${label} must be a positive number`);
    return null;
  }
  return parsed;
}

function formatMaterial(value: string): string | null {
  const material = value
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
  return material || null;
}

function productSizeFromDimensions(length: number | null, width: number | null, height: number | null): string | null {
  if (length == null || width == null || height == null) return null;
  return `${length} X ${width} X ${height} cm`;
}

function isDataRow(values: Record<HeaderName, string>): boolean {
  return PRODUCT_IMPORT_HEADERS.some((header) => values[header].trim() !== '');
}

function isXlsxFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.xlsx');
}

function rowPayload(sourceRow: number, values: Record<HeaderName, string>, existingArticleNumbers: Set<string>): ProductImportPreviewRow {
  const errors: string[] = [];
  const articleNumber = values['Article No.'].trim();
  if (!articleNumber) errors.push('Article No. is required');

  const length = parseNumber('Carton Size - Length', values['Carton Size - Length'], false, errors);
  const width = parseNumber('Carton Size - Width', values['Carton Size - Width'], false, errors);
  const height = parseNumber('Carton Size - Height', values['Carton Size - Height'], false, errors);
  const anyDimension = length != null || width != null || height != null;
  if (anyDimension && (length == null || width == null || height == null)) {
    errors.push('Carton Size Length, Width and Height are all required when any carton dimension is provided');
  }

  const providedCbm = parseNumber('CBM / Carton', values['CBM / Carton'], false, errors);
  const cbm = providedCbm ?? (length != null && width != null && height != null
    ? Number((length * width * height * UNIT_TO_CBM_FACTOR).toFixed(3))
    : null);
  const priceUSD = parseNumber('Price in USD($)', values['Price in USD($)'], true, errors);
  const duplicate = articleNumber ? existingArticleNumbers.has(articleNumber.toLowerCase()) : false;
  if (duplicate) errors.push('Article No already exists');

  return {
    sourceRow,
    articleNumber,
    productName: articleNumber,
    imageUrl: null,
    productSize: values['Product Size'].trim() || productSizeFromDimensions(length, width, height),
    material: formatMaterial(values['Material(s)']),
    length,
    width,
    height,
    dimensionUnit: anyDimension ? 'cm' : null,
    netWeight: null,
    grossWeight: null,
    cbm,
    priceUSD: priceUSD ?? 0,
    currency: 'USD',
    exchangeRate: null,
    errors,
    duplicate,
    valid: errors.length === 0
  };
}

export async function parseProductImportWorkbook(file: File, existingItems: Item[]): Promise<ProductImportResult> {
  if (!isXlsxFile(file)) {
    return {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      products: [],
      structureErrors: ['Only .xlsx Excel files are supported']
    };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer as ExcelJS.Buffer);
  } catch {
    return {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      products: [],
      structureErrors: ['The selected file is not a valid Excel workbook']
    };
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      products: [],
      structureErrors: ['The workbook does not contain any worksheets']
    };
  }

  const headerRow = worksheet.getRow(1);
  const headerIndexes = new Map<HeaderName, number>();
  const missingHeaders: string[] = [];
  for (const header of PRODUCT_IMPORT_HEADERS) {
    let columnIndex = 0;
    headerRow.eachCell((cell, index) => {
      if (cellText(cell) === header) columnIndex = index;
    });
    if (columnIndex === 0) missingHeaders.push(header);
    else headerIndexes.set(header, columnIndex);
  }

  if (missingHeaders.length > 0) {
    return {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      products: [],
      structureErrors: [`Missing required header(s): ${missingHeaders.join(', ')}`]
    };
  }

  const existingArticleNumbers = new Set(existingItems.map((item) => item.articleNumber.toLowerCase()));
  const products: ProductImportPreviewRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = PRODUCT_IMPORT_HEADERS.reduce((acc, header) => {
      acc[header] = cellText(row.getCell(headerIndexes.get(header)!));
      return acc;
    }, {} as Record<HeaderName, string>);
    if (!isDataRow(values)) return;
    products.push(rowPayload(rowNumber, values, existingArticleNumbers));
  });

  const seen = new Map<string, ProductImportPreviewRow[]>();
  for (const product of products) {
    if (!product.articleNumber) continue;
    const key = product.articleNumber.toLowerCase();
    seen.set(key, [...(seen.get(key) ?? []), product]);
  }
  for (const duplicateSet of seen.values()) {
    if (duplicateSet.length <= 1) continue;
    for (const product of duplicateSet) {
      product.duplicate = true;
      product.errors.push('Duplicate Article No in uploaded file');
      product.valid = false;
    }
  }

  if (products.length === 0) {
    return {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      products: [],
      structureErrors: ['The workbook does not contain any product rows']
    };
  }

  const invalidRows = products.filter((product) => !product.valid).length;
  const duplicateRows = products.filter((product) => product.duplicate).length;
  return {
    totalRows: products.length,
    validRows: products.length - invalidRows,
    invalidRows,
    duplicateRows,
    products,
    structureErrors: []
  };
}

export async function downloadProductImportTemplate(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'InGen';
  workbook.created = new Date();
  workbook.modified = new Date();
  const worksheet = workbook.addWorksheet('Products', { views: [{ state: 'frozen', ySplit: 1 }] });
  worksheet.columns = [
    { width: 18 },
    { width: 26 },
    { width: 24 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
    { width: 18 },
    { width: 35 },
    { width: 18 }
  ];

  const headerRow = worksheet.addRow([...PRODUCT_IMPORT_HEADERS]);
  headerRow.height = 34;
  for (let columnNumber = 1; columnNumber <= PRODUCT_IMPORT_HEADERS.length; columnNumber += 1) {
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
  worksheet.autoFilter = { from: 'A1', to: 'I1' };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], { type: XLSX_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'InGen_Product_Import_Template.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
