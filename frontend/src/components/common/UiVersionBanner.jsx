import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { setUiVersion, useUiVersion } from '../../utils/uiVersion';

const DISMISS_KEY = 'ppl_ui_banner_dismissed';

// Dashboard prompt for the Classic / New look switch (also in the user menu).
export default function UiVersionBanner() {
  const version = useUiVersion();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(`${DISMISS_KEY}:${version}`) === '1'; } catch { return false; }
  });
  if (dismissed) return null;
  const dismiss = () => {
    try { localStorage.setItem(`${DISMISS_KEY}:${version}`, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };
  if (version === 'v2') {
    return (
      <div className="ui-banner ui-banner--quiet" role="note">
        <Sparkles size={15} aria-hidden="true" />
        <span>You are using the new look.</span>
        <button type="button" className="ui-banner-link" onClick={() => setUiVersion('classic')}>Switch back to classic</button>
        <button type="button" className="ui-banner-close" aria-label="Hide this message" onClick={dismiss}><X size={14} /></button>
      </div>
    );
  }
  return (
    <div className="ui-banner" role="note">
      <Sparkles size={18} aria-hidden="true" />
      <div className="ui-banner-text">
        <strong>Try the new look</strong>
        <span>Calmer screens, one button per row, quicker filters. You can switch back any time from your name at the top right.</span>
      </div>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => setUiVersion('v2')}>Turn on new look</button>
      <button type="button" className="ui-banner-close" aria-label="Hide this message" onClick={dismiss}><X size={16} /></button>
    </div>
  );
}
