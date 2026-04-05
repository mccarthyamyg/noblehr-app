/**
 * Noble HR Governance Platform - Backend Server
 * Node.js + Express + SQLite
 */
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';

import { authRouter } from './routes/auth.js';
import { apiRouter } from './routes/api.js';
import { db } from './lib/db.js';
import { csrfMiddleware } from './lib/auth.js';
import { runSqliteMigrations } from './lib/run-sqlite-migrations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const CORS_ORIGINS = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean) : null;
const corsOrigin = isProd
  ? (CORS_ORIGINS && CORS_ORIGINS.length ? CORS_ORIGINS : [FRONTEND_URL])
  : true;

const app = express();
app.set('trust proxy', 1); // For correct protocol/host behind reverse proxy

// Request ID for tracing
app.use((req, res, next) => {
  req.id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Phase 6: structured request log in production
if (isProd) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (req.path.startsWith('/api')) {
        console.log(JSON.stringify({
          ts: new Date().toISOString(),
          requestId: req.id,
          method: req.method,
          path: req.originalUrl?.split('?')[0] || req.path,
          status: res.statusCode,
          ms: Date.now() - start,
        }));
      }
    });
    next();
  });
}
app.use(helmet({ contentSecurityPolicy: false })); // CSP can break SPA; enable with care
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '500kb' })); // Prevent large payload DoS
app.use(cookieParser());

// Health check (no auth, no rate limit)
app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ ok: true, db: 'connected' });
  } catch (e) {
    res.status(503).json({ ok: false, db: 'error', error: isProd ? 'Service unavailable' : e.message });
  }
});

// Rate limiting: stricter for sensitive auth endpoints, 100 req/min general
const authStrictLimit = rateLimit({ windowMs: 60 * 1000, max: 5, message: { error: 'Too many attempts' } });
const authModerateLimit = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Too many attempts' } });
const heavyProcessingLimit = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Too many high-compute requests. Please wait a minute.' } });

app.use('/api/auth/login', authStrictLimit);
app.use('/api/auth/register', authModerateLimit);
app.use('/api/auth/forgot-password', authModerateLimit);
app.use('/api/auth/approve-org', authModerateLimit);
app.use('/api/auth/invites/accept', authModerateLimit);
app.use('/api/auth/reset-password', authModerateLimit);
app.use('/api/auth/verify-email', authModerateLimit);
app.use('/api/auth/resend-verification', authModerateLimit);
app.use('/api/auth/request-approval-again', authModerateLimit);

// Apply heavy limits strategically to computationally expensive routers BEFORE blanket `/api` limit
app.use('/api/ai', heavyProcessingLimit);
app.use('/api/publish-policy', heavyProcessingLimit);
app.use('/api/manage-policy-lifecycle', heavyProcessingLimit);

app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 100, message: { error: 'Too many requests' } }));

app.use('/api/auth', authRouter);
// CSRF for state-changing API requests (after auth; GET/HEAD/OPTIONS skipped inside middleware)
app.use('/api', csrfMiddleware);
app.use('/api', apiRouter);

// Global error handler (catches unhandled errors in route handlers)
app.use((err, req, res, next) => {
  console.error(`[${req.id}] Error:`, err.message);
  res.status(500).json({ error: isProd ? 'Internal server error' : err.message });
});

// Serve static frontend in production (optional - run client separately in dev)
const clientDist = join(__dirname, '..', 'Handbook Policy App', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(clientDist, 'index.html'));
  });
}

// Ensure data dir and uploads dir exist (TRUTH #56 - employee documents)
mkdirSync(join(__dirname, 'data'), { recursive: true });
mkdirSync(join(__dirname, 'data', 'uploads'), { recursive: true });

function runStartupMigrations() {
  try {
    runSqliteMigrations(db);
  } catch (err) {
    console.error('[migrations] Failed:', err.message);
  }
}

/** Phase 1: only when AUTO_SEED_SUPER_ADMIN=true and SUPER_ADMIN_PASSWORD is set (never hardcode in source). */
function maybeAutoSeedSuperAdmin() {
  if (process.env.AUTO_SEED_SUPER_ADMIN !== 'true') return;
  const p = process.env.SUPER_ADMIN_PASSWORD;
  if (!p || p.length < 8) {
    console.warn('[AUTO-BOOT] AUTO_SEED_SUPER_ADMIN is set but SUPER_ADMIN_PASSWORD is missing or shorter than 8 chars; skipping seed.');
    return;
  }
  const r = spawnSync(process.execPath, ['scripts/seed-super-admin.js'], {
    cwd: __dirname,
    env: { ...process.env, SUPER_ADMIN_PASSWORD: p },
    stdio: 'inherit',
  });
  if (r.status !== 0) console.error('[AUTO-BOOT] Super admin seed exited with code', r.status);
  else console.log('[AUTO-BOOT] Super admin seed completed.');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Noble HR server running on http://0.0.0.0:${PORT}`);
  console.log('Run "node scripts/init-db.js" first if database does not exist.');
  runStartupMigrations();
  maybeAutoSeedSuperAdmin();
});
