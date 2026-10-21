import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';

import errorMiddleware from './middleware/error.middleware.js';
import notFoundMiddleware from './middleware/not-found.middleware.js';
import { assertAssistantConfiguration } from './middleware/assistant-auth.middleware.js';
import aiRoutes from './routes/ai.routes.js';
import taskAssistantRoutes from './routes/task-assistant.routes.js';
import taskRoutes from './routes/task.routes.js';

assertAssistantConfiguration();

const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(
  cors({
    origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map((origin) => origin.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Request body parsers with payload size safeguards
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// HTTP request logging (suppressed during automated tests)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

/**
 * Health check endpoint
 * Clearly distinguishes API process status from database connection health.
 */
app.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const isDbHealthy = dbState === 1;

  res.status(200).json({
    success: true,
    message: 'Task Manager REST API is running',
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbStatusMap[dbState] || 'unknown',
        readyState: dbState,
        healthy: isDbHealthy,
      },
    },
  });
});

// Mount domain routes
app.use('/api/tasks', taskRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai/assistant', taskAssistantRoutes);

// Catch 404 for unknown routes
app.use(notFoundMiddleware);

// Centralized error handling
app.use(errorMiddleware);

export default app;
