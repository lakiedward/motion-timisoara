import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Health check endpoint for Railway
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Runtime environment injection for browser (SSR/production)
 * Serves a small JS file that sets window-scoped variables from process.env
 * This lets us avoid baking secrets into the build and keep Railway deployments working.
 */
app.get('/env.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  // Prevent caching so changes in Railway env vars propagate immediately
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const stripePk = process.env['STRIPE_PUBLISHABLE_KEY'] || process.env['NG_APP_STRIPE_KEY'] || '';

  const payload = [
    '// Runtime-injected environment',
    stripePk ? `window.STRIPE_PUBLISHABLE_KEY = ${JSON.stringify(stripePk)};` : '',
  ]
    .filter(Boolean)
    .join('\n');

  res.send(payload);
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  // Only log requests in development or if DEBUG env var is set
  const isDebug = process.env['DEBUG'] === 'true' || process.env['NODE_ENV'] === 'development';
  if (isDebug) {
    console.log(`Request: ${req.method} ${req.url}`);
  }
  
  angularApp
    .handle(req)
    .then((response) => {
      if (response) {
        writeResponseToNodeResponse(response, res);
      } else {
        if (isDebug) {
          console.log(`No response for: ${req.url}`);
        }
        next();
      }
    })
    .catch((error) => {
      console.error(`Error handling request ${req.url}:`, error);
      next(error);
    });
});

/**
 * Error handler
 */
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = Number(process.env['PORT']) || 4201;
  const host = '0.0.0.0'; // Listen on all interfaces for Docker/Railway
  
  console.log(`Starting server...`);
  console.log(`Browser dist folder: ${browserDistFolder}`);
  console.log(`Environment: ${process.env['NODE_ENV'] || 'development'}`);
  
  app.listen(port, host, () => {
    console.log(`✅ Node Express server listening on http://${host}:${port}`);
    console.log(`Health check available at: http://${host}:${port}/health`);
  });
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
