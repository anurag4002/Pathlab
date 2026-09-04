const express = require('express');
const cors = require('cors');
const path = require('path');
const { CLIENT_URL, UPLOAD_DIR } = require('./config/environment');
const connectDatabase = require('./config/database');
const errorHandler = require('./middleware/errorMiddleware');

const app = express();

// Middlewares
const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:5173'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins in production or check whitelist
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'production') {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure Database is connected before API handlers execute
app.use(async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (err) {
    console.error('Failed to connect to database in middleware:', err);
    res.status(500).json({
      success: false,
      message: 'Database connection failed. Please check MongoDB configuration.'
    });
  }
});

// Static uploads serving
const uploadBase = process.env.VERCEL
  ? '/tmp/uploads'
  : path.resolve(__dirname, '../', UPLOAD_DIR);
app.use('/uploads', express.static(uploadBase));

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

// API Routes Mount
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/usg', usgRoutes);
app.use('/api/xray', xrayRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/patient', patientPortalRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'Pure Path Lab Backend' });
});

// Central Error Handler
app.use(errorHandler);

module.exports = app;
