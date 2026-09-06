import { useEffect, useState } from 'react';
import { Box, Typography, Button, Snackbar, Alert } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Invoice } from '../types';
import { api } from '../api/client';

export default function InvoiceList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Invoice[]>('/api/invoices')
      .then(setInvoices)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const columns: GridColDef<Invoice>[] = [
    { field: 'invoiceNumber', headerName: 'Invoice No', width: 160 },
    {
      field: 'invoiceDate',
      headerName: 'Date',
      width: 130,
      valueFormatter: (v: any) => (v ? String(v).slice(0, 10) : '')
    },
    { field: 'customerName', headerName: 'Customer', flex: 1, minWidth: 200 },
    {
      field: 'items',
      headerName: 'Items',
      width: 90,
      valueGetter: (_v, row) => row.items?.length ?? 0
    },
    {
      field: 'totalUSD',
      headerName: 'Total (USD)',
      width: 140,
      type: 'number',
      valueFormatter: (v: any) => (v == null ? '' : `$${Number(v).toFixed(2)}`)
    },
    {
      field: 'actions',
      headerName: 'Download',
      width: 140,
      sortable: false,
      filterable: false,
      renderCell: (p) => (
        <Button
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => window.open(`/api/invoices/${p.row.id}/pdf`, '_blank')}
        >
          PDF
        </Button>
      )
    }
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>Invoices</Typography>
      <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
        <DataGrid
          rows={invoices}
          columns={columns}
          loading={loading}
          autoHeight
          disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </Box>
      <Snackbar open={!!error} autoHideDuration={4000} onClose={() => setError(null)}>
        {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
