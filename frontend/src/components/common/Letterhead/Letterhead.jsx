import React, { useState } from 'react';
import assetSrc from '../../../utils/assetSrc';
import './Letterhead.css';

/* Dynamic lab letterhead for the report screens (screen + print + paper).
   Every value is supplied by the existing lab profile API
   (GET /setup/lab-profile) — nothing is hardcoded here. Fields the API
   leaves empty are simply not rendered, and a missing/broken logo or
   letterhead image falls back to the typed lab block, mirroring the
   backend PDF header's own fallback behavior.

   part="header" -> top of the printable report (uploaded letterhead image
   when the profile provides one, else logo + lab name + tagline + contact).
   part="footer" -> bottom of the printable report (existing contact fields). */

// Asset path resolution lives in utils/assetSrc (relative API paths are
// served from the site root; absolute URLs pass through; no hardcoded host).

const Letterhead = ({ profile, loading = false, part = 'header' }) => {
  const letterheadSrc = assetSrc(profile?.letterheadUrl);
  const logoSrc = assetSrc(profile?.logoUrl);
  // Track each failed src (not a boolean) so a reloaded profile with a
  // different asset URL automatically gets a fresh load attempt — no
  // setState-in-effect needed, and both images can fail independently.
  const [brokenLetterhead, setBrokenLetterhead] = useState('');
  const [brokenLogo, setBrokenLogo] = useState('');
  const letterheadBroken = !!letterheadSrc && brokenLetterhead === letterheadSrc;
  const logoBroken = !!logoSrc && brokenLogo === logoSrc;

  if (part === 'footer') {
    if (!profile) return null;
    const line = [profile.labName, profile.address, profile.phone, profile.email]
      .filter(Boolean)
      .join(' | ');
    if (!line) return null;
    return (
      <div className="lh-footer" aria-label="Lab contact footer">
        {line}
      </div>
    );
  }

  // Header — screen-only skeleton while the profile request is in flight
  // (marked .no-print so it never reaches paper).
  if (!profile) {
    if (loading) {
      return (
        <div className="lh-skeleton no-print" aria-hidden="true">
          <span className="lh-skeleton-mark" />
          <span className="lh-skeleton-lines" />
        </div>
      );
    }
    return null;
  }

  const labName = profile.labName || '';
  const tagline = profile.tagline || '';
  const contact = [
    profile.address,
    profile.phone ? `Ph: ${profile.phone}` : '',
    profile.email
  ].filter(Boolean).join(' | ');

  // Same priority as the backend PDF header: the uploaded letterhead image
  // wins; if it is absent or fails to load, fall through to the typed block.
  if (letterheadSrc && !letterheadBroken) {
    return (
      <div className="lh-header lh-header-image">
        <img
          className="lh-letterhead-img"
          src={letterheadSrc}
          alt={labName || 'Lab letterhead'}
          onError={() => setBrokenLetterhead(letterheadSrc)}
        />
      </div>
    );
  }

  const showLogo = logoSrc && !logoBroken;
  if (!showLogo && !labName && !tagline && !contact) return null;

  return (
    <header
      className="lh-header lh-header-typed"
      aria-label={labName ? `${labName} letterhead` : 'Lab letterhead'}
    >
      {showLogo ? (
        <img
          className="lh-logo"
          src={logoSrc}
          alt={labName ? `${labName} logo` : 'Lab logo'}
          onError={() => setBrokenLogo(logoSrc)}
        />
      ) : null}
      <div className="lh-identity">
        {labName ? <div className="lh-name">{labName}</div> : null}
        {tagline ? <div className="lh-tagline">{tagline}</div> : null}
        {contact ? <div className="lh-contact">{contact}</div> : null}
      </div>
    </header>
  );
};

export default Letterhead;
