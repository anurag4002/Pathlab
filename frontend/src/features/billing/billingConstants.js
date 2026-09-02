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

export const PATIENT_TITLES = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Baby'];

export const filterTestsByDepartment = (tests = [], department) => {
  if (department === 'LAB') {
    return tests.filter(
      (t) =>
        !t.name.toLowerCase().includes('usg') &&
        !t.name.toLowerCase().includes('xray') &&
        !t.name.toLowerCase().includes('x-ray') &&
        !t.category?.name?.toLowerCase().includes('usg') &&
        !t.category?.name?.toLowerCase().includes('xray')
    );
  }
  if (department === 'USG') {
    return tests.filter(
      (t) =>
        t.name.toLowerCase().includes('usg') ||
        t.name.toLowerCase().includes('ultrasound') ||
        t.category?.name?.toLowerCase().includes('usg')
    );
  }
  if (department === 'DIGITAL XRAY' || department === 'XRAY') {
    return tests.filter(
      (t) =>
        t.name.toLowerCase().includes('xray') ||
        t.name.toLowerCase().includes('x-ray') ||
        t.name.toLowerCase().includes('radiograph') ||
        t.category?.name?.toLowerCase().includes('xray')
    );
  }
  return [];
};
