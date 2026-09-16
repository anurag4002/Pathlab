const {
  SMS_PROVIDER, SMS_API_KEY, SMS_SENDER_ID,
  WHATSAPP_TOKEN, WHATSAPP_PHONE_ID,
  EMAIL_PROVIDER, EMAIL_API_KEY, EMAIL_FROM
} = require('../config/environment');
const NotificationTemplate = require('../models/NotificationTemplate');
const LabProfile = require('../models/LabProfile');
const { getBalance, spend } = require('./creditsService');

function fillVars(body, vars = {}) {
  return String(body || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}

async function getTemplate(key) {
  try {
    return await NotificationTemplate.findOne({ key, status: 'Active' });
  } catch (e) {
    return null;
  }
}

async function labToggles() {
  try {
    const p = await LabProfile.findOne();
    return { sms: p ? p.smsEnabled !== false : true, whatsapp: p ? p.whatsappEnabled !== false : true, email: p ? p.emailEnabled !== false : true };
  } catch (e) {
    return { sms: true, whatsapp: true, email: true };
  }
}

// ---- Providers (all plain fetch; console fallback for dev) ----

async function sendSmsViaProvider(to, text) {
  const provider = SMS_PROVIDER || 'console';
  if (provider === 'console') {
    console.log(`[sms:console] to=${to} text=${text}`);
    return { ok: true, provider, messageId: `console-${Date.now()}` };
  }
  if (provider === 'msg91') {
    const res = await fetch(
      `https://control.msg91.com/api/v5/flow/sms?authkey=${encodeURIComponent(SMS_API_KEY)}&sender=${encodeURIComponent(SMS_SENDER_ID)}&mobiles=${encodeURIComponent(to)}&message=${encodeURIComponent(text)}&route=4`,
      { method: 'GET' }
    );
    const ok = res.ok;
    return { ok, provider, messageId: ok ? `msg91-${Date.now()}` : null, error: ok ? null : `MSG91 HTTP ${res.status}` };
  }
  if (provider === 'twilio') {
    // TWILIO_* expected in env: TWILIO_SID / TWILIO_TOKEN / TWILIO_FROM
    const sid = process.env.TWILIO_SID || '';
    const token = process.env.TWILIO_TOKEN || '';
    const from = process.env.TWILIO_FROM || '';
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ To: to, From: from, Body: text }).toString()
    });
    const ok = res.ok;
    return { ok, provider, messageId: ok ? `twilio-${Date.now()}` : null, error: ok ? null : `Twilio HTTP ${res.status}` };
  }
  return { ok: false, provider, error: `Unknown SMS_PROVIDER=${provider}` };
}

async function sendWhatsappViaProvider(to, text) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.log(`[whatsapp:console] to=${to} text=${text}`);
    return { ok: true, provider: 'console', messageId: `console-${Date.now()}` };
  }
  const res = await fetch(`https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } })
  });
  const ok = res.ok;
  return { ok, provider: 'whatsapp-cloud', messageId: ok ? `wa-${Date.now()}` : null, error: ok ? null : `WhatsApp HTTP ${res.status}` };
}

async function sendEmailViaProvider(to, subject, text) {
  const provider = EMAIL_PROVIDER || 'console';
  if (provider === 'console' || !EMAIL_API_KEY) {
    console.log(`[email:console] to=${to} subject=${subject} text=${text}`);
    return { ok: true, provider: 'console', messageId: `console-${Date.now()}` };
  }
  if (provider === 'brevo') {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': EMAIL_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: { email: EMAIL_FROM }, to: [{ email: to }], subject, textContent: text })
    });
    const ok = res.ok;
    return { ok, provider, messageId: ok ? `brevo-${Date.now()}` : null, error: ok ? null : `Brevo HTTP ${res.status}` };
  }
  return { ok: false, provider, error: `Unknown EMAIL_PROVIDER=${provider}` };
}

// ---- Templated send with toggles + credit deduction ----

async function sendTemplated(channel, templateKey, to, vars = {}) {
  const toggles = await labToggles();
  if (channel !== 'email' && !toggles[channel]) return { ok: false, error: `${channel} disabled in Lab Profile` };
  if (channel === 'email' && !toggles.email) return { ok: false, error: 'email disabled in Lab Profile' };

  const tpl = await getTemplate(templateKey);
  const text = tpl ? fillVars(tpl.body, vars) : vars.fallbackText || '';
  const subject = tpl ? fillVars(tpl.subject || '', vars) : vars.subject || '';
  if (!text) return { ok: false, error: `Empty message and no template for key=${templateKey}` };

  // Credits for metered channels (skip when provider is console/dev).
  const metered = channel !== 'email' && (SMS_PROVIDER !== 'console' || (WHATSAPP_TOKEN && channel === 'whatsapp'));
  if (metered) {
    const bal = await getBalance();
    if (bal <= 0) return { ok: false, error: 'Insufficient message credits' };
  }

  let result;
  if (channel === 'sms') result = await sendSmsViaProvider(to, text);
  else if (channel === 'whatsapp') result = await sendWhatsappViaProvider(to, text);
  else result = await sendEmailViaProvider(to, subject, text);

  if (result.ok && metered) {
    try { await spend(1, `${channel}:${templateKey} to ${to}`); } catch (e) { /* ledger best-effort */ }
  }
  return result;
}

module.exports = { fillVars, sendSmsViaProvider, sendWhatsappViaProvider, sendEmailViaProvider, sendTemplated };
