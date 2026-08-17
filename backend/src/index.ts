// ⚠️ PRIMO IMPORT, e deve restarlo. Inizializza Sentry prima che express e i
// router vengano caricati: gli import sono valutati prima di ogni istruzione,
// quindi questo è l'unico punto in cui l'instrumentation arriva in tempo.
// Dettagli in `observability/sentry.ts`.
import './observability/sentry.js';
import * as Sentry from '@sentry/node';
import { isSentryEnabled } from './observability/sentry.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';

import { authRouter } from './routes/auth.js';
import { sparksRouter } from './routes/sparks.js';
import { tilesRouter } from './routes/tiles.js';
import { uploadRouter } from './routes/upload.js';
import { chatRouter } from './routes/chat.js';
import { aiRouter } from './routes/ai.js';
import { tagsRouter } from './routes/tags.js';
import { calendarRouter } from './routes/calendar.js';
import { settingsRouter } from './routes/settings.js';
import { tagTypesRouter } from './routes/tag-types.js';
import { statusesRouter } from './routes/statuses.js';
import { canvasRouter } from './routes/canvas.js';
import { typeIconsRouter } from './routes/type-icons.js';
import { subtasksRouter } from './routes/subtasks.js';
import { kanbanRouter } from './routes/kanban.js';
import { contactsRouter } from './routes/contacts.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Railway / Vercel / Heroku put us behind a reverse proxy. Without
// `trust proxy` Express sees only the proxy's IP in `req.ip`, so every
// rate limiter (signup, signin, password recovery) would share a single
// bucket across ALL users instead of one bucket per real client IP.
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
// CORS — whitelist of allowed front-end origins. The env var
// CORS_ORIGIN (comma-separated) wins; otherwise we fall back to the known
// production + dev domains so a missing/wrong env var never blows up
// signin from the real users.
const DEFAULT_CORS_ORIGINS = [
  'https://app.gimmickapp.com',
  'https://gimmick-frontend-production.up.railway.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3003',
];
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
  : DEFAULT_CORS_ORIGINS;
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (dev-friendly)
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

/**
 * Limite dedicato agli endpoint che spendono soldi veri a ogni chiamata: chat,
 * trascrizione, sintesi vocale, riscrittura, reindicizzazione. Il limite
 * generale sopra (1000 richieste / 15 min) non li protegge — è tarato sul
 * traffico di navigazione, dove mille richieste sono normali; qui mille
 * richieste sono mille chiamate a Claude e a OpenAI.
 *
 * Non è un problema di isolamento dei dati, è di bolletta: un token valido, un
 * ciclo `for`, e il conto lo paghi tu.
 *
 * La chiave è il TOKEN, non l'IP. Il limitatore è montato prima di
 * `authenticate`, quindi `req.user` non esiste ancora, ma l'header c'è: ne
 * prendo l'impronta. Così due utenti dietro la stessa rete non si rubano il
 * budget a vicenda, e chi non presenta un token ricade sull'IP.
 * Conseguenza voluta: sessioni diverse dello stesso utente hanno secchielli
 * distinti — accettabile, il limite serve a fermare gli script, non le persone.
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120, // ~8 al minuto sostenuti: abbondante per una persona, letale per un ciclo
  message: { error: 'Too many AI requests, please slow down.' },
  keyGenerator: (req) => {
    const auth = req.headers.authorization;
    return auth
      ? `t:${createHash('sha256').update(auth).digest('base64url').slice(0, 24)}`
      : `ip:${req.ip ?? 'unknown'}`;
  },
});

// Logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
// Le due rotte di reindicizzazione rilanciano l'intera pipeline AI su ogni
// spark: stesso costo per chiamata degli endpoint di chat, stesso limitatore.
app.use('/api/sparks/reindex-all', aiLimiter);
app.use('/api/sparks/:id/reindex', aiLimiter);
app.use('/api/sparks', sparksRouter);
app.use('/api/tiles', tilesRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/chat', aiLimiter, chatRouter);
app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/tag-types', tagTypesRouter);
app.use('/api/statuses', statusesRouter);
app.use('/api/canvas', canvasRouter);
app.use('/api/type-icons', typeIconsRouter);
app.use('/api/subtasks', subtasksRouter);
app.use('/api/kanban', kanbanRouter);
app.use('/api/contacts', contactsRouter);

// Error handling.
//
// `notFoundHandler` risponde 404 da sé e non chiama `next`, quindi le rotte
// inesistenti non passano di qui: Sentry non vedrà rumore da 404.
app.use(notFoundHandler);
// Handler di Sentry PRIMA di quello custom: cattura e rilancia, lasciando che
// sia `errorHandler` a rispondere al client esattamente come oggi. Montato solo
// quando Sentry è attivo, così in sviluppo la catena dei middleware resta
// identica a prima.
if (isSentryEnabled()) {
  Sentry.setupExpressErrorHandler(app);
}
app.use(errorHandler);

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Gimmick Backend running on http://0.0.0.0:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
