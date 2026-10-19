import {
  FlaskConical, Activity, Image as ImageIcon, FileImage, ExternalLink,
  HeartPulse, Layers, Scan, Zap, Smile, Heart, Brain
} from 'lucide-react';

export const DEPARTMENTS = [
  { name: 'LAB', icon: FlaskConical },
  { name: 'USG', icon: Activity },
  { name: 'DIGITAL XRAY', icon: ImageIcon },
  { name: 'XRAY', icon: FileImage },
  { name: 'OUTSOURCE LAB', icon: ExternalLink },
  { name: 'ECG', icon: HeartPulse },
  { name: 'CT SCAN', icon: Layers },
  { name: 'MRI', icon: Scan },
  { name: 'EPS', icon: Zap },
  { name: 'OPG', icon: Smile },
  { name: 'CARDIOLOGY', icon: Heart },
  { name: 'EEG', icon: Brain },
  { name: 'MAMMOGRAPHY', icon: Activity }
];

export const PATIENT_TITLES = ['Mr','Mrs','Smt','Kumari','Shri','Miss','Master','Mohd','Baby','Baby of','Wife of','Mother of','Son of','Daughter of','Ms','Miss-Mrs','Selvi','Sk','PROF','Dr','Child','Md','Mx','Mrs.'];
export const DEPT_TO_CASE_TYPE = {
  ALL: 'LabCase',
  'LAB': 'LabCase', 'USG': 'UsgCase', 'DIGITAL XRAY': 'DigitalXrayCase', 'XRAY': 'XrayCase',
  'OUTSOURCE LAB': 'OutsourceLabCase', 'ECG': 'EcgCase', 'CT SCAN': 'CtScanCase', 'MRI': 'MriCase',
  'EPS': 'EpsCase', 'OPG': 'OpgCase', 'CARDIOLOGY': 'CardiologyCase', 'EEG': 'EegCase', 'MAMMOGRAPHY': 'MammographyCase'
};

const hay = (t) => `${t?.name || ''} ${t?.code || ''} ${typeof t?.category === 'string' ? t.category : t?.category?.name || ''}`.toLowerCase();
const anyKw = (t, kws) => {
  const h = hay(t);
  return kws.some(keyword => {
    const value = keyword.trim();
    const end = value.length <= 4 ? '(?=$|[^a-z0-9])' : '';
    return new RegExp(`(?:^|[^a-z0-9])${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${end}`, 'i').test(h);
  });
};

export const filterTestsByDepartment = (tests = [], department) => {
  const dept = String(department || '').toUpperCase().trim();
  if (!dept || dept === 'ALL') return tests;
  if (dept === 'LAB') {
    return tests.filter(test => !DEPARTMENTS.some(department => department.name !== 'LAB'
      && filterTestsByDepartment([test], department.name).length > 0));
  }
  if (dept === 'USG') {
    return tests.filter(test => anyKw(test, ['usg', 'ultrasound', 'ultrasonogra', 'sonography']));
  }
  if (dept === 'DIGITAL XRAY' || dept === 'XRAY') {
    return tests.filter(test => anyKw(test, ['xray', 'x-ray', 'x ray', 'radiograph']));
  }
  const KW = {
    'CT SCAN': ['ct scan', 'computed tomography', 'computed', ' ct '],
    CT: ['ct scan', 'computed tomography', 'computed', ' ct '],
    MRI: ['mri', 'magnetic resonance', 'magnetic'],
    ECG: ['ecg', 'electrocardio', 'electrocardiogram'],
    'OUTSOURCE LAB': ['outsource', 'outsourced', 'referral-out', 'referral out', 'send-out', 'send out'],
    OUTSOURCE: ['outsource', 'outsourced', 'referral-out', 'referral out', 'send-out', 'send out'],
    EPS: ['eps', 'electrophoresis', 'protein electrophoresis'],
    OPG: ['opg', 'orthopantomogram', 'panoramic dental', 'dental x-ray'],
    CARDIOLOGY: ['cardio', 'echocardiography', 'echo', 'tmt', 'treadmill', 'holter', 'doppler cardiac'],
    EEG: ['eeg', 'electroencephalo', 'electroencephalogram'],
    MAMMOGRAPHY: ['mammo', 'mammography', 'breast']
  };
  if (KW[dept]) {
    return tests.filter((t) => anyKw(t, KW[dept]));
  }
  return [];
};
