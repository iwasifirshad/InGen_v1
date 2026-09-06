import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { itemsRouter } from './routes/items';
import { invoicesRouter } from './routes/invoices';
import { uploadsRouter } from './middleware/upload';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/items', itemsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/uploads', uploadsRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`InGen server listening on http://localhost:${PORT}`);
});
