import React, { useEffect, useState } from 'react';

// Left-hand list of the sections on a settings page; clicking scrolls to
// the card, and the one in view is highlighted.
export default function SettingsNav({ sections = [] }) {
  const [active, setActive] = useState(sections[0]?.id);
  useEffect(() => {
    const cards = sections.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!cards.length || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-80px 0px -60% 0px' });
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [sections.map((s) => s.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  if (sections.length < 2) return <div />;
  return (
    <nav className="st-nav" aria-label="Sections">
      {sections.map((s) => (
        <button key={s.id} type="button" className={active === s.id ? 'is-on' : ''}
          onClick={() => { setActive(s.id); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
          {s.label}
        </button>
      ))}
    </nav>
  );
}
