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

import { authRouter } from './routes/auth.js';
import { apiRouter } from './routes/api.js';
import { db } from './lib/db.js';
import { db as pgDb } from './lib/db-pg-adapter.js';
import { csrfMiddleware } from './lib/auth.js';
import { runSqliteMigrations } from './lib/run-sqlite-migrations.js';
import { runPgMigrations } from './db/run-pg-migrations.js';
import { upsertSuperAdminCredentials } from './lib/super-admin-sync.js';

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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://apis.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.googleusercontent.com"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://oauth2.googleapis.com"],
      frameSrc: ["https://accounts.google.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for Google OAuth embeds
  hsts: isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
}));
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '500kb' })); // Prevent large payload DoS
app.use(cookieParser());

// Health check (no auth, no rate limit)
app.get('/api/health', async (req, res) => {
  try {
    if (process.env.DATABASE_URL) {
      await pgDb.prepare('SELECT 1').get();
      res.json({ ok: true, db: 'postgres' });
    } else {
      db.prepare('SELECT 1').get();
      res.json({ ok: true, db: 'sqlite' });
    }
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

async function runStartupMigrations() {
  if (process.env.DATABASE_URL) {
    try {
      await runPgMigrations();
      console.log('[startup] PostgreSQL migrations complete.');
    } catch (err) {
      console.error('[pg-migrate] Failed:', err.message);
    }
  } else {
    try {
      runSqliteMigrations(db);
    } catch (err) {
      console.error('[sqlite-migrate] Failed:', err.message);
    }
  }
}

/**
 * Apply super admin email/password from env into the DB on boot (same DB layer as /api/auth/login).
 * - SUPER_ADMIN_PASSWORD must be at least 8 chars.
 * - In production, SUPER_ADMIN_EMAIL is required whenever this runs (AUTO_SEED or explicit email path).
 * - With AUTO_SEED_SUPER_ADMIN only (no email), dev uses legacy test email; production skips and logs an error.
 */
async function maybeSyncSuperAdminFromEnv() {
  const rawPass = process.env.SUPER_ADMIN_PASSWORD;
  const p = typeof rawPass === 'string' ? rawPass.trim() : rawPass;
  if (!p || p.length < 8) {
    if (process.env.AUTO_SEED_SUPER_ADMIN === 'true') {
      console.warn('[startup] AUTO_SEED_SUPER_ADMIN is set but SUPER_ADMIN_PASSWORD is missing or shorter than 8 chars; skipping super admin sync.');
    }
    return;
  }
  const email = process.env.SUPER_ADMIN_EMAIL?.trim();
  const fromLegacyFlag = process.env.AUTO_SEED_SUPER_ADMIN === 'true';
  const fromExplicitEmail = !!email;
  if (!fromLegacyFlag && !fromExplicitEmail) return;

  if (fromLegacyFlag && !email && isProd) {
    console.error(
      '[startup] Set SUPER_ADMIN_EMAIL in Railway/production. AUTO_SEED_SUPER_ADMIN without it would only update the dev default address; skipping super admin sync.',
    );
    return;
  }

  const targetEmail = email || 'mccarthy.amyg@gmail.com';
  try {
    await upsertSuperAdminCredentials(targetEmail, p);
    console.log(`[startup] Super admin credentials synced for ${targetEmail.toLowerCase()}`);
  } catch (err) {
    console.error('[startup] Super admin sync failed:', err.message);
  }
}

async function bootstrap() {
  mkdirSync(join(__dirname, 'data'), { recursive: true });
  mkdirSync(join(__dirname, 'data', 'uploads'), { recursive: true });
  await runStartupMigrations();
  await maybeSyncSuperAdminFromEnv();
}

bootstrap()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Noble HR server running on http://0.0.0.0:${PORT}`);
      console.log(`Database: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'}`);
    });
  })
  .catch((err) => {
    console.error('Bootstrap failed:', err);
    process.exit(1);
  });
