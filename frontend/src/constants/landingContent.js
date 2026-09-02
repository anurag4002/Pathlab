/**
 * Pure Path Lab Public Website Content Configuration
 * Centralized constants for laboratory profile, services, quality protocols, and operating details.
 */

export const LAB_PROFILE = {
  name: 'PURE PATH LAB',
  tagline: 'Diagnostic & Pathology Laboratory',
  subtitle: 'Reliable laboratory testing with a simple and secure way to access your reports.',
  phone: '+91 98765 43210',
  email: 'helpdesk@purepathlab.com',
  address: 'Sector 12, Main Healthcare Road, New Delhi, 110075',
  operatingHours: {
    weekdays: '7:00 AM – 9:00 PM',
    sunday: '7:00 AM – 2:00 PM',
    sampleCollection: 'Routine & Fasting collections available from 7:00 AM daily'
  }
};

export const LAB_SERVICES = [
  {
    id: 'pathology',
    title: 'Clinical Pathology',
    shortDesc: 'Complete blood counts (CBC), ESR, differential leukocyte analysis, blood grouping, and routine hematology.',
    features: ['Automated 5-Part Cell Counter', 'Barcoded Sample Collection Tubes']
  },
  {
    id: 'biochemistry',
    title: 'Biochemistry & Hormones',
    shortDesc: 'Renal & liver function profiles, blood glucose panels, lipid screening, and thyroid (TSH/T3/T4) hormone assays.',
    features: ['Fully Automated Chemistry Analyzers', 'Standardized Reference Calibrations']
  },
  {
    id: 'usg',
    title: 'Ultrasound (USG)',
    shortDesc: 'Abdominal, pelvic, obstetric, Doppler, and small part ultrasonography conducted by experienced radiologists.',
    features: ['High-Definition Imaging Probes', 'Fast Diagnostic Impression Reports']
  },
  {
    id: 'xray',
    title: 'Digital Radiography (X-Ray)',
    shortDesc: 'Low-dose digital X-ray imaging for chest, musculoskeletal, spine, and joints with instant radiograph capture.',
    features: ['Minimal Radiation Exposure', 'Instant Digital Archival']
  },
  {
    id: 'packages',
    title: 'Preventive Health Profiles',
    shortDesc: 'Comprehensive health checkup packages evaluating vital metabolic, cardiac, kidney, and hematological health.',
    features: ['Standardized Panel Testing', 'Detailed Consolidated Results']
  }
];

export const QUALITY_STANDARDS = [
  {
    title: 'Automated Sample Tracking',
    description: 'Every test sample tube is assigned a unique barcode to eliminate manual handling errors.'
  },
  {
    title: 'Pathologist & Radiologist Verification',
    description: 'All diagnostic findings are verified and approved by qualified MD pathologists and radiologists.'
  },
  {
    title: 'Fast Digital Delivery',
    description: 'Secure, OTP-authenticated digital report access as soon as tests are verified in the laboratory.'
  },
  {
    title: 'Organized Health Records',
    description: 'Secure electronic archive of all your historical pathology and radiology reports.'
  }
];
