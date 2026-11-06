import React from 'react';
import { PageHeader } from '../../components/common';
import './KeyboardShortcuts.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD = isMac ? '⌘' : 'Ctrl';

// Every keyboard shortcut in the app, grouped by where it works.
const GROUPS = [
  {
    title: 'Anywhere',
    items: [
      [['?'], 'Open this list of shortcuts'],
      [['/'], 'Jump to the search box on the current screen'],
      [[MOD, 'K'], 'Search patients, bills and reports'],
      [['Esc'], 'Close a dialog, menu or search'],
      [['Tab'], 'Next field or button (Shift+Tab goes back)'],
    ],
  },
  {
    title: 'New bill',
    items: [
      [['Enter'], 'In "Search all tests" (after typing): add the highlighted test and clear the box for the next one'],
      [['↑ / ↓'], 'In the test search: move the highlight'],
      [['Esc'], 'In the test search: clear it'],
      [['← / →'], 'On the department or All / Tests / Packages / Panels buttons: switch'],
      [['Alt', 'Enter'], 'Create the invoice (also Ctrl+Enter). Missing details are named and shown'],
    ],
  },
  {
    title: 'Result entry',
    items: [
      [['Enter'], 'Next value (Shift+Enter: previous). The value is selected, so typing replaces it'],
      [['↓ / ↑'], 'Next / previous value'],
      [[MOD, 'S'], 'Save (stay on the report)'],
      [[MOD, 'Enter'], 'Final (submit the results)'],
    ],
  },
  {
    title: 'Lists and menus',
    items: [
      [['↑ / ↓'], 'Move through a row\'s ⋯ menu or the Print menu'],
      [['Enter'], 'Choose the highlighted menu item'],
    ],
  },
];

export default function KeyboardShortcuts() {
  return (
    <div className="shortcuts-page">
      <PageHeader title="Keyboard shortcuts" subtitle="Press ? on any screen to open this list." />
      <div className="shortcuts-grid">
        {GROUPS.map((group) => (
          <section key={group.title} className="shortcuts-card" aria-labelledby={`sc-${group.title}`}>
            <h2 id={`sc-${group.title}`}>{group.title}</h2>
            <dl>
              {group.items.map(([keys, text]) => (
                <div key={text} className="shortcuts-row">
                  <dt>{keys.map((key, i) => <React.Fragment key={key + i}>{i > 0 && <span className="shortcuts-plus">+</span>}<kbd>{key}</kbd></React.Fragment>)}</dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
