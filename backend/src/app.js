const express = require('express');
const cors = require('cors');
const path = require('path');
const { CLIENT_URL, UPLOAD_DIR } = require('./config/environment');
const connectDatabase = require('./config/database');
const errorHandler = require('./middleware/errorMiddleware');

const app = express();

// Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure Database is connected before API handlers execute
app.use(async (req, res, next) => {
  try {
    await connectDatabase();
  } catch (err) {
    console.error('Database connection warning in middleware:', err.message);
  }
  next();
});

// Static uploads serving
const uploadBase = process.env.VERCEL
  ? '/tmp/uploads'
  : path.resolve(__dirname, '../', UPLOAD_DIR);
app.use('/uploads', express.static(uploadBase));
app.use('/api/uploads', express.static(uploadBase));

// API Routes Import
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const agentRoutes = require('./routes/agentRoutes');
const billRoutes = require('./routes/billRoutes');
const testRoutes = require('./routes/testRoutes');
const reportRoutes = require('./routes/reportRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const usgRoutes = require('./routes/usgRoutes');
const xrayRoutes = require('./routes/xrayRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const patientPortalRoutes = require('./routes/patientPortalRoutes');

// Helper to register routes on both /api/path and /path
const registerAllRoutes = (prefix) => {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/users`, userRoutes);
  app.use(`${prefix}/patients`, patientRoutes);
  app.use(`${prefix}/doctors`, doctorRoutes);
  app.use(`${prefix}/agents`, agentRoutes);
  app.use(`${prefix}/bills`, billRoutes);
  app.use(`${prefix}/tests`, testRoutes);
  app.use(`${prefix}/reports`, reportRoutes);
  app.use(`${prefix}/expenses`, expenseRoutes);
  app.use(`${prefix}/transactions`, transactionRoutes);
  app.use(`${prefix}/usg`, usgRoutes);
  app.use(`${prefix}/xray`, xrayRoutes);
  app.use(`${prefix}/dashboard`, dashboardRoutes);
  app.use(`${prefix}/patient`, patientPortalRoutes);
};

// Mount routes for both standard prefix and rewritten prefix
registerAllRoutes('/api');
registerAllRoutes('');

// Health check endpoint
app.get(['/api/health', '/health', '/'], (req, res) => {
  res.status(200).json({ status: 'ok', service: 'Pure Path Lab Backend', timestamp: new Date().toISOString() });
});

// Central Error Handler
app.use(errorHandler);

module.exports = app;
