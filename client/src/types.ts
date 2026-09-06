export type DimensionUnit = 'cm' | 'in' | 'ft';

export const DIMENSION_UNIT_OPTIONS: { value: DimensionUnit; label: string }[] = [
  { value: 'cm', label: 'Centimeters (cm)' },
  { value: 'in', label: 'Inches (in)' },
  { value: 'ft', label: 'Feet (ft)' }
];

export type Currency = 'USD' | 'EUR';

export const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' }
];

export interface Item {
  id: number;
  articleNumber: string;
  productName: string;
  imageUrl: string | null;
  productSize: string | null;
  material: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  dimensionUnit: DimensionUnit | null;
  netWeight: number | null;
  grossWeight: number | null;
  cbm: number | null;
  priceUSD: number;
  currency: Currency | null;
  exchangeRate: number | null;
  priceUpdatedAt?: string | null;
  createdAt?: string;
}

export interface InvoiceItem {
  id: number;
  invoiceId: number;
  itemId: number;
  articleNumber: string;
  productName: string;
  productSize: string | null;
  material: string | null;
  netWeight: number | null;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
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
  items: InvoiceItem[];
}
