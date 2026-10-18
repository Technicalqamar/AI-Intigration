import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';

// If PORT is 8080 (reserved by Cloud Run internal container runtime), default to 3000 for dev server
const rawPort = process.env.PORT;
const primaryPort = rawPort && rawPort !== '8080' ? parseInt(rawPort, 10) : 3000;

let server;
let devProxyServer;

/**
 * Initializes database connection and starts HTTP listeners.
 */
const startServer = async () => {
  try {
    console.log('[Server] Connecting to MongoDB...');
    await connectDB();

    server = app.listen(primaryPort, '0.0.0.0', () => {
      console.log(
        `[Server] Task Manager REST API listening on port ${primaryPort} (0.0.0.0, PID: ${process.pid})`
      );
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && primaryPort !== 3000) {
        console.warn(`[Server] Port ${primaryPort} in use. Falling back to port 3000...`);
        server = app.listen(3000, '0.0.0.0', () => {
          console.log('[Server] Task Manager REST API listening on port 3000 (0.0.0.0)');
        });
      } else {
        console.error('[Server] Server error:', err.message);
      }
    });

    // In dev environments where preview iframe specifically proxies port 3000, attach listener if primaryPort != 3000
    if (primaryPort !== 3000) {
      try {
        devProxyServer = app.listen(3000, '0.0.0.0', () => {
          console.log('[Server] Also listening on port 3000 for development preview');
        });
        devProxyServer.on('error', (err) => {
          if (err.code !== 'EADDRINUSE') {
            console.log('[Server] Port 3000 listener note:', err.message);
          }
        });
      } catch (err) {
        console.log('[Server] Port 3000 secondary listener note:', err.message);
      }
    }
  } catch (error) {
    console.error(`[Server] Failed to initialize server: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Gracefully shuts down HTTP listener and database connection.
 * @param {string} signal - Signal name (e.g. SIGINT, SIGTERM)
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(() => {
      console.log('[Server] Primary HTTP server closed.');
    });
  }

  if (devProxyServer) {
    devProxyServer.close(() => {
      console.log('[Server] Preview HTTP server closed.');
    });
  }

  try {
    await disconnectDB();
    console.log('[Server] Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error(`[Server] Error during shutdown: ${error.message}`);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer();
