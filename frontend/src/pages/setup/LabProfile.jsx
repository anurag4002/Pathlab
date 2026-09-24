import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getLabProfile,
  updateLabProfile,
  uploadLogo,
  uploadLetterhead
} from '../../services/setupService';
import {
  PageHeader,
  Button,
  Input,
  FileUploader,
  LoadingSpinner,
  EmptyState
} from '../../components/common';
import { isAdmin } from '../../utils/permissions';
import useAuth from '../../hooks/useAuth';
import { validateEmail, validatePhone, validateNumber } from '../../utils/validators';
import assetSrc from '../../utils/assetSrc';
import '../../styles/LabProfile.css';

// Fields accepted by the current lab-profile API. Logo and letterhead URLs
// are changed only through their upload endpoints.
const EDITABLE_FIELDS = [
  'labName',
  'tagline',
  'phone',
  'address',
  'email',
  'letterheadTopMargin',
  'showLetterheadByDefault',
  'smsEnabled',
  'whatsappEnabled',
  'emailEnabled',
  'smsSenderId',
  'googleReviewLink',
  'website',
  'disclaimer',
  'invoiceFooter',
  'registrationPrefix',
  'registrationNumber',
  'dateFormat',
  'barcodeFormat',
  'caseStartNumber'
];

const NUMERIC_FIELDS = new Set(['letterheadTopMargin', 'caseStartNumber']);
const ALLOWED_ASSET_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_ASSET_BYTES = 10 * 1024 * 1024;

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

const comparableValue = (value) => (
  value === undefined || value === null ? '' : String(value)
);

const isImageAsset = (url) => /\.(?:jpg|jpeg|png|gif|webp)(?:$|\?)/i.test(url);

const validateAssetFile = (file, kind) => {
  if (!file) return `Choose a ${kind} file.`;
  const extension = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
  const allowed = kind === 'logo' ? ['.jpg', '.jpeg', '.png'] : ALLOWED_ASSET_EXTENSIONS;
  const maxBytes = kind === 'logo' ? 2 * 1024 * 1024 : MAX_ASSET_BYTES;
  if (!allowed.includes(extension)) {
    return kind === 'logo' ? 'Logo files must be JPG, JPEG, or PNG.' : 'Only PDF, JPG, JPEG, and PNG files are supported.';
  }
  if (file.size > maxBytes) return kind === 'logo' ? 'The logo must be 2 MB or smaller.' : 'The file must be 10 MB or smaller.';
  return '';
};

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

const AssetPreview = ({ kind, url, broken, onError }) => {
  const src = assetSrc(url);
  const label = kind === 'logo' ? 'logo' : 'letterhead';

  if (!src) {
    return <div className="lab-profile-asset-empty">No {label} uploaded.</div>;
  }

  if (broken) {
    return (
      <div className="lab-profile-asset-empty">
        <span>The current {label} could not be loaded.</span>
        <a href={src} target="_blank" rel="noreferrer">Open the current file</a>
      </div>
    );
  }

  if (isImageAsset(src)) {
    return (
      <img
        className={`lab-profile-asset-preview lab-profile-${label}-preview`}
        src={src}
        alt={`Current lab ${label}`}
        onError={() => onError(src)}
      />
    );
  }

  return (
    <div className="lab-profile-asset-empty">
      <span>Current {label} file</span>
      <a href={src} target="_blank" rel="noreferrer">Open file</a>
    </div>
  );
};

const AssetManager = ({
  kind,
  label,
  url,
  file,
  version,
  disabled,
  loading,
  error,
  broken,
  onError,
  onFileChange
}) => {
  const inputLabel = kind === 'logo' ? 'Upload logo' : 'Upload letterhead';
  const description = kind === 'logo'
    ? 'Current logo asset returned by the lab profile API.'
    : 'Current letterhead asset returned by the lab profile API.';

  return (
    <div className="lab-profile-asset-card">
      <div className="lab-profile-section-heading">
        <h3>{label}</h3>
        <p>{description}</p>
      </div>
      <AssetPreview kind={kind} url={url} broken={broken} onError={onError} />
      {loading && <p className="lab-profile-upload-status" role="status">Uploading {kind}…</p>}
      {!disabled && (
        <FileUploader
          key={`${kind}-${version}`}
          label={inputLabel}
          subtitle="PDF, JPG, JPEG, or PNG up to 10 MB"
          accept=".pdf,.jpg,.jpeg,.png"
          value={file}
          disabled={loading}
          onChange={(selectedFile) => onFileChange(kind, selectedFile)}
          error={error}
        />
      )}
      {disabled && !loading && <p className="lab-profile-helper">Use Edit profile to replace this asset.</p>}
    </div>
  );
};

const LabProfile = () => {
  const { user } = useAuth();
  const canEdit = Boolean(isAdmin(user));
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [selectedLogo, setSelectedLogo] = useState(null);
  const [selectedLetterhead, setSelectedLetterhead] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [assetVersion, setAssetVersion] = useState(0);
  const [brokenLogo, setBrokenLogo] = useState('');
  const [brokenLetterhead, setBrokenLetterhead] = useState('');

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
      setForm(getFormValues(nextProfile));
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

  const profileHasValues = useMemo(() => {
    if (!profile) return false;
    return [...EDITABLE_FIELDS, 'logoUrl', 'letterheadUrl'].some((field) => (
      profile[field] !== undefined && profile[field] !== null && profile[field] !== ''
    ));
  }, [profile]);

  const clearMessages = () => {
    setFormError('');
    setNotice('');
    setUploadError(null);
    setFieldErrors({});
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError('');
    setNotice('');
    setUploadError(null);
  };

  const validateForm = () => {
    const errors = {};
    const email = typeof form.email === 'string' ? form.email.trim() : form.email;
    const phone = typeof form.phone === 'string' ? form.phone.trim() : form.phone;

    if (email && !validateEmail(email)) errors.email = 'Enter a valid email address.';
    if (phone && !validatePhone(phone)) errors.phone = 'Enter a valid phone number.';

    ['letterheadTopMargin', 'caseStartNumber'].forEach((field) => {
      const value = form[field];
      if (value === '' && profile?.[field] !== undefined && profile?.[field] !== '') {
        errors[field] = 'Enter a number to change this API-backed setting.';
      } else if (value !== undefined && value !== null && value !== '' && !validateNumber(value)) {
        errors[field] = 'Enter a valid non-negative number.';
      }
    });

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

  const resetAssetSelections = () => {
    setSelectedLogo(null);
    setSelectedLetterhead(null);
    setAssetVersion((version) => version + 1);
  };

  const startEditing = () => {
    if (!canEdit || !profile) return;
    setForm(getFormValues(profile));
    resetAssetSelections();
    clearMessages();
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setForm(getFormValues(profile));
    resetAssetSelections();
    setIsEditing(false);
    clearMessages();
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!canEdit || !isEditing || saving || uploading) return;

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Please correct the highlighted fields.');
      return;
    }

    setSaving(true);
    setFormError('');
    setNotice('');

    try {
      const response = await updateLabProfile(buildPayload());
      if (!response?.success) {
        throw new Error(response?.message || 'The lab profile could not be saved.');
      }

      const savedProfile = getProfileData(response);
      if (!savedProfile) throw new Error('The save response did not contain the updated lab profile.');

      setProfile(savedProfile);
      setForm(getFormValues(savedProfile));
      setIsEditing(false);
      setNotice(response.message || 'Lab profile saved.');
      await loadProfile({ showLoading: false });
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save the lab profile.'));
    } finally {
      setSaving(false);
    }
  };

  const uploadAsset = async (kind, file) => {
    if (!canEdit || !isEditing || saving || uploading) return;

    const validationMessage = validateAssetFile(file, kind);
    if (validationMessage) {
      setUploadError({ kind, message: validationMessage });
      return;
    }

    setUploading(kind);
    setUploadError(null);
    setNotice('');

    try {
      const service = kind === 'logo' ? uploadLogo : uploadLetterhead;
      const response = await service(file);
      if (!response?.success) {
        throw new Error(response?.message || `The ${kind} could not be uploaded.`);
      }

      const nextProfile = getProfileData(response);
      if (!nextProfile) throw new Error('The upload response did not contain the updated lab profile.');

      setProfile(nextProfile);
      setForm(getFormValues(nextProfile));
      if (kind === 'logo') setSelectedLogo(null);
      if (kind === 'letterhead') setSelectedLetterhead(null);
      setAssetVersion((version) => version + 1);
      setNotice(response.message || `Lab ${kind} uploaded.`);
      await loadProfile({ showLoading: false, preserveEditing: true });
    } catch (error) {
      setUploadError({ kind, message: getErrorMessage(error, `Failed to upload the lab ${kind}.`) });
    } finally {
      setUploading(null);
    }
  };

  const handleAssetChange = (kind, file) => {
    const validationMessage = validateAssetFile(file, kind);
    if (validationMessage) {
      setUploadError({ kind, message: validationMessage });
      setNotice('');
      return;
    }

    if (kind === 'logo') setSelectedLogo(file);
    if (kind === 'letterhead') setSelectedLetterhead(file);
    uploadAsset(kind, file);
  };

  const fieldDisabled = !isEditing || saving || Boolean(uploading);
  const isBusy = saving || Boolean(uploading);
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
        subtitle="Manage the supported centre identity, registration, contact, report, and notification settings."
        action={headerAction}
      />

      {loadError && (
        <ProfileAlert
          message={loadError}
          onRetry={() => loadProfile({ preserveEditing: isEditing })}
        />
      )}
      {formError && <ProfileAlert message={formError} />}
      {notice && <ProfileAlert message={notice} type="success" />}

      {loading ? (
        <div className="lab-profile-loading" aria-busy="true">
          <LoadingSpinner label="Loading lab profile..." />
        </div>
      ) : !profile ? (
        <section className="lab-profile-section lab-profile-empty-section">
          <EmptyState
            title="Lab profile unavailable"
            message="No profile data is available to display. Retry the profile request or check the API response."
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
              message="The API returned an empty profile. Add only values supported by the existing profile contract."
            />
          )}

          <form className="lab-profile-form" onSubmit={saveProfile} noValidate>
            <section className="lab-profile-section" aria-labelledby="lab-profile-identity-heading">
              <div className="lab-profile-section-heading">
                <h2 id="lab-profile-identity-heading">Lab identity</h2>
                <p>Identity fields used by the existing profile API and report letterhead.</p>
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

            <section className="lab-profile-section" aria-labelledby="lab-profile-registration-heading">
              <div className="lab-profile-section-heading">
                <h2 id="lab-profile-registration-heading">Registration settings</h2>
                <p>Only the registration setting currently exposed by the LabProfile API is shown here.</p>
              </div>
              <div className="lab-profile-grid lab-profile-grid-settings">
                <Input
                  id="caseStartNumber"
                  name="caseStartNumber"
                  label="Stored case start number"
                  type="number"
                  value={form.caseStartNumber ?? ''}
                  onChange={(event) => updateField('caseStartNumber', event.target.value)}
                  error={fieldErrors.caseStartNumber}
                  disabled={fieldDisabled}
                  helperText="Stored profile value; the current registration-number generator remains backend-controlled."
                />
                <Input
                  id="registrationPrefix"
                  name="registrationPrefix"
                  label="Registration prefix"
                  value={form.registrationPrefix ?? ''}
                  onChange={(event) => updateField('registrationPrefix', event.target.value)}
                  disabled={fieldDisabled}
                />
                <Input
                  id="registrationNumber"
                  name="registrationNumber"
                  label="Registration number"
                  value={form.registrationNumber ?? ''}
                  onChange={(event) => updateField('registrationNumber', event.target.value)}
                  disabled={fieldDisabled}
                />
                <Input
                  id="dateFormat"
                  name="dateFormat"
                  label="Date format"
                  value={form.dateFormat ?? ''}
                  onChange={(event) => updateField('dateFormat', event.target.value)}
                  disabled={fieldDisabled}
                />
                <Input
                  id="barcodeFormat"
                  name="barcodeFormat"
                  label="Barcode format"
                  value={form.barcodeFormat ?? ''}
                  onChange={(event) => updateField('barcodeFormat', event.target.value)}
                  disabled={fieldDisabled}
                />
              </div>
              <div className="lab-profile-registration-note" role="note">
                <strong>Registration numbers are generated by the backend.</strong>
                <p>
                  The current API does not expose a configurable prefix, date or barcode format, or a next-number preview. This screen does not generate, calculate, or override registration numbers.
                </p>
              </div>
            </section>

            <section className="lab-profile-section" aria-labelledby="lab-profile-contact-heading">
              <div className="lab-profile-section-heading">
                <h2 id="lab-profile-contact-heading">Contact information</h2>
                <p>Contact details supported by the current lab profile record.</p>
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
                  helperText="Stored exactly as supported by the profile API."
                />
              </div>
            </section>

            <section className="lab-profile-section" aria-labelledby="lab-profile-address-heading">
              <div className="lab-profile-section-heading">
                <h2 id="lab-profile-address-heading">Address</h2>
                <p>The current API stores address as one free-form field.</p>
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

            <section className="lab-profile-section" aria-labelledby="lab-profile-report-heading">
              <div className="lab-profile-section-heading">
                <h2 id="lab-profile-report-heading">Report and letterhead</h2>
                <p>API-backed assets and print settings already supported by the application.</p>
              </div>
              <div className="lab-profile-grid lab-profile-grid-settings">
                <Input
                  id="letterheadTopMargin"
                  name="letterheadTopMargin"
                  label="Letterhead top margin"
                  type="number"
                  value={form.letterheadTopMargin ?? ''}
                  onChange={(event) => updateField('letterheadTopMargin', event.target.value)}
                  error={fieldErrors.letterheadTopMargin}
                  disabled={fieldDisabled}
                  helperText="Stored PDF position value; units and bounds are defined by the backend."
                />
                <ToggleField
                  id="showLetterheadByDefault"
                  label="Letterhead by default"
                  checked={form.showLetterheadByDefault}
                  onChange={(value) => updateField('showLetterheadByDefault', value)}
                  disabled={fieldDisabled}
                  helperText="Stored profile preference. Existing print/PDF callers may still choose their own letterhead option."
                />
              </div>
              <div className="lab-profile-assets">
                <AssetManager
                  kind="logo"
                  label="Logo"
                  url={profile.logoUrl}
                  file={selectedLogo}
                  version={assetVersion}
                  disabled={!isEditing || !canEdit || isBusy}
                  loading={uploading === 'logo'}
                  error={uploadError?.kind === 'logo' ? uploadError.message : ''}
                  broken={brokenLogo === assetSrc(profile.logoUrl) && !!assetSrc(profile.logoUrl)}
                  onError={setBrokenLogo}
                  onFileChange={handleAssetChange}
                />
                <AssetManager
                  kind="letterhead"
                  label="Letterhead"
                  url={profile.letterheadUrl}
                  file={selectedLetterhead}
                  version={assetVersion}
                  disabled={!isEditing || !canEdit || isBusy}
                  loading={uploading === 'letterhead'}
                  error={uploadError?.kind === 'letterhead' ? uploadError.message : ''}
                  broken={brokenLetterhead === assetSrc(profile.letterheadUrl) && !!assetSrc(profile.letterheadUrl)}
                  onError={setBrokenLetterhead}
                  onFileChange={handleAssetChange}
                />
              </div>
            </section>

            <section className="lab-profile-section" aria-labelledby="lab-profile-notification-heading">
              <div className="lab-profile-section-heading">
                <h2 id="lab-profile-notification-heading">Notifications and working settings</h2>
                <p>Only settings present in the existing LabProfile API are shown.</p>
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
                  helperText="Stored profile value; notification delivery may use backend environment configuration."
                />
              </div>
            </section>

            <div className="lab-profile-actions">
              {isEditing ? (
                <>
                  <Button
                    type="submit"
                    loading={saving}
                    disabled={!isDirty || isBusy}
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
                  {canEdit ? 'Select Edit profile to change API-backed settings.' : 'This profile is read-only for the current role.'}
                </p>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default LabProfile;
