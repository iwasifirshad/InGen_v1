import { useEffect, useState } from 'react';
import { Box, Button, Stack, Typography, Avatar, IconButton, Snackbar, Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { DataGrid, GridColDef, GridToolbarQuickFilter, GridToolbarContainer } from '@mui/x-data-grid';
import { Item } from '../types';
import { api } from '../api/client';
import ItemFormDialog from '../components/ItemFormDialog';
import BulkImportDialog from '../components/BulkImportDialog';

function Toolbar() {
  return (
    <GridToolbarContainer sx={{ p: 1, justifyContent: 'flex-end' }}>
      <GridToolbarQuickFilter />
    </GridToolbarContainer>
  );
}

export default function ItemMaster() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await api.get<Item[]>('/api/items'));
    } catch (e: any) {
      setToast({ msg: e.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this item?')) return;
    try {
      await api.del(`/api/items/${id}`);
      setToast({ msg: 'Item deleted', severity: 'success' });
      load();
    } catch (e: any) {
      setToast({ msg: e.message, severity: 'error' });
    }
  };

  const columns: GridColDef<Item>[] = [
    {
      field: 'imageUrl',
      headerName: 'Image',
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (p) => (
        <Avatar
          src={p.value || undefined}
          variant="rounded"
          sx={{ width: 48, height: 48, bgcolor: 'grey.200', fontSize: 11 }}
        >
          IMG
        </Avatar>
      )
    },
    { field: 'articleNumber', headerName: 'Article No', width: 130 },
    { field: 'productName', headerName: 'Product Name', flex: 1, minWidth: 200 },
    { field: 'productSize', headerName: 'Size', width: 150 },
    {
      field: 'netWeight',
      headerName: 'Weight (kg)',
      width: 110,
      type: 'number',
      valueFormatter: (v: any) => (v == null ? '' : Number(v).toFixed(2))
    },
    {
      field: 'priceUSD',
      headerName: 'Price (USD)',
      width: 120,
      type: 'number',
      valueFormatter: (v: any) => (v == null ? '' : `$${Number(v).toFixed(2)}`)
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 110,
      sortable: false,
      filterable: false,
      renderCell: (p) => (
        <Box>
          <IconButton size="small" onClick={() => { setEditing(p.row); setDialogOpen(true); }}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => handleDelete(p.row.id)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      )
    }
  ];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>Item Master</Typography>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            onClick={() => setBulkDialogOpen(true)}
          >
            Bulk Import
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setEditing(null); setDialogOpen(true); }}
          >
            Add New Product
          </Button>
        </Stack>
      </Stack>
      <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
        <DataGrid
          rows={items}
          columns={columns}
          loading={loading}
          autoHeight
          rowHeight={64}
          disableRowSelectionOnClick
          slots={{ toolbar: Toolbar }}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </Box>
      <ItemFormDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { load(); setToast({ msg: 'Saved', severity: 'success' }); }}
      />
      <BulkImportDialog
        open={bulkDialogOpen}
        existingItems={items}
        onClose={() => setBulkDialogOpen(false)}
        onImported={(count) => { load(); setToast({ msg: `${count} products imported`, severity: 'success' }); }}
      />
      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {toast ? <Alert severity={toast.severity} onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
