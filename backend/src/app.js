const express = require('express');
const cors = require('cors');
const path = require('path');
const { CORS_ORIGIN, CORS_CREDENTIALS, UPLOAD_DIR } = require('./config/environment');
const { buildCorsOptions } = require('./config/cors');
const securityHeaders = require('./middleware/securityHeaders');
const { generalLimiter } = require('./middleware/rateLimitMiddleware');
const connectDatabase = require('./config/database');
const errorHandler = require('./middleware/errorMiddleware');

const app = express();
app.disable('x-powered-by');
app.use(securityHeaders);

// CORS is allowlist-driven via env (CORS_ORIGIN / CORS_CREDENTIALS).
// Never use origin:true in production — it reflects any origin with credentials.
app.use(cors(buildCorsOptions({ CORS_ORIGIN, CORS_CREDENTIALS })));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Tier-1 flood protection on every /api route (health checks skipped inside).
app.use('/api', generalLimiter);

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
const publicRoutes = require('./routes/publicRoutes');
const setupRoutes = require('./routes/setupRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const notifyRoutes = require('./routes/notifyRoutes');
const supportRoutes = require('./routes/supportRoutes');
const modalityRoutes = require('./routes/modalityRoutes');
const doctorPortalRoutes = require('./routes/doctorPortalRoutes');
const exportRoutes = require('./routes/exportRoutes');
const jobRoutes = require('./routes/jobRoutes');
const analysisRoutes = require('./routes/analysisRoutes');

// All API routers are mounted ONLY under /api.
// Do NOT add a bare mount (registerAllRoutes('')): it doubles the attack
// surface and breaks prefix-dependent logic such as the upload-folder
// resolution in uploadMiddleware (which checks for '/api/usg', '/api/xray').
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
// Public QR self-service (no auth inside) + parity domains.
app.use('/api/public', publicRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/notify', notifyRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/modality', modalityRoutes);
app.use('/api/doctor', doctorPortalRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/analysis', analysisRoutes);

// Health check endpoint
app.get(['/api/health', '/health', '/'], (req, res) => {
  res.status(200).json({ status: 'ok', service: 'Pure Path Lab Backend', timestamp: new Date().toISOString() });
});

// Central Error Handler
app.use(errorHandler);

module.exports = app;
