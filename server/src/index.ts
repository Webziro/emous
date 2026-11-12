import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { connectDatabase } from './db';
import { identityRouter } from './routes/identity';
import { postsRouter } from './routes/posts';
import { inboxRouter } from './routes/inbox';
import { backgroundsRouter } from './routes/backgrounds';
import { BRAND } from '../../shared';

dotenv.config();

export function createApp() {
  const app = express();
  const publicDir = path.join(__dirname, '..', 'public');

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Unified API v1 Routes
  app.get('/api/v1/health', (_req, res) => {
    res.json({
      status: 'ok',
      brand: BRAND.name,
      domain: BRAND.domain,
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
  const webPort = Number(process.env.WEB_PORT) || 3000;
  const app = createApp();

  connectDatabase()
    .then(({ mode }) => {
      app.listen(port, () => {
        console.log(
          `🚀 emous Unified API + Web Server running at http://localhost:${port} (DB mode: ${mode})`
        );
      });

      if (webPort !== port) {
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
