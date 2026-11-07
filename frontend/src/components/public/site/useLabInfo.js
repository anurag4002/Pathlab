import { useEffect, useState } from 'react';
import { getLabInfo } from '../../../services/publicService';
import { LAB_PROFILE } from '../../../constants/landingContent';

// The lab's public details: what is set in Lab profile (the same as on the
// reports), falling back to the website defaults until it loads.
let cached = null;
const FALLBACK = { labName: 'Pure Path Lab', tagline: 'Pathology & diagnostics', address: LAB_PROFILE.address, phone: LAB_PROFILE.phone, email: LAB_PROFILE.email, logoUrl: '' };

const tidyName = (name) => {
  const n = String(name || '').trim();
  if (!n) return FALLBACK.labName;
  return n === n.toUpperCase() ? n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : n;
};

export default function useLabInfo() {
  const [info, setInfo] = useState(cached || FALLBACK);
  useEffect(() => {
    if (cached) return undefined;
    let alive = true;
    getLabInfo().then((res) => {
      const d = res?.data || {};
      cached = {
        ...FALLBACK,
        ...Object.fromEntries(Object.entries(d).filter(([, v]) => v)),
        labName: tidyName(d.labName),
        // The registration number sits at the start of the address for reports; not needed on the website.
        address: String(d.address || FALLBACK.address).replace(/^\s*Reg\.?\s*No\.?\s*[:-]?\s*\S+\s*/i, '').trim() || FALLBACK.address,
      };
      if (alive) setInfo(cached);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const digits = String(info.phone || '').replace(/\D/g, '').slice(-10);
  return {
    ...info,
    phoneDigits: digits,
    phoneDisplay: digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : info.phone,
    telLink: digits ? `tel:+91${digits}` : 'tel:',
    whatsappLink: digits ? `https://wa.me/91${digits}` : '',
    mapsLink: info.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${info.labName} ${info.address}`)}` : '',
  };
}

/** "Open now · until 9:00 PM" / "Closed · opens 7:00 AM" from the lab's hours. */
export function openStatus(hours, now = new Date()) {
  const fmt = (h) => new Date(2000, 0, 1, h).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const today = hours?.[now.getDay()];
  const h = now.getHours() + now.getMinutes() / 60;
  if (today && h >= today[0] && h < today[1]) return { open: true, text: `Open now · until ${fmt(today[1])}` };
  if (today && h < today[0]) return { open: false, text: `Closed · opens ${fmt(today[0])}` };
  const next = hours?.[(now.getDay() + 1) % 7];
  return { open: false, text: next ? `Closed · opens ${fmt(next[0])} tomorrow` : 'Closed now' };
}
