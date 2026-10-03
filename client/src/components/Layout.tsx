import { ReactNode } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Box, Button, Container } from '@mui/material';
import ReceiptIcon from '@mui/icons-material/Receipt';

const links = [
  { to: '/', label: 'Item Master' },
  { to: '/invoices/new', label: 'New Quotation' },
  { to: '/invoices', label: 'Invoices' }
];

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <ReceiptIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mr: 4 }}>
            InGen
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexGrow: 1 }}>
            {links.map((l) => {
              const active = l.to === '/' ? pathname === '/' : pathname.startsWith(l.to);
              return (
                <Button
                  key={l.to}
                  component={RouterLink}
                  to={l.to}
                  color="inherit"
                  variant={active ? 'outlined' : 'text'}
                  sx={{ borderColor: 'rgba(255,255,255,0.5)' }}
                >
                  {l.label}
                </Button>
              );
            })}
          </Box>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3, flexGrow: 1 }}>
        {children}
      </Container>
    </Box>
  );
}
