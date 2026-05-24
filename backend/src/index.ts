import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { authRouter } from './routes/auth.js';
import { sparksRouter } from './routes/sparks.js';
import { tilesRouter } from './routes/tiles.js';
import { uploadRouter } from './routes/upload.js';
import { chatRouter } from './routes/chat.js';
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
import { tileFlowRouter, flowRouter, flowsHubRouter } from './routes/flow.js';
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
app.use('/api/sparks', sparksRouter);
app.use('/api/tiles', tilesRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/chat', chatRouter);
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
// Mount the tile-scoped flow router BEFORE /api/tiles is also used to avoid
// any accidental shadowing; both can coexist because tilesRouter has no
// `/:id/flow` sub-route. mergeParams gives us req.params.tileId.
app.use('/api/tiles/:tileId/flow', tileFlowRouter);
app.use('/api/flow', flowRouter);
app.use('/api/flows', flowsHubRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Gimmick Backend running on http://0.0.0.0:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
