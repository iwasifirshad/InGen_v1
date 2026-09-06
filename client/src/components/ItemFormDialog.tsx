import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Stack, Avatar, Alert, IconButton, Typography,
  MenuItem, InputAdornment
} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CalculateIcon from '@mui/icons-material/Calculate';
import { CURRENCY_OPTIONS, Currency, DIMENSION_UNIT_OPTIONS, DimensionUnit, Item } from '../types';
import { api } from '../api/client';

async function fetchInrRate(currency: Currency, signal: AbortSignal): Promise<number> {
//const res = await fetch(`https://open.er-api.com/v6/latest/${currency}`, { signal });
  const res = {
  ok: true,
  status: 200,
  json: async () => ({
    result: "success",
    provider: "https://www.exchangerate-api.com",
    documentation: "https://www.exchangerate-api.com/docs/free",
    terms_of_use: "https://www.exchangerate-api.com/terms",
    time_last_update_unix: 1783382551,
    time_last_update_utc: "Tue, 07 Jul 2026 00:02:31 +0000",
    time_next_update_unix: 1783470221,
    time_next_update_utc: "Wed, 08 Jul 2026 00:23:41 +0000",
    base_code: "USD",
    rates: {
      USD: 1,
      INR: 101.26,
      EUR: 0.874637
      // ...add any other currencies you need
    }
  })
};

  if (!res.ok) throw new Error(`Rate request failed (${res.status})`);
  const data = await res.json();
  const rate = data?.rates?.INR;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error('Invalid rate response');
  }
  return rate;
}

const UNIT_TO_METERS: Record<DimensionUnit, number> = {
  cm: 0.01,
  in: 0.0254,
  ft: 0.3048
};

function computeCbm(length: string, width: string, height: string, unit: DimensionUnit): string {
  const l = Number(length);
  const w = Number(width);
  const h = Number(height);
  if (length === '' || width === '' || height === '') return '';
  if (!Number.isFinite(l) || !Number.isFinite(w) || !Number.isFinite(h)) return '';
  if (l <= 0 || w <= 0 || h <= 0) return '';
  const m = UNIT_TO_METERS[unit];
  return (l * m * w * m * h * m).toFixed(3);
}

const MAX_MATERIALS = 5;

type MaterialRow = { name: string; breakup: string };

const emptyMaterialRow: MaterialRow = { name: '', breakup: '' };

function parseMaterials(raw: string | null | undefined): MaterialRow[] {
  if (!raw) return [{ ...emptyMaterialRow }];
  const rows = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(':');
      if (idx === -1) return { name: part, breakup: '' };
      return {
        name: part.slice(0, idx).trim(),
        breakup: part.slice(idx + 1).trim()
      };
    });
  return rows.length ? rows.slice(0, MAX_MATERIALS) : [{ ...emptyMaterialRow }];
}

function serializeMaterials(rows: MaterialRow[]): string {
  return rows
    .map((r) => ({ name: r.name.trim(), breakup: r.breakup.trim() }))
    .filter((r) => r.name || r.breakup)
    .map((r) => (r.breakup ? `${r.name}: ${r.breakup}` : r.name))
    .join(', ');
}

type Props = {
  open: boolean;
  initial?: Item | null;
  onClose: () => void;
  onSaved: () => void;
};

const empty = {
  articleNumber: '',
  productName: '',
  imageUrl: '' as string | null,
  productSize: '',
  length: '' as string,
  width: '' as string,
  height: '' as string,
  dimensionUnit: 'cm' as DimensionUnit,
  netWeight: '' as string,
  grossWeight: '' as string,
  priceUSD: '' as string,
  currency: 'USD' as Currency
};

export default function ItemFormDialog({ open, initial, onClose, onSaved }: Props) {
  const [form, setForm] = useState(empty);
  const [materials, setMaterials] = useState<MaterialRow[]>([{ ...emptyMaterialRow }]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ length?: string; width?: string; height?: string }>({});
  const [previewOpen, setPreviewOpen] = useState(false);

  const [storedRate, setStoredRate] = useState<{ currency: Currency; rate: number } | null>(null);
  const [liveRate, setLiveRate] = useState<number | null>(null);
  const [rateStatus, setRateStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const priceDirtyRef = useRef(false);

  const cbm = useMemo(
    () => computeCbm(form.length, form.width, form.height, form.dimensionUnit),
    [form.length, form.width, form.height, form.dimensionUnit]
  );

  const validateDimension = (v: string): string | undefined => {
    if (v === '') return undefined;
    if (!/^\d*\.?\d+$/.test(v)) return 'Enter a valid number';
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return 'Must be a positive number';
    return undefined;
  };

  useEffect(() => {
    if (open) {
      setError(null);
      setFieldErrors({});
      setLiveRate(null);
      setRateStatus('idle');
      priceDirtyRef.current = false;
      if (initial) {
        setForm({
          articleNumber: initial.articleNumber,
          productName: initial.productName,
          imageUrl: initial.imageUrl ?? '',
          productSize: initial.productSize ?? '',
          length: initial.length == null ? '' : String(initial.length),
          width: initial.width == null ? '' : String(initial.width),
          height: initial.height == null ? '' : String(initial.height),
          dimensionUnit: initial.dimensionUnit ?? 'cm',
          netWeight: initial.netWeight == null ? '' : String(initial.netWeight),
          grossWeight: initial.grossWeight == null ? '' : String(initial.grossWeight),
          priceUSD: String(initial.priceUSD),
          currency: initial.currency ?? 'USD'
        });
        setStoredRate(
          initial.currency && initial.exchangeRate != null
            ? { currency: initial.currency, rate: initial.exchangeRate }
            : null
        );
        setMaterials(parseMaterials(initial.material));
      } else {
        setForm(empty);
        setStoredRate(null);
        setMaterials([{ ...emptyMaterialRow }]);
      }
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    if (!priceDirtyRef.current && storedRate && storedRate.currency === form.currency) {
      return;
    }
    const controller = new AbortController();
    setRateStatus('loading');
    fetchInrRate(form.currency, controller.signal)
      .then((rate) => {
        setLiveRate(rate);
        setRateStatus('ok');
      })
      .catch((e: any) => {
        if (e?.name === 'AbortError') return;
        setLiveRate(null);
        setRateStatus('error');
      });
    return () => controller.abort();
  }, [open, form.currency, storedRate]);

  const displayedRate: { rate: number; source: 'stored' | 'live' } | null =
    !priceDirtyRef.current && storedRate && storedRate.currency === form.currency
      ? { rate: storedRate.rate, source: 'stored' }
      : liveRate != null
      ? { rate: liveRate, source: 'live' }
      : null;

  const rateHelperText =
    rateStatus === 'loading' && !displayedRate
      ? 'Fetching exchange rate...'
      : rateStatus === 'error' && !displayedRate
      ? 'Exchange rate unavailable.'
      : displayedRate
      ? `Exchange rate: 1 ${form.currency} = ₹${displayedRate.rate.toFixed(2)}`
      : ' ';

  const updateMaterial = (index: number, field: keyof MaterialRow, value: string) => {
    setMaterials((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addMaterial = () => {
    setMaterials((rows) => (rows.length >= MAX_MATERIALS ? rows : [...rows, { ...emptyMaterialRow }]));
  };

  const removeMaterial = (index: number) => {
    setMaterials((rows) => (rows.length === 1 ? [{ ...emptyMaterialRow }] : rows.filter((_, i) => i !== index)));
  };

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const { url } = await api.upload(file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError(null);
    if (!form.articleNumber.trim() || !form.productName.trim() || !form.priceUSD) {
      setError('Article number, product name and price are required');
      return;
    }
    const anyDim = form.length !== '' || form.width !== '' || form.height !== '';
    const allDim = form.length !== '' && form.width !== '' && form.height !== '';
    const dimErrors: { length?: string; width?: string; height?: string } = {
      length: validateDimension(form.length),
      width: validateDimension(form.width),
      height: validateDimension(form.height)
    };
    if (anyDim && !allDim) {
      if (form.length === '') dimErrors.length = 'Required';
      if (form.width === '') dimErrors.width = 'Required';
      if (form.height === '') dimErrors.height = 'Required';
    }
    if (dimErrors.length || dimErrors.width || dimErrors.height) {
      setFieldErrors(dimErrors);
      setError('Please fix carton dimension values');
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const materialStr = serializeMaterials(materials);
      const anyDimension = form.length !== '' || form.width !== '' || form.height !== '';
      const rateToPersist =
        !priceDirtyRef.current && storedRate && storedRate.currency === form.currency
          ? storedRate.rate
          : liveRate;
      const payload = {
        articleNumber: form.articleNumber.trim(),
        productName: form.productName.trim(),
        imageUrl: form.imageUrl || null,
        productSize: form.productSize || null,
        material: materialStr || null,
        length: form.length === '' ? null : Number(form.length),
        width: form.width === '' ? null : Number(form.width),
        height: form.height === '' ? null : Number(form.height),
        dimensionUnit: anyDimension ? form.dimensionUnit : null,
        netWeight: form.netWeight === '' ? null : Number(form.netWeight),
        grossWeight: form.grossWeight === '' ? null : Number(form.grossWeight),
        cbm: cbm === '' ? null : Number(cbm),
        priceUSD: Number(form.priceUSD),
        currency: form.currency,
        exchangeRate: rateToPersist ?? null
      };
      if (initial) {
        await api.put(`/api/items/${initial.id}`, payload);
      } else {
        await api.post('/api/items', payload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{initial ? 'Edit Product' : 'Add New Product'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Article Number"
            required
            value={form.articleNumber}
            onChange={(e) => setForm({ ...form, articleNumber: e.target.value })}
            fullWidth
          />
          <TextField
            label="Product Name"
            required
            value={form.productName}
            onChange={(e) => setForm({ ...form, productName: e.target.value })}
            fullWidth
          />
          <Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  position: 'relative',
                  flexShrink: 0
                }}
              >
                <Avatar
                  variant="rounded"
                  src={form.imageUrl || undefined}
                  onClick={() => form.imageUrl && setPreviewOpen(true)}
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: 'grey.200',
                    cursor: form.imageUrl ? 'zoom-in' : 'default',
                    transformOrigin: 'top left',
                    transition: 'transform 200ms ease-in-out, box-shadow 200ms ease-in-out',
                    boxShadow: 0,
                    '&:hover': form.imageUrl
                      ? {
                          transform: 'scale(2)',
                          boxShadow: 6,
                          zIndex: (t) => t.zIndex.modal + 1
                        }
                      : undefined
                  }}
                >
                  IMG
                </Avatar>
              </Box>
              <Button
                component="label"
                variant="outlined"
                startIcon={<UploadIcon />}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Image'}
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                  }}
                />
              </Button>
            </Stack>
          </Box>
          <TextField
            label="Product Size"
            placeholder="e.g. 55 x 55 x 49 cm"
            value={form.productSize}
            onChange={(e) => setForm({ ...form, productSize: e.target.value })}
            fullWidth
          />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Material
            </Typography>
            <Stack spacing={1}>
              {materials.map((row, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <TextField
                    label="Material"
                    placeholder="e.g. Iron"
                    value={row.name}
                    onChange={(e) => updateMaterial(i, 'name', e.target.value)}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Breakup"
                    placeholder="e.g. 5 gms"
                    value={row.breakup}
                    onChange={(e) => updateMaterial(i, 'breakup', e.target.value)}
                    fullWidth
                    size="small"
                  />
                  <IconButton
                    aria-label="Remove material"
                    onClick={() => removeMaterial(i)}
                    disabled={materials.length === 1 && !row.name && !row.breakup}
                    size="small"
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              {materials.length < MAX_MATERIALS && (
                <Box>
                  <Button
                    onClick={addMaterial}
                    startIcon={<AddIcon />}
                    size="small"
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Add Material
                  </Button>
                </Box>
              )}
            </Stack>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Carton Dimensions
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ xs: 'stretch', sm: 'flex-start' }}
            >
              <TextField
                label="Length"
                type="number"
                inputProps={{ min: 0, step: 'any' }}
                value={form.length}
                onChange={(e) => setForm({ ...form, length: e.target.value })}
                error={Boolean(fieldErrors.length)}
                helperText={fieldErrors.length}
                fullWidth
              />
              <TextField
                label="Width"
                type="number"
                inputProps={{ min: 0, step: 'any' }}
                value={form.width}
                onChange={(e) => setForm({ ...form, width: e.target.value })}
                error={Boolean(fieldErrors.width)}
                helperText={fieldErrors.width}
                fullWidth
              />
              <TextField
                label="Height"
                type="number"
                inputProps={{ min: 0, step: 'any' }}
                value={form.height}
                onChange={(e) => setForm({ ...form, height: e.target.value })}
                error={Boolean(fieldErrors.height)}
                helperText={fieldErrors.height}
                fullWidth
              />
              <TextField
                label="Unit"
                select
                value={form.dimensionUnit}
                onChange={(e) => setForm({ ...form, dimensionUnit: e.target.value as DimensionUnit })}
                fullWidth
              >
                {DIMENSION_UNIT_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Box>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Net Weight (kg)"
              type="number"
              inputProps={{ step: '0.1' }}
              value={form.netWeight}
              onChange={(e) => setForm({ ...form, netWeight: e.target.value })}
              fullWidth
            />
            <TextField
              label="Gross Weight (kg)"
              type="number"
              inputProps={{ step: '0.1' }}
              value={form.grossWeight}
              onChange={(e) => setForm({ ...form, grossWeight: e.target.value })}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <TextField
                label="CBM (m³ per carton)"
                value={cbm === '' ? '' : `${cbm} m³`}
                placeholder="Auto-calculated from dimensions"
                fullWidth
                InputProps={{
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalculateIcon fontSize="small" color="action" />
                    </InputAdornment>
                  )
                }}
                helperText="Auto-calculated from Length × Width × Height"
                sx={{
                  '& .MuiInputBase-input': { fontVariantNumeric: 'tabular-nums' },
                  '& .MuiInputBase-root': { bgcolor: 'action.hover' }
                }}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Currency"
                  select
                  value={form.currency}
                  onChange={(e) => {
                    priceDirtyRef.current = true;
                    setForm({ ...form, currency: e.target.value as Currency });
                  }}
                  sx={{ width: 110 }}
                >
                  {CURRENCY_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Price"
                  type="number"
                  required
                  inputProps={{ step: '0.01', min: 0 }}
                  value={form.priceUSD}
                  onChange={(e) => {
                    priceDirtyRef.current = true;
                    setForm({ ...form, priceUSD: e.target.value });
                  }}
                  helperText={rateHelperText}
                  FormHelperTextProps={{
                    sx: {
                      color: rateStatus === 'error' && !displayedRate ? 'error.main' : 'text.secondary'
                    }
                  }}
                  fullWidth
                />
              </Stack>
              {initial?.priceUpdatedAt && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 0.5 }}>
                  Last updated: {new Date(initial.priceUpdatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </Typography>
              )}
            </Box>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={save} variant="contained" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
      <Dialog
        open={previewOpen && Boolean(form.imageUrl)}
        onClose={() => setPreviewOpen(false)}
        maxWidth="lg"
        PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none', cursor: 'zoom-out' } }}
        onClick={() => setPreviewOpen(false)}
      >
        {form.imageUrl && (
          <Box
            component="img"
            src={form.imageUrl}
            alt="Product preview"
            sx={{
              display: 'block',
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 1
            }}
          />
        )}
      </Dialog>
    </Dialog>
  );
}
