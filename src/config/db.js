import mongoose from 'mongoose';

let memoryServerInstance = null;

/**
 * Connect to MongoDB database instance using Mongoose.
 * Sanitizes connection strings to prevent credential leakage in logs.
 * In development, if MONGODB_URI is not yet configured, spins up an isolated
 * in-memory MongoDB instance so the local dev server remains fully operational.
 *
 * @returns {Promise<typeof mongoose>}
 */
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.trim() === '') {
    // If no MONGODB_URI is configured in non-production, fallback to in-memory MongoDB
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        '[MongoDB] MONGODB_URI not configured in .env. Initializing in-memory MongoDB instance for development...'
      );
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        memoryServerInstance = await MongoMemoryServer.create();
        const memUri = memoryServerInstance.getUri();
        const conn = await mongoose.connect(memUri);
        console.log(
          `[MongoDB] Connected successfully to in-memory development database: ${conn.connection.name}`
        );
        return conn;
      } catch (memErr) {
        console.error('[MongoDB] Failed to start in-memory development database:', memErr.message);
        throw new Error(`Database connection failed: ${memErr.message}`);
      }
    }

    throw new Error(
      'Database connection failed: MONGODB_URI environment variable is missing or empty. Please specify a valid MongoDB connection string in your .env configuration.'
    );
  }

  try {
    const conn = await mongoose.connect(uri);

    const safeHost = conn.connection.host || 'unknown-host';
    const dbName = conn.connection.name || 'default';
    console.log(`[MongoDB] Connected successfully to host: ${safeHost}, database: ${dbName}`);

    return conn;
  } catch (error) {
    // Sanitize error message to prevent leaking credentials in connection string
    const safeErrorMessage = error.message
      ? error.message.replace(/mongodb(?:\+srv)?:\/\/[^@]+@/i, 'mongodb://***:***@')
      : 'Unknown database connection error';

    console.error(`[MongoDB] Connection error: ${safeErrorMessage}`);
    throw new Error(`Database connection failed: ${safeErrorMessage}`);
  }
};

/**
 * Safely disconnects Mongoose connection and stops in-memory database if running.
 */
export const disconnectDB = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('[MongoDB] Disconnected successfully.');
    }
    if (memoryServerInstance) {
      await memoryServerInstance.stop();
      memoryServerInstance = null;
      console.log('[MongoDB] In-memory database stopped.');
    }
  } catch (error) {
    console.error('[MongoDB] Error during disconnection:', error.message);
  }
};

export default connectDB;
