const mongoose = require('mongoose');
const { MONGO_URI } = require('./environment');

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDatabase = async () => {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    // Keep the number of open database connections small. On Vercel every
    // running copy of the server has its own pool, and frozen copies keep
    // their connections open; with the driver's default of 100 per pool a
    // few copies used up the Atlas limit (~500 on M0) and Atlas then
    // refused every new connection ("SSL alert number 80").
    const serverless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const maxPoolSize = Math.max(1, Number(process.env.MONGO_MAX_POOL) || (serverless ? 5 : 20));
    const opts = {
      serverSelectionTimeoutMS: 15000,
      maxPoolSize,
      minPoolSize: 0,
      // Close connections that sit unused, so idle / frozen copies give them back.
      maxIdleTimeMS: serverless ? 10000 : 60000,
      // Do not open a burst of new connections at once.
      maxConnecting: 2,
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
