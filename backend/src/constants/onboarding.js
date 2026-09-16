// Labsmart 11-step Getting Started checklist.
const ONBOARDING_STEPS = [
  { key: 'verify-email', title: 'Verify email address', description: 'Confirm the lab owner email for alerts and recovery.', link: '' },
  { key: 'centre-profile', title: 'Complete centre profile', description: 'Lab name, phone, address and logo.', link: '' },
  { key: 'letterhead', title: 'Upload letterhead', description: 'Letterhead image + top margin for PDFs.', link: '' },
  { key: 'rates', title: 'Configure test rates', description: 'Review Test Database prices.', link: '' },
  { key: 'normals', title: 'Set reference ranges', description: 'Normals + critical limits per test for auto-flags.', link: '' },
  { key: 'users', title: 'Create staff logins', description: 'Employee accounts with permissions.', link: '' },
  { key: 'browser-code', title: 'Register browsers', description: 'Approve browser codes for staff login.', link: '' },
  { key: 'sms-setup', title: 'Configure SMS/WhatsApp', description: 'Sender IDs, toggles and credits.', link: '' },
  { key: 'signature', title: 'Upload signatures', description: 'Doctor/authority e-signatures for reports.', link: '' },
  { key: 'first-bill', title: 'Create first bill', description: 'Register a patient and generate a bill.', link: '' },
  { key: 'first-report', title: 'Publish first report', description: 'Enter results, sign and share the PDF.', link: '' }
];

module.exports = { ONBOARDING_STEPS };
