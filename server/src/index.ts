import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { connectDatabase, isUsingMongo } from './db';
import { identityRouter } from './routes/identity';
import { postsRouter } from './routes/posts';
import { inboxRouter } from './routes/inbox';
import { backgroundsRouter } from './routes/backgrounds';
import { securityMiddleware } from './safety';
import { BRAND } from '../../shared';

dotenv.config();

function resolvePublicDir(): string {
  const candidates = [
    path.join(process.cwd(), 'public'),
    path.join(process.cwd(), 'server', 'public'),
    path.join(__dirname, '..', 'public'),
    path.join(__dirname, '..', '..', '..', 'public'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(process.cwd(), 'public');
}

export function createApp() {
  const app = express();
  const publicDir = resolvePublicDir();

  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'x-device-id', 'Authorization'],
    })
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(securityMiddleware);

  // Unified API v1 Routes
  app.get('/api/v1/health', (_req, res) => {
    res.json({
      status: 'ok',
      brand: BRAND.name,
      domain: BRAND.domain,
      dbMode: isUsingMongo() ? 'mongodb-atlas' : 'local-ephemeral',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/v1/identity', identityRouter);
  app.use('/api/v1/posts', postsRouter);
  app.use('/api/v1/inbox', inboxRouter);
  app.use('/api/v1/backgrounds', backgroundsRouter);

  // Serve Instant Web UI (/, /ask/:handle) directly from the unified server
  app.use(express.static(publicDir));

  app.get('/ask/:handle', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 4000;
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
  const webPort = Number(process.env.WEB_PORT) || 3000;
  const app = createApp();

  connectDatabase()
    .then(({ mode }) => {
      app.listen(port, '0.0.0.0', () => {
        console.log(
          `🚀 emous Unified API + Web Server running on port ${port} (DB mode: ${mode})`
        );
      });

      if (!isProd && webPort !== port) {
        app
          .listen(webPort, () => {
            console.log(
              `🌐 emous Web App also listening at http://localhost:${webPort} and http://localhost:${webPort}/ask/GoldenWizard`
            );
          })
          .on('error', () => {
            // Ignore if port 3000 is already bound by Next.js
          });
      }
    })
    .catch((err) => {
      console.error('❌ Failed to start emous server:', err);
      process.exit(1);
    });
}
