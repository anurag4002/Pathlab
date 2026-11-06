import React from 'react';
import { useUiVersion } from '../../../utils/uiVersion';
import './PageHeader.css';
import PageTip from '../PageTip';

// New look: short, plain titles (pathlab-ui skill §2).
const SHORT_TITLES = {
  'Billing Ledger': 'Bills',
  'Patients File Registry': 'Patients',
  'Outstanding Balances Due': 'Dues',
  'Business Intelligence Analysis': 'Business analysis',
  'Case Wise Business Report': 'Case-wise report',
  'Clinical Data Export Center': 'Data export',
  'Collection Agents Directory': 'Agents',
  'Completed X-Ray Reports Archive': 'X-ray reports',
  'Daily Business Ledger': 'Daily business',
  'Doctor Portal Access': 'Doctor access',
  'Expense Voucher Register': 'Expenses',
  'Financial Transactions Audit': 'Transactions',
  'Audit Activity Logs': 'Activity log',
  'Tests Configuration Database': 'Tests',
  'Referral Doctors Directory': 'Referral doctors',
  'Referral Doctor Wise Report': 'Referral report',
  'Search Lab Reports': 'Search reports',
  'Unified Rate List': 'Rate list',
  'Test Panels Setup': 'Test panels',
  'Test Packages Setup': 'Test packages',
  'Test Categories Setup': 'Test categories',
  'Interpretations Management': 'Interpretations',
  'Normal Range Management': 'Normal ranges',
  'Test Usage & Reorder Analytics': 'Test usage',
  'User Management': 'Users',
  'USG Clinical Report Templates': 'USG templates',
};

// Sentence case, keeping acronyms (USG, TAT) and words like "X-Ray" intact.
const sentenceCase = (text) => text.split(' ').map((word, i) => {
  if (i === 0 || word === word.toUpperCase() || /[A-Z].*[A-Z]/.test(word.slice(1)) || /^[A-Z]-/.test(word)) return word;
  return word.toLowerCase();
}).join(' ');

// Subtitles written for developers are not shown in the new look.
const DEVELOPER_WORDING = /\b(API|endpoint|server-|backend|Labsmart|parity|URL-based)\b/i;

const PageHeader = ({ title, subtitle, action, className = '' }) => {
  const isV2 = useUiVersion() === 'v2';
  const shownTitle = isV2 && typeof title === 'string' ? (SHORT_TITLES[title] || sentenceCase(title)) : title;
  const shownSubtitle = isV2 && typeof subtitle === 'string' && DEVELOPER_WORDING.test(subtitle) ? null : subtitle;
  return (
    <>
      <header className={`page-header ${className}`}>
        <div className="page-header-title-group">
          <h1 className="page-header-title">{shownTitle}</h1>
          {shownSubtitle && <p className="page-header-subtitle">{shownSubtitle}</p>}
        </div>
        {action && <div className="page-header-actions">{action}</div>}
      </header>
      <PageTip />
    </>
  );
};

export default PageHeader;
