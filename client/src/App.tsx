import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ItemMaster from './pages/ItemMaster';
import InvoiceGenerator from './pages/InvoiceGenerator';
import InvoiceList from './pages/InvoiceList';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ItemMaster />} />
        <Route path="/invoices/new" element={<InvoiceGenerator />} />
        <Route path="/invoices" element={<InvoiceList />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
