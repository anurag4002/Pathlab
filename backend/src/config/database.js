const mongoose = require('mongoose');
const { MONGO_URI } = require('./environment');

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development and serverless execution on platforms like Vercel.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDatabase = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    };

    cached.promise = mongoose.connect(MONGO_URI, opts).then((mongooseInstance) => {
      console.log(`MongoDB Connected: ${mongooseInstance.connection.host} (DB: ${mongooseInstance.connection.name})`);
      return mongooseInstance;
    }).catch((error) => {
      cached.promise = null;
      console.error(`Database Connection Error: ${error.message}`);
      throw error;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
};

module.exports = connectDatabase;
