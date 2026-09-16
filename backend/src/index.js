import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import familiesRouter from './routes/families.js';
import productsRouter from './routes/products.js';
import referencesRouter from './routes/references.js';
import importRouter from './routes/import.js';
import contactRouter from './routes/contact.js';
import pricingRouter from './routes/pricing.js';
import configRouter from './routes/config.js';
import authRouter from './routes/auth.js';
import quotesRouter from './routes/quotes.js';
import ordersRouter, { adminRouter as adminOrdersRouter } from './routes/orders.js';
import { attachUser } from './middleware/userAuth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 4000;
const isProd = process.env.NODE_ENV === 'production';
const uploadDir = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || './uploads');
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: frontendOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-Admin-Key'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(attachUser);
app.use('/uploads', express.static(uploadDir));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de demandes. Réessayez plus tard.' },
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'AfeconCatalogue' });
});

app.use('/api/families', familiesRouter);
app.use('/api/products', productsRouter);
app.use('/api/references', referencesRouter);
app.use('/api/import', importRouter);
app.use('/api/contact', contactLimiter, contactRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/config', configRouter);
app.use('/api/auth', authRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin/orders', adminOrdersRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: isProd ? 'Erreur serveur' : err.message || 'Erreur serveur',
  });
});

const server = app.listen(PORT, () => {
  console.log(`AfeconCatalogue API on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n[api] Port ${PORT} déjà utilisé. Libérez-le puis relancez :\n` +
        `  lsof -ti :${PORT} | xargs kill -9\n` +
        `  npm run dev\n`
    );
    process.exit(1);
  }
  throw err;
});
