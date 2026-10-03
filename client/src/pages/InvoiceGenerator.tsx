import { useEffect, useState } from 'react';
import {
  Box, Paper, Stack, Typography, TextField, Avatar,
  Table, TableBody, TableCell, TableHead, TableRow, IconButton,
  Button, Snackbar, Alert, Divider
} from '@mui/material';

const fieldRow = { display: 'flex', flexDirection: { xs: 'column', md: 'row' } as const, gap: 2 };
import DeleteIcon from '@mui/icons-material/Delete';
import TableViewIcon from '@mui/icons-material/TableView';
import { Item } from '../types';
import { api } from '../api/client';
import ItemPicker from '../components/ItemPicker';

type Line = {
  item: Item;
  quantity: number;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function InvoiceGenerator() {
  const [items, setItems] = useState<Item[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [meta, setMeta] = useState({
    customerName: '',
    consigneeAddress: '',
    countryOfOrigin: 'INDIA',
    countryOfDestination: '',
    preCarriedBy: '',
    placeOfReceipt: '',
    vesselFlightNo: '',
    portOfLoading: '',
    portOfDischarge: '',
    finalDestination: '',
    paymentTerms: '100% Advance',
    invoiceDate: todayISO()
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    api.get<Item[]>('/api/items').then(setItems).catch((e) => setToast({ msg: e.message, severity: 'error' }));
  }, []);

  const addLine = (it: Item) => {
    setLines((prev) => [
      ...prev,
      {
        item: it,
        quantity: 1
      }
    ]);
  };

  const setQuantity = (idx: number, q: number) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: q } : l)));
  };

  const remove = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const total = lines.reduce((s, l) => s + l.quantity * l.item.priceUSD, 0);

  const submit = async () => {
    if (lines.length === 0) {
      setToast({ msg: 'Add at least one item', severity: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const { generateQuotationExcel } = await import('../services/quotationExcel');
      await generateQuotationExcel(lines.map((line) => line.item), meta.invoiceDate);
      setToast({
        msg: `Quotation downloaded for ${lines.length} product${lines.length === 1 ? '' : 's'}`,
        severity: 'success'
      });
      setLines([]);
      setMeta({
        customerName: '',
        consigneeAddress: '',
        countryOfOrigin: 'INDIA',
        countryOfDestination: '',
        preCarriedBy: '',
        placeOfReceipt: '',
        vesselFlightNo: '',
        portOfLoading: '',
        portOfDischarge: '',
        finalDestination: '',
        paymentTerms: '100% Advance',
        invoiceDate: todayISO()
      });
    } catch (e: any) {
      setToast({ msg: e.message, severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>New Quotation</Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Quotation Information</Typography>
        <Stack spacing={2}>
          <Box sx={fieldRow}>
            <TextField
              label="Customer Name"
              fullWidth
              value={meta.customerName}
              onChange={(e) => setMeta({ ...meta, customerName: e.target.value })}
            />
            <TextField
              label="Quotation Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={meta.invoiceDate}
              onChange={(e) => setMeta({ ...meta, invoiceDate: e.target.value })}
            />
          </Box>
          <TextField
            label="Consignee Address"
            fullWidth
            multiline
            rows={3}
            value={meta.consigneeAddress}
            onChange={(e) => setMeta({ ...meta, consigneeAddress: e.target.value })}
          />
          <Box sx={fieldRow}>
            <TextField
              label="Country of Origin"
              fullWidth
              value={meta.countryOfOrigin}
              onChange={(e) => setMeta({ ...meta, countryOfOrigin: e.target.value })}
            />
            <TextField
              label="Country of Final Destination"
              fullWidth
              value={meta.countryOfDestination}
              onChange={(e) => setMeta({ ...meta, countryOfDestination: e.target.value })}
            />
          </Box>
          <TextField
            label="Payment Terms"
            fullWidth
            value={meta.paymentTerms}
            onChange={(e) => setMeta({ ...meta, paymentTerms: e.target.value })}
          />
        </Stack>
        <Divider sx={{ my: 3 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Transportation</Typography>
        <Stack spacing={2}>
          <Box sx={fieldRow}>
            <TextField
              label="Pre-Carried By"
              placeholder="e.g. Road"
              fullWidth
              value={meta.preCarriedBy}
              onChange={(e) => setMeta({ ...meta, preCarriedBy: e.target.value })}
            />
            <TextField
              label="Place of Receipt of Pre-carrier"
              fullWidth
              value={meta.placeOfReceipt}
              onChange={(e) => setMeta({ ...meta, placeOfReceipt: e.target.value })}
            />
          </Box>
          <Box sx={fieldRow}>
            <TextField
              label="Vessel / Flight No."
              placeholder="e.g. Sea"
              fullWidth
              value={meta.vesselFlightNo}
              onChange={(e) => setMeta({ ...meta, vesselFlightNo: e.target.value })}
            />
            <TextField
              label="Port of Loading"
              fullWidth
              value={meta.portOfLoading}
              onChange={(e) => setMeta({ ...meta, portOfLoading: e.target.value })}
            />
          </Box>
          <Box sx={fieldRow}>
            <TextField
              label="Port of Discharge"
              fullWidth
              value={meta.portOfDischarge}
              onChange={(e) => setMeta({ ...meta, portOfDischarge: e.target.value })}
            />
            <TextField
              label="Final Destination"
              fullWidth
              value={meta.finalDestination}
              onChange={(e) => setMeta({ ...meta, finalDestination: e.target.value })}
            />
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Products</Typography>
        <Box sx={{ mb: 2 }}>
          <ItemPicker items={items} onSelect={addLine} />
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={70}>Image</TableCell>
              <TableCell width={120}>Article No</TableCell>
              <TableCell>Description</TableCell>
              <TableCell width={90} align="right">Qty</TableCell>
              <TableCell width={120} align="right">Unit Price</TableCell>
              <TableCell width={120} align="right">Amount</TableCell>
              <TableCell width={50} />
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                  No items added. Use the search above.
                </TableCell>
              </TableRow>
            )}
            {lines.map((l, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <Avatar
                    src={l.item.imageUrl || undefined}
                    variant="rounded"
                    sx={{ width: 44, height: 44, bgcolor: 'grey.200', fontSize: 11 }}
                  >IMG</Avatar>
                </TableCell>
                <TableCell><strong>{l.item.articleNumber}</strong></TableCell>
                <TableCell>
                  <Box>{l.item.productName}</Box>
                  {l.item.productSize && (
                    <Box sx={{ fontSize: 12, color: 'text.secondary' }}>{l.item.productSize}</Box>
                  )}
                </TableCell>
                <TableCell align="right">
                  <TextField
                    type="number"
                    size="small"
                    inputProps={{ min: 1, style: { textAlign: 'right' } }}
                    value={l.quantity}
                    onChange={(e) => setQuantity(idx, Math.max(1, Number(e.target.value) || 1))}
                    sx={{ width: 80 }}
                  />
                </TableCell>
                <TableCell align="right">${l.item.priceUSD.toFixed(2)}</TableCell>
                <TableCell align="right"><strong>${(l.quantity * l.item.priceUSD).toFixed(2)}</strong></TableCell>
                <TableCell>
                  <IconButton size="small" color="error" onClick={() => remove(idx)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={2}>
          <Typography variant="h6">Total:</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, minWidth: 120, textAlign: 'right' }}>
            USD {total.toFixed(2)}
          </Typography>
        </Stack>
      </Paper>

      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          size="large"
          startIcon={<TableViewIcon />}
          disabled={submitting}
          onClick={submit}
        >
          {submitting ? 'Generating Quotation...' : 'Generate Quotation'}
        </Button>
      </Stack>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {toast ? <Alert severity={toast.severity} onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
