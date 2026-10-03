import { ChangeEvent, DragEvent, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Item } from '../types';
import { api } from '../api/client';
import type { ProductImportResult } from '../services/productImportExcel';

type Props = {
  open: boolean;
  existingItems: Item[];
  onClose: () => void;
  onImported: (count: number) => void;
};

type ServerRowError = { row: number; articleNumber?: string; errors: string[] };

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function valueText(value: string | number | null): string {
  return value === null || value === '' ? '-' : String(value);
}

export default function BulkImportDialog({ open, existingItems, onClose, onImported }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ProductImportResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<ServerRowError[]>([]);

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setResult(null);
      setParsing(false);
      setImporting(false);
      setError(null);
      setServerErrors([]);
    }
  }, [open]);

  const parseFile = async (file: File) => {
    setSelectedFile(file);
    setResult(null);
    setError(null);
    setServerErrors([]);
    setParsing(true);
    try {
      const { parseProductImportWorkbook } = await import('../services/productImportExcel');
      setResult(await parseProductImportWorkbook(file, existingItems));
    } catch (e: any) {
      setError(e.message || 'Unable to parse the selected Excel file');
    } finally {
      setParsing(false);
    }
  };

  const handleBrowse = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) parseFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const handleImport = async () => {
    if (!result || result.invalidRows > 0 || result.totalRows === 0) return;
    setImporting(true);
    setError(null);
    setServerErrors([]);
    try {
      const payload = result.products.map(({ errors, duplicate, valid, ...product }) => product);
      const response = await api.post<{ imported: number }>('/api/items/bulk', { items: payload });
      onImported(response.imported);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Bulk import failed');
      if (Array.isArray(e.details)) setServerErrors(e.details);
    } finally {
      setImporting(false);
    }
  };

  const canImport = !!result && result.structureErrors.length === 0 && result.invalidRows === 0 && result.totalRows > 0 && !parsing && !importing;

  return (
    <Dialog open={open} onClose={importing ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Bulk Import Products</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {result?.structureErrors.map((message) => <Alert severity="error" key={message}>{message}</Alert>)}
          {serverErrors.length > 0 && (
            <Alert severity="error">
              <Stack spacing={0.5}>
                {serverErrors.map((rowError, index) => (
                  <Typography variant="body2" key={`${rowError.row}-${index}`}>
                    Row {rowError.row}: {rowError.errors.join('; ')}
                  </Typography>
                ))}
              </Stack>
            </Alert>
          )}

          <Box
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            sx={{
              border: '1px dashed',
              borderColor: 'primary.main',
              borderRadius: 1,
              bgcolor: 'primary.50',
              p: 3,
              textAlign: 'center'
            }}
          >
            <UploadFileIcon color="primary" sx={{ fontSize: 42, mb: 1 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Drop an .xlsx file here</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              or browse from your computer
            </Typography>
            <Stack direction="row" spacing={1.5} justifyContent="center">
              <Button component="label" variant="contained" startIcon={<CloudUploadIcon />} disabled={parsing || importing}>
                Browse File
                <input hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleBrowse} />
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={async () => {
                  const { downloadProductImportTemplate } = await import('../services/productImportExcel');
                  await downloadProductImportTemplate();
                }}
                disabled={importing}
              >
                Download Excel Template
              </Button>
            </Stack>
          </Box>

          {selectedFile && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={selectedFile.name} />
              <Typography variant="body2" color="text.secondary">{formatFileSize(selectedFile.size)}</Typography>
            </Stack>
          )}

          {parsing && <LinearProgress />}

          {result && result.structureErrors.length === 0 && (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Chip label={`Total rows: ${result.totalRows}`} />
                <Chip color="success" label={`Valid rows: ${result.validRows}`} />
                <Chip color={result.invalidRows > 0 ? 'error' : 'default'} label={`Invalid rows: ${result.invalidRows}`} />
                <Chip color={result.duplicateRows > 0 ? 'warning' : 'default'} label={`Duplicate rows: ${result.duplicateRows}`} />
              </Stack>

              {result.invalidRows > 0 && (
                <Alert severity="error">
                  Fix every row-level error before importing. No products will be imported while this file has invalid rows.
                </Alert>
              )}

              <Divider />
              <TableContainer sx={{ maxHeight: 360 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Row</TableCell>
                      <TableCell>Article No.</TableCell>
                      <TableCell>Product Size</TableCell>
                      <TableCell align="right">Length</TableCell>
                      <TableCell align="right">Width</TableCell>
                      <TableCell align="right">Height</TableCell>
                      <TableCell align="right">CBM</TableCell>
                      <TableCell>Material(s)</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.products.map((product) => (
                      <TableRow key={product.sourceRow} hover>
                        <TableCell>{product.sourceRow}</TableCell>
                        <TableCell>{valueText(product.articleNumber)}</TableCell>
                        <TableCell>{valueText(product.productSize)}</TableCell>
                        <TableCell align="right">{valueText(product.length)}</TableCell>
                        <TableCell align="right">{valueText(product.width)}</TableCell>
                        <TableCell align="right">{valueText(product.height)}</TableCell>
                        <TableCell align="right">{product.cbm == null ? '-' : product.cbm.toFixed(3)}</TableCell>
                        <TableCell>{valueText(product.material)}</TableCell>
                        <TableCell align="right">{product.priceUSD ? product.priceUSD.toFixed(2) : '-'}</TableCell>
                        <TableCell sx={{ minWidth: 220 }}>
                          {product.valid ? (
                            <Chip color="success" size="small" label="Valid" />
                          ) : (
                            <Typography variant="body2" color="error">
                              Row {product.sourceRow}: {product.errors.join('; ')}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={importing}>Cancel</Button>
        <Button variant="contained" onClick={handleImport} disabled={!canImport}>
          {importing ? 'Importing...' : 'Import Products'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
