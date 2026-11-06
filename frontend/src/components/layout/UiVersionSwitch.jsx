import React from 'react';
import { Sparkles } from 'lucide-react';
import { setUiVersion, useUiVersion } from '../../utils/uiVersion';

// Always-visible Classic / New look switch in the top bar.
export default function UiVersionSwitch() {
  const isV2 = useUiVersion() === 'v2';
  return (
    <button type="button" role="switch" aria-checked={isV2} className={`header-ui-switch${isV2 ? ' is-on' : ''}`}
      onClick={() => setUiVersion(isV2 ? 'classic' : 'v2')} title={isV2 ? 'Switch back to the classic look' : 'Try the new look'}>
      <Sparkles size={14} aria-hidden="true" />
      <span className="header-ui-switch-label">New look</span>
      <span className={`ui-switch${isV2 ? ' is-on' : ''}`} aria-hidden="true"><span /></span>
    </button>
  );
}
