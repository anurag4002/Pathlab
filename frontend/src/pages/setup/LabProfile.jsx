import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getLabProfile,
  updateLabProfile
} from '../../services/setupService';
import {
  PageHeader,
  Button,
  Input,
  LoadingSpinner,
  EmptyState
} from '../../components/common';
import { isAdmin } from '../../utils/permissions';
import useAuth from '../../hooks/useAuth';
import { validateEmail, validatePhone, validateNumber } from '../../utils/validators';
import { toast } from '../../components/common/Toast/toast';
import '../../styles/LabProfile.css';
import { useUiVersion } from '../../utils/uiVersion';
import ConfirmDialog from '../../components/common/ConfirmDialog/ConfirmDialog';
import SettingsNav from '../manage/v2/SettingsNav';
import '../manage/v2/manage.css';

// New look: plain names for the fields, used to say what changed.
const FIELD_NAMES = {
  labName: 'Lab name', tagline: 'Tagline', website: 'Website', caseStartNumber: 'Starting number', registrationDigits: 'Number of digits',
  labRegistrationNumber: 'Lab registration number', phone: 'Phone', email: 'Email', address: 'Address', disclaimer: 'Patient note',
  invoiceFooter: 'Bill footer', letterheadTopMargin: 'Header space', smsSenderId: 'SMS sender name',
};
const fieldName = (key) => FIELD_NAMES[key] || String(key).replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).replace(/ (\w)/g, (m) => m.toLowerCase());
const V2_SECTIONS = [
  { id: 'lp-identity', label: 'Lab name' },
  { id: 'lp-numbering', label: 'Numbering' },
  { id: 'lp-contact', label: 'Contact' },
  { id: 'lp-address', label: 'Address & notes' },
  { id: 'lp-print', label: 'Report design' },
  { id: 'lp-notify', label: 'Messages & work' },
];

// Fields accepted by the current lab-profile API. Logo and letterhead URLs
// are changed only through their upload endpoints.
// New look: unsaved edits survive a reload (this browser tab only) and the
// page reopens in edit mode with the "what changed" bar.
const PROFILE_DRAFT_KEY = 'ppl_draft:lab-profile';
const readProfileDraft = () => { try { return JSON.parse(sessionStorage.getItem(PROFILE_DRAFT_KEY) || 'null'); } catch { return null; } };
const clearProfileDraft = () => { try { sessionStorage.removeItem(PROFILE_DRAFT_KEY); } catch { /* ignore */ } };

const EDITABLE_FIELDS = [
  'labName',
  'tagline',
  'phone',
  'address',
  'email',
  'smsEnabled',
  'whatsappEnabled',
  'emailEnabled',
  'smsSenderId',
  'googleReviewLink',
  'website',
  'disclaimer',
  'invoiceFooter',
  'registrationNumber',
  'caseStartNumber',
  'registrationDigits'
];

const NUMERIC_FIELDS = new Set(['caseStartNumber', 'registrationDigits']);

const getProfileData = (response) => {
  const payload = response?.data?.profile ?? response?.data ?? response;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload;
};

const getErrorMessage = (error, fallback) => {
  if (error?.response) {
    const message = error.response.data?.message;
    if (typeof message === 'string' && message.trim()) return message;

    const status = error.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to view or update the lab profile.';
    if (status === 404) return 'The lab profile could not be found.';
    if (status === 409) return 'The profile changed elsewhere. Refresh and try again.';
    if (status === 422) return 'The profile data is invalid.';
    if (status >= 500) return 'The server could not load the lab profile. Please try again.';
  }

  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (error?.code === 'ERR_NETWORK' || error?.request) return 'Network error. Check your connection and try again.';
  return error?.message || fallback;
};

const getFormValues = (profile) => EDITABLE_FIELDS.reduce((values, field) => {
  if (profile && Object.prototype.hasOwnProperty.call(profile, field)) {
    values[field] = profile[field];
  }
  return values;
}, {});

const registrationPreview = (profile, form) => {
  const start = Number(form?.caseStartNumber ?? profile?.caseStartNumber ?? 1);
  const digits = Number(form?.registrationDigits ?? profile?.registrationDigits ?? 6);
  if (!Number.isSafeInteger(start) || start < 1 || !Number.isInteger(digits) || digits < 4 || digits > 12) return '—';
  const next = Math.max(start, Number(profile?.registrationSequence?.lastIssued || 0) + 1);
  return String(next).padStart(digits, '0');
};

const comparableValue = (value) => (
  value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
);

const ProfileAlert = ({ message, type = 'error', onRetry }) => (
  <div
    className={`lab-profile-alert lab-profile-alert-${type}`}
    role={type === 'success' || type === 'info' ? 'status' : 'alert'}
  >
    <span>{message}</span>
    {onRetry && (
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    )}
  </div>
);

const ToggleField = ({ id, label, checked, onChange, disabled, helperText }) => (
  <div className="lab-profile-toggle">
    <div className="lab-profile-toggle-control">
      <input
        id={id}
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id}>{label}</label>
    </div>
    {helperText && <p>{helperText}</p>}
  </div>
);

const LabProfile = () => {
  const isV2 = useUiVersion() === 'v2';
  const [confirmNumbering, setConfirmNumbering] = useState(false);
  const { user } = useAuth();
  const canEdit = Boolean(isAdmin(user));
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const loadProfile = useCallback(async ({ showLoading = true, preserveEditing = false } = {}) => {
    if (showLoading) setLoading(true);
    setLoadError('');

    try {
      const response = await getLabProfile();
      if (!response?.success) {
        setLoadError(response?.message || 'The lab profile service returned an unsuccessful response.');
        return;
      }

      const nextProfile = getProfileData(response);
      if (!nextProfile) {
        setLoadError('The lab profile service returned no profile data.');
        return;
      }

      setProfile(nextProfile);
      if (!preserveEditing) setForm(getFormValues(nextProfile));
      if (!preserveEditing) setIsEditing(false);
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Failed to load the lab profile.'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadProfile().catch((error) => {
      if (active) setLoadError(getErrorMessage(error, 'Failed to load the lab profile.'));
    });
    return () => { active = false; };
  }, [loadProfile]);

  const isDirty = useMemo(
    () => EDITABLE_FIELDS.some((field) => comparableValue(form[field]) !== comparableValue(profile?.[field])),
    [form, profile]
  );

  // Keep only the changed fields while editing; restore them once after load.
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    if (!isV2 || !isEditing || !profile) return;
    const changed = {};
    EDITABLE_FIELDS.forEach((field) => { if (comparableValue(form[field]) !== comparableValue(profile[field])) changed[field] = form[field]; });
    try {
      if (Object.keys(changed).length) sessionStorage.setItem(PROFILE_DRAFT_KEY, JSON.stringify(changed));
      else sessionStorage.removeItem(PROFILE_DRAFT_KEY);
    } catch { /* storage unavailable */ }
  }, [isV2, isEditing, form, profile]);
  useEffect(() => {
    if (!isV2 || draftRestored || !profile || !canEdit) return;
    setDraftRestored(true);
    const saved = readProfileDraft();
    if (!saved || !Object.keys(saved).length) return;
    setForm({ ...getFormValues(profile), ...saved });
    setIsEditing(true);
  }, [isV2, draftRestored, profile, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const profileHasValues = useMemo(() => {
    if (!profile) return false;
    return [...EDITABLE_FIELDS, 'logoUrl', 'letterheadUrl', 'footerUrl', 'signatureStripUrl'].some((field) => (
      profile[field] !== undefined && profile[field] !== null && profile[field] !== ''
    ));
  }, [profile]);

  const clearMessages = () => {
    setFieldErrors({});
  };

  // errorKey: the highlighted field this edit fixes (format editor fields
  // live under documentFormats.<id>.<key>).
  const updateField = (field, value, errorKey = field) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[errorKey]) return current;
      const next = { ...current };
      delete next[errorKey];
      return next;
    });
  };

  const validateForm = () => {
    const errors = {};
    const email = typeof form.email === 'string' ? form.email.trim() : form.email;
    const phone = typeof form.phone === 'string' ? form.phone.trim() : form.phone;

    if (email && !validateEmail(email)) errors.email = 'Enter a valid email address.';
    if (phone && !validatePhone(phone)) errors.phone = 'Enter a valid phone number.';

    ['caseStartNumber'].forEach((field) => {
      const value = form[field];
      if (value === '' && profile?.[field] !== undefined && profile?.[field] !== '') {
        errors[field] = isV2 ? 'Enter a number.' : 'Enter a number to change this API-backed setting.';
      } else if (value !== undefined && value !== null && value !== '' && !validateNumber(value)) {
        errors[field] = 'Enter a valid non-negative number.';
      }
    });

    if (form.caseStartNumber !== undefined && (!Number.isSafeInteger(Number(form.caseStartNumber)) || Number(form.caseStartNumber) < 1)) errors.caseStartNumber = 'Enter a positive whole number.';
    const digits = Number(form.registrationDigits ?? profile?.registrationDigits ?? 6);
    if (!Number.isInteger(digits) || digits < 4 || digits > 12) errors.registrationDigits = 'Choose a whole number from 4 to 12 digits.';
    return errors;
  };

  const buildPayload = () => EDITABLE_FIELDS.reduce((payload, field) => {
    if (!Object.prototype.hasOwnProperty.call(form, field)) return payload;

    let value = form[field];
    if (NUMERIC_FIELDS.has(field)) {
      if (value === '' || value === undefined || value === null) return payload;
      value = Number(value);
    }
    payload[field] = value;
    return payload;
  }, {});

  const startEditing = () => {
    if (!canEdit || !profile) return;
    setForm(getFormValues(profile));
    clearMessages();
    setIsEditing(true);
  };

  const cancelEditing = () => {
    clearProfileDraft();
    setForm(getFormValues(profile));
    setIsEditing(false);
    clearMessages();
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!canEdit || !isEditing || saving) return;

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // A toast stays in view wherever the person is on this long page; the
      // banner at the top did not. Name the first problem so it is clear.
      const messages = Object.values(errors);
      toast.error(messages.length > 1 ? `${messages[0]} Fix the ${messages.length} highlighted fields.` : messages[0]);
      return;
    }

    setSaving(true);

    try {
      const response = await updateLabProfile(buildPayload());
      if (!response?.success) {
        throw new Error(response?.message || 'The lab profile could not be saved.');
      }

      const savedProfile = getProfileData(response);
      if (!savedProfile) throw new Error('The save response did not contain the updated lab profile.');

      clearProfileDraft();
      setProfile(savedProfile);
      setForm(getFormValues(savedProfile));
      setIsEditing(false);
      toast.success(response.message || 'Lab profile saved.');
      await loadProfile({ showLoading: false });
    } catch (error) {
      const errors = error.response?.data?.errors;
      setFieldErrors(errors && typeof errors === 'object' && !errors.stack ? errors : {});
      toast.error(getErrorMessage(error, 'Failed to save the lab profile.'));
    } finally {
      setSaving(false);
    }
  };

  const fieldDisabled = !isEditing || saving;
  const isBusy = saving;
  const headerAction = profile && !loading ? (
    <div className="lab-profile-header-actions">
      {!isEditing && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => loadProfile()}
          disabled={isBusy}
        >
          Refresh
        </Button>
      )}
      {canEdit && !isEditing && (
        <Button size="sm" onClick={startEditing} disabled={isBusy}>
          Edit profile
        </Button>
      )}
      {isEditing && <span className="lab-profile-editing-label">Editing profile</span>}
    </div>
  ) : null;

  return (
    <div className="lab-profile-page">
      <PageHeader
        title="Lab Profile"
        subtitle={isV2 ? 'Your lab\'s name, contact details, bill and report numbering, and what prints on reports and bills.' : 'Manage the supported centre identity, registration, contact, report, and notification settings.'}
        action={headerAction}
      />

      {loadError && (
        <ProfileAlert
          message={loadError}
          onRetry={() => loadProfile({ preserveEditing: isEditing })}
        />
      )}

      {loading ? (
        <div className="lab-profile-loading" aria-busy="true">
          <LoadingSpinner label="Loading lab profile..." />
        </div>
      ) : !profile ? (
        <section className="lab-profile-section lab-profile-empty-section">
          <EmptyState
            title="Lab profile unavailable"
            message={isV2 ? 'The lab profile could not be loaded. Check the connection and try again.' : 'No profile data is available to display. Retry the profile request or check the API response.'}
            action={!loadError ? <Button onClick={() => loadProfile()}>Retry</Button> : null}
          />
        </section>
      ) : (
        <>
          {!canEdit && (
            <ProfileAlert
              type="info"
              message="You have read-only access to the lab profile."
            />
          )}
          {!profileHasValues && (
            <ProfileAlert
              type="info"
              message={isV2 ? 'Nothing is filled in yet. Select Edit profile to add your lab\'s details.' : 'The API returned an empty profile. Add only values supported by the existing profile contract.'}
            />
          )}

          <div className={isV2 ? 'st-layout' : undefined}>
          {isV2 && <SettingsNav sections={V2_SECTIONS} />}
          <form className="lab-profile-form" noValidate onSubmit={(event) => {
            if (isV2 && isEditing && ['caseStartNumber', 'registrationDigits'].some((k) => comparableValue(form[k]) !== comparableValue(profile?.[k]))) {
              event.preventDefault(); setConfirmNumbering(true); return;
            }
            saveProfile(event);
          }}>
            <section className="lab-profile-section" id="lp-identity" aria-labelledby="lab-profile-identity-heading">
              <div className="lab-profile-section-heading">
                <h2 id="lab-profile-identity-heading">Lab identity</h2>
                <p>{isV2 ? 'Printed at the top of every report and bill.' : 'Identity fields used by the existing profile API and report letterhead.'}</p>
              </div>
              <div className="lab-profile-grid">
                <Input
                  id="labName"
                  name="labName"
                  label="Lab / centre name"
                  value={form.labName ?? ''}
                  onChange={(event) => updateField('labName', event.target.value)}
                  error={fieldErrors.labName}
                  disabled={fieldDisabled}
                />
                <Input
                  id="tagline"
                  name="tagline"
                  label="Tagline"
                  value={form.tagline ?? ''}
                  onChange={(event) => updateField('tagline', event.target.value)}
                  disabled={fieldDisabled}
                />
                <Input
                  id="website"
                  name="website"
                  label="Website"
                  type="url"
                  value={form.website ?? ''}
                  onChange={(event) => updateField('website', event.target.value)}
                  disabled={fieldDisabled}
                />
              </div>
            </section>

            <section className="lab-profile-section" id="lp-numbering" aria-labelledby="lab-profile-registration-heading">
              <div className="lab-profile-section-heading">
                <h2 id="lab-profile-registration-heading">{isV2 ? 'Bill and registration numbering' : 'Registration settings'}</h2>
                <p>Set the starting number and digit count for new registrations and bills. Both use the same number, without a date.</p>
              </div>
              <div className="lab-profile-grid lab-profile-grid-settings">
                <Input
                  id="caseStartNumber"
                  name="caseStartNumber"
                  label="Sequence start number"
                  type="number"
                  min={1}
                  step={1}
                  value={form.caseStartNumber ?? ''}
                  onChange={(event) => updateField('caseStartNumber', event.target.value)}
                  error={fieldErrors.caseStartNumber}
                  disabled={fieldDisabled}
                  helperText="Minimum starting number for new registrations. Existing numbers are preserved."
                />
                <Input
                  id="registrationDigits"
                  name="registrationDigits"
                  label="Number of digits"
                  type="number"
                  min={4}
                  max={12}
                  step={1}
                  value={form.registrationDigits ?? 6}
                  onChange={event => updateField('registrationDigits', event.target.value)}
                  error={fieldErrors.registrationDigits}
                  disabled={fieldDisabled}
                  helperText="Leading zeros, from 4 to 12 digits. The sequence grows beyond this width when needed."
                />
                <Input
                  id="registrationNumber"
                  name="registrationNumber"
                  label="Lab registration number (printed on header)"
                  value={form.registrationNumber ?? ''}
                  onChange={(event) => updateField('registrationNumber', event.target.value)}
                  disabled={fieldDisabled}
                />
                <Input
                  id="nextRegistrationNumber"
                  label="Next registration / bill number"
                  value={registrationPreview(profile, form)}
                  readOnly
                  helperText="Preview using the latest loaded sequence. Saving applies these settings to new numbers."
                />
                <Input label="Barcode format" value="CODE39" readOnly helperText="The barcode contains the same registration / bill number." />
              </div>
              <div className="lab-profile-registration-note" role="note">
                <strong>Numbering is controlled by these settings.</strong>
                <p>
                  Use Edit profile, change the starting number or digit count, then Save changes. Existing numbers are preserved and the sequence never moves backwards. The lab registration number is separate and appears below the lab name on the bill.
                </p>
              </div>
            </section>

            <section className="lab-profile-section" id="lp-contact" aria-labelledby="lab-profile-contact-heading">
              <div className="lab-profile-section-heading">
                <h2 id="lab-profile-contact-heading">Contact information</h2>
                <p>{isV2 ? 'How patients and doctors can reach you. Printed on reports and bills.' : 'Contact details supported by the current lab profile record.'}</p>
              </div>
              <div className="lab-profile-grid">
                <Input
                  id="phone"
                  name="phone"
                  label="Phone"
                  type="tel"
                  value={form.phone ?? ''}
                  onChange={(event) => updateField('phone', event.target.value)}
                  error={fieldErrors.phone}
                  disabled={fieldDisabled}
                />
                <Input
                  id="email"
                  name="email"
                  label="Email"
                  type="text"
                  inputMode="email"
                  value={form.email ?? ''}
                  onChange={(event) => updateField('email', event.target.value)}
                  error={fieldErrors.email}
                  disabled={fieldDisabled}
                />
                <Input
                  id="googleReviewLink"
                  name="googleReviewLink"
                  label="Google review link"
                  type="text"
                  inputMode="url"
                  value={form.googleReviewLink ?? ''}
                  onChange={(event) => updateField('googleReviewLink', event.target.value)}
                  disabled={fieldDisabled}
                  helperText={isV2 ? undefined : 'Stored exactly as supported by the profile API.'}
                />
              </div>
            </section>

            <section className="lab-profile-section" id="lp-address" aria-labelledby="lab-profile-address-heading">
              <div className="lab-profile-section-heading">
                <h2 id="lab-profile-address-heading">Address</h2>
                <p>{isV2 ? 'Your address, a note for patients and the line at the bottom of bills.' : 'The current API stores address as one free-form field.'}</p>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="address">Address</label>
                <textarea
                  id="address"
                  name="address"
                  className={`form-control lab-profile-textarea ${fieldErrors.address ? 'has-error' : ''}`}
                  value={form.address ?? ''}
                  onChange={(event) => updateField('address', event.target.value)}
                  disabled={fieldDisabled}
                  aria-invalid={!!fieldErrors.address}
                  aria-describedby={fieldErrors.address ? 'address-error' : undefined}
                  rows={4}
                />
                {fieldErrors.address && <p className="form-error" id="address-error">{fieldErrors.address}</p>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="disclaimer">Patient disclaimer</label>
                <textarea
                  id="disclaimer"
                  name="disclaimer"
                  className="form-control lab-profile-textarea"
                  value={form.disclaimer ?? ''}
                  onChange={(event) => updateField('disclaimer', event.target.value)}
                  disabled={fieldDisabled}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="invoiceFooter">Invoice footer</label>
                <textarea
                  id="invoiceFooter"
                  name="invoiceFooter"
                  className="form-control lab-profile-textarea"
                  value={form.invoiceFooter ?? ''}
                  onChange={(event) => updateField('invoiceFooter', event.target.value)}
                  disabled={fieldDisabled}
                  rows={3}
                />
              </div>
            </section>

            <section className="lab-profile-section lab-profile-design-card" id="lp-print" aria-labelledby="lab-profile-design-heading">
              <div className="lab-profile-section-heading">
                <h2 id="lab-profile-design-heading">Report and bill design</h2>
                <p>Change how reports and bills look, and see the real PDF while you edit.</p>
              </div>
              <Link className="btn btn-primary" to="/setup/report-template">Open Report Template</Link>
            </section>

            <section className="lab-profile-section" id="lp-notify" aria-labelledby="lab-profile-notification-heading">
              <div className="lab-profile-section-heading">
                <h2 id="lab-profile-notification-heading">Notifications and working settings</h2>
                <p>{isV2 ? 'Messages to patients and day-to-day working settings.' : 'Only settings present in the existing LabProfile API are shown.'}</p>
              </div>
              <div className="lab-profile-toggle-grid">
                <ToggleField
                  id="smsEnabled"
                  label="SMS notifications"
                  checked={form.smsEnabled}
                  onChange={(value) => updateField('smsEnabled', value)}
                  disabled={fieldDisabled}
                />
                <ToggleField
                  id="whatsappEnabled"
                  label="WhatsApp notifications"
                  checked={form.whatsappEnabled}
                  onChange={(value) => updateField('whatsappEnabled', value)}
                  disabled={fieldDisabled}
                />
                <ToggleField
                  id="emailEnabled"
                  label="Email notifications"
                  checked={form.emailEnabled}
                  onChange={(value) => updateField('emailEnabled', value)}
                  disabled={fieldDisabled}
                />
              </div>
              <div className="lab-profile-grid lab-profile-grid-settings">
                <Input
                  id="smsSenderId"
                  name="smsSenderId"
                  label="SMS sender ID"
                  value={form.smsSenderId ?? ''}
                  onChange={(event) => updateField('smsSenderId', event.target.value)}
                  disabled={fieldDisabled}
                  helperText={isV2 ? 'The name shown as the sender of SMS messages.' : 'Stored profile value; notification delivery may use backend environment configuration.'}
                />
              </div>
            </section>

            <div className={`lab-profile-actions${isV2 && isEditing ? ' lp-v2-actions' : ''}`}>
              {isEditing ? (
                <>
                  {isV2 && (() => {
                    const changed = EDITABLE_FIELDS.filter((field) => comparableValue(form[field]) !== comparableValue(profile?.[field]));
                    return changed.length
                      ? <span className="st-changed">{changed.length} change{changed.length === 1 ? '' : 's'}: {changed.slice(0, 4).map(fieldName).join(', ')}{changed.length > 4 ? '...' : ''}</span>
                      : <span className="st-saved">No changes yet</span>;
                  })()}
                  <Button
                    type="submit"
                    loading={saving}
                    disabled={!isDirty || isBusy}
                    data-testid="lab-profile-save"
                  >
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={cancelEditing}
                    disabled={isBusy}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <p className="lab-profile-helper">
                  {isV2 ? (canEdit ? 'Select Edit profile at the top to make changes.' : 'Only an admin can change the lab profile.') : canEdit ? 'Select Edit profile to change API-backed settings.' : 'This profile is read-only for the current role.'}
                </p>
              )}
            </div>
          </form>
          </div>
          <ConfirmDialog
            isOpen={confirmNumbering}
            onClose={() => setConfirmNumbering(false)}
            onConfirm={() => { setConfirmNumbering(false); saveProfile({ preventDefault() {} }); }}
            title="Change bill and registration numbering?"
            message="New bills and registrations will use the new starting number or digit count. Numbers already given out stay the same, and numbers never go backwards."
            confirmText="Change numbering"
          />
        </>
      )}
    </div>
  );
};

export default LabProfile;
