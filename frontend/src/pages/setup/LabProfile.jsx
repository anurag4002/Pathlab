import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getLabProfile,
  updateLabProfile,
  uploadLogo,
  uploadLetterhead,
  uploadFooter,
  getSignatures
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
import DocumentFormatEditor from '../../components/lab/DocumentFormatEditor';
import '../../styles/LabProfile.css';

// Fields accepted by the current lab-profile API. Logo and letterhead URLs
// are changed only through their upload endpoints.
const EDITABLE_FIELDS = [
  'documentFormats', 'reportFormatId', 'billFormatId',
  'labName',
  'tagline',
  'phone',
  'address',
  'email',
  'letterheadTopMargin',
  'showLetterheadByDefault',
  'showFooterByDefault',
  'showBarcode',
  'showQR',
  'showTatDates',
  'showReferredBy',
  'showDepartmentHeading',
  'showFlagColumn',
  'showInterpretation',
  'showEndOfReport',
  'showSignatures',
  'showWatermark',
  'showPageNumber',
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

// One toggle per block of the reference lab report format. Stored on the
// LabProfile and honored by the server PDFs (?flag=0 overrides per download).
const PRINT_TOGGLES = [
  { key: 'showLetterheadByDefault', label: 'Letterhead header', helper: 'Top letterhead image on reports and bills.' },
  { key: 'showFooterByDefault', label: 'Footer strip', helper: 'Bottom marketing/sign-off band image.' },
  { key: 'showBarcode', label: 'Barcode + reg no.', helper: 'Registration barcode in the patient band.' },
  { key: 'showQR', label: 'QR code', helper: 'Scan-to-download QR in the patient band.' },
  { key: 'showTatDates', label: 'TAT dates', helper: 'Registered / collected / received / reported dates.' },
  { key: 'showReferredBy', label: 'Referred-by line', helper: 'Referring doctor under the patient name.' },
  { key: 'showDepartmentHeading', label: 'Department headings', helper: 'BIOCHEMISTRY-style headings over result tables.' },
  { key: 'showFlagColumn', label: 'H/L flag column', helper: 'High/low flags with bold abnormal values.' },
  { key: 'showInterpretation', label: 'Interpretation box', helper: 'Test interpretation notes below the table.' },
  { key: 'showEndOfReport', label: 'End-of-report line', helper: '~~~ End of report ~~~ marker.' },
  { key: 'showSignatures', label: 'Signatures', helper: 'Technician + doctor sign-off on the PDF.' },
  { key: 'showWatermark', label: 'Watermark logo', helper: 'Faded lab logo behind the results.' },
  { key: 'showPageNumber', label: 'Page numbers', helper: 'Page X of Y on every page.' }
];
const ALLOWED_ASSET_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
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
  value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
);

const isImageAsset = (url) => /\.(?:jpg|jpeg|png|gif|webp)(?:$|\?)/i.test(url);

const validateAssetFile = (file, kind) => {
  if (!file) return `Choose a ${kind} file.`;
  const extension = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
  const allowed = kind === 'logo' ? ['.jpg', '.jpeg', '.png'] : ALLOWED_ASSET_EXTENSIONS;
  const maxBytes = kind === 'logo' ? 2 * 1024 * 1024 : MAX_ASSET_BYTES;
  if (!allowed.includes(extension)) {
    return kind === 'logo' ? 'Logo files must be JPG, JPEG, or PNG.' : 'Use a JPG, JPEG, or PNG image for the header or footer.';
  }
  if (file.size > maxBytes) return kind === 'logo' ? 'The logo must be 2 MB or smaller.' : 'The file must be 10 MB or smaller.';
  return '';
};

const assetKindLabel = (kind) => (kind === 'logo' ? 'logo' : kind === 'footer' ? 'footer strip' : 'letterhead');

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
  const label = assetKindLabel(kind);

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
  const inputLabel = kind === 'logo' ? 'Upload logo' : kind === 'footer' ? 'Upload footer strip' : 'Upload letterhead';
  const description = kind === 'logo'
    ? 'Current logo asset returned by the lab profile API.'
    : kind === 'footer'
      ? 'Bottom band printed on reports and bills (sign-off + marketing strip).'
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
          subtitle={kind === 'logo' ? 'JPG, JPEG or PNG up to 2 MB' : 'JPG, JPEG or PNG up to 10 MB'}
          accept=".jpg,.jpeg,.png"
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

const isPdfAsset = (url) => /\.pdf(?:$|\?)/i.test(url || '');
const isImageFile = (file) => file?.type?.startsWith('image/') || /\.(?:jpg|jpeg|png|gif|webp)$/i.test(file?.name || '');

// Live A4-style preview mirroring the reference lab report: letterhead,
// patient band (barcode + TAT + QR), department headings, flag column,
// interpretation box, end-of-report line, signatures, footer strip and page
// number. Updates in real time as toggles, text or files change — before
// the upload even finishes.
const LetterheadLivePreview = ({ profile, form, localLetterheadUrl, localLogoUrl, localFooterUrl, signatures }) => {
  const opt = (key) => {
    const v = form?.[key] ?? profile?.[key];
    return v === undefined || v === null ? true : !!v;
  };
  const letterheadOn = opt('showLetterheadByDefault');
  const footerOn = opt('showFooterByDefault');
  const serverLetterhead = assetSrc(profile?.letterheadUrl);
  const serverLogo = assetSrc(profile?.logoUrl);
  const serverFooter = assetSrc(profile?.footerUrl);
  const letterheadSrc = localLetterheadUrl || serverLetterhead;
  const logoSrc = localLogoUrl || serverLogo;
  const footerSrc = localFooterUrl || serverFooter;
  const showLetterheadImage = letterheadOn && !!letterheadSrc && !isPdfAsset(letterheadSrc);
  const showPdfNotice = letterheadOn && !!letterheadSrc && isPdfAsset(letterheadSrc);

  const labName = form?.labName ?? profile?.labName ?? '';
  const tagline = form?.tagline ?? profile?.tagline ?? '';
  const phone = form?.phone ?? profile?.phone ?? '';
  const address = form?.address ?? profile?.address ?? '';
  const email = form?.email ?? profile?.email ?? '';
  const contact = [address, phone ? `Ph: ${phone}` : '', email].filter(Boolean).join(' | ');
  const footerLine = [labName, address, phone, email].filter(Boolean).join(' | ');
  const disclaimer = form?.disclaimer ?? profile?.disclaimer ?? '';
  const invoiceFooter = form?.invoiceFooter ?? profile?.invoiceFooter ?? '';
  const previewSigs = opt('showSignatures') ? (signatures || []).filter((s) => s?.imageUrl).slice(0, 2) : [];

  return (
    <div className="lab-profile-preview-card" aria-label="Live letterhead preview">
      <div className="lab-profile-section-heading">
        <h3>Live preview</h3>
        <p>Branding sketch that updates as you type or pick a file. Use the PDF preview above to check the saved format's exact layout.</p>
      </div>
      <div className="lab-profile-preview-sheet" aria-hidden="false">
        {showLetterheadImage ? (
          <img className="lab-profile-preview-letterhead" src={letterheadSrc} alt="Letterhead preview" />
        ) : showPdfNotice ? (
          <div className="lab-profile-preview-pdf-notice">PDF artwork cannot be rendered as a header image. Upload a PNG or JPG header to include it in generated reports.</div>
        ) : (
          <header className="lab-profile-preview-typed">
            {logoSrc && <img className="lab-profile-preview-logo" src={logoSrc} alt="Logo preview" />}
            <div className="lab-profile-preview-identity">
              <div className="lab-profile-preview-name">{labName || 'Your Lab Name'}</div>
              {tagline && <div className="lab-profile-preview-tagline">{tagline}</div>}
              {contact && <div className="lab-profile-preview-contact">{contact}</div>}
            </div>
          </header>
        )}
        {!letterheadOn && (
          <p className="lab-profile-preview-off-note">Letterhead off — reports will use the typed header above.</p>
        )}
        <div className="lab-profile-preview-band">
          <div className="lab-profile-preview-patient">
            <div className="lab-profile-preview-patient-name">Sample Patient</div>
            <div>Age / Sex : 32 YRS / M</div>
            {opt('showReferredBy') && <div>Referred by : Sample Doctor</div>}
            <div>Reg. no. : 5830</div>
          </div>
          <div className="lab-profile-preview-mid">
            {opt('showBarcode') && (
              <div className="lab-profile-preview-barcode" aria-hidden="true"><span>5830</span></div>
            )}
            {opt('showTatDates') && (
              <div className="lab-profile-preview-tat">
                <div>Registered on : Today</div>
                <div>Collected on : Today</div>
                <div>Received on : Today</div>
                <div>Reported on : Today</div>
              </div>
            )}
          </div>
          {opt('showQR') && (
            <div className="lab-profile-preview-qr"><span>QR</span><em>Scan to download</em></div>
          )}
        </div>
        {opt('showDepartmentHeading') && (
          <div className="lab-profile-preview-dept">BIOCHEMISTRY<div>KIDNEY FUNCTION TEST (KFT)</div></div>
        )}
        <div className="lab-profile-preview-table-wrap">
          {opt('showWatermark') && logoSrc && (
            <img className="lab-profile-preview-watermark" src={logoSrc} alt="" aria-hidden="true" />
          )}
          <table className="lab-profile-preview-table">
            <thead>
              <tr><th>Test</th><th>Value</th><th>Unit</th><th>Reference</th>{opt('showFlagColumn') && <th>Flag</th>}</tr>
            </thead>
            <tbody>
              <tr><td>Random Blood Sugar</td><td>76.30</td><td>mg/dl</td><td>70 - 140</td>{opt('showFlagColumn') && <td></td>}</tr>
              <tr className="abnormal"><td>Serum Urea</td><td>86.20</td><td>mg/dl</td><td>19 - 45</td>{opt('showFlagColumn') && <td>H</td>}</tr>
              <tr><td>Serum Sodium</td><td>137.0</td><td>mmol/L</td><td>136 - 146</td>{opt('showFlagColumn') && <td></td>}</tr>
            </tbody>
          </table>
        </div>
        {opt('showInterpretation') && (
          <div className="lab-profile-preview-interp">
            <strong>Creatinine — Interpretation</strong>
            <p>Sample note: endogenous production is proportional to muscle mass. Author test interpretations in the Test Database to print them here.</p>
          </div>
        )}
        {opt('showEndOfReport') && (
          <div className="lab-profile-preview-endline">~~~ End of report ~~~</div>
        )}
        {opt('showSignatures') && (previewSigs.length > 0 ? (
          <div className="lab-profile-preview-signatures">
            {previewSigs.map((s) => (
              <div className="lab-profile-preview-signature" key={s._id || s.name}>
                <img src={assetSrc(s.imageUrl)} alt={`${s.name || 'Signature'} preview`} />
                <div className="lab-profile-preview-sig-name">{s.name}{s.title ? ` (${s.title})` : ''}</div>
                <div className="lab-profile-preview-sig-role">Authorised Signatory</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="lab-profile-preview-no-sig">No signatures on file — upload one under Setup → Signatures to see it here.</p>
        ))}
        {(disclaimer || invoiceFooter) && (
          <p className="lab-profile-preview-disclaimer">{disclaimer || invoiceFooter}</p>
        )}
        {footerOn && footerSrc && !isPdfAsset(footerSrc) && (
          <img className="lab-profile-preview-strip" src={footerSrc} alt="Footer strip preview" />
        )}
        <div className="lab-profile-preview-bottomrow">
          {footerLine && <span>{footerLine}</span>}
          {opt('showPageNumber') && <span>Page 1 of 1</span>}
        </div>
      </div>
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
  const [selectedFooter, setSelectedFooter] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [assetVersion, setAssetVersion] = useState(0);
  const [brokenLogo, setBrokenLogo] = useState('');
  const [brokenLetterhead, setBrokenLetterhead] = useState('');
  const [brokenFooter, setBrokenFooter] = useState('');
  const [signatures, setSignatures] = useState([]);
  const [localLetterheadUrl, setLocalLetterheadUrl] = useState('');
  const [localLogoUrl, setLocalLogoUrl] = useState('');
  const [localFooterUrl, setLocalFooterUrl] = useState('');

  // Instant local preview the moment a file is picked (revoked on change).
  useEffect(() => {
    let url = '';
    if (selectedLetterhead && isImageFile(selectedLetterhead)) {
      url = URL.createObjectURL(selectedLetterhead);
      setLocalLetterheadUrl(url);
    } else {
      setLocalLetterheadUrl('');
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [selectedLetterhead]);

  useEffect(() => {
    let url = '';
    if (selectedLogo && isImageFile(selectedLogo)) {
      url = URL.createObjectURL(selectedLogo);
      setLocalLogoUrl(url);
    } else {
      setLocalLogoUrl('');
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [selectedLogo]);

  useEffect(() => {
    let url = '';
    if (selectedFooter && isImageFile(selectedFooter)) {
      url = URL.createObjectURL(selectedFooter);
      setLocalFooterUrl(url);
    } else {
      setLocalFooterUrl('');
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [selectedFooter]);

  // Signatures for the live preview (read-only; failures just hide the row).
  useEffect(() => {
    let active = true;
    getSignatures()
      .then((response) => {
        if (!active) return;
        const payload = response?.data;
        const arr = Array.isArray(payload) ? payload : payload?.signatures || [];
        setSignatures(Array.isArray(arr) ? arr : []);
      })
      .catch(() => { if (active) setSignatures([]); });
    return () => { active = false; };
  }, []);

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

  const profileHasValues = useMemo(() => {
    if (!profile) return false;
    return [...EDITABLE_FIELDS, 'logoUrl', 'letterheadUrl', 'footerUrl'].some((field) => (
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
    setSelectedFooter(null);
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
      const service = kind === 'logo' ? uploadLogo : kind === 'footer' ? uploadFooter : uploadLetterhead;
      const response = await service(file);
      if (!response?.success) {
        throw new Error(response?.message || `The ${kind} could not be uploaded.`);
      }

      const nextProfile = getProfileData(response);
      if (!nextProfile) throw new Error('The upload response did not contain the updated lab profile.');

      setProfile(nextProfile);
      if (kind === 'logo') setSelectedLogo(null);
      if (kind === 'letterhead') setSelectedLetterhead(null);
      if (kind === 'footer') setSelectedFooter(null);
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
    if (kind === 'footer') setSelectedFooter(file);
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

            <DocumentFormatEditor form={form} profile={profile} disabled={fieldDisabled} canPreview={canEdit && !isBusy} onChange={updateField} />
            <section className="lab-profile-section" aria-labelledby="lab-profile-report-heading">
              <div className="lab-profile-section-heading">
                <h2 id="lab-profile-report-heading">Report and letterhead</h2>
                <p>Choose which sections to include in generated reports and bills. Use the format editor above to set header height and page spacing.</p>
              </div>
              <div className="lab-profile-toggle-grid lab-profile-print-toggles">
                {PRINT_TOGGLES.map((toggle) => (
                  <ToggleField
                    key={toggle.key}
                    id={toggle.key}
                    label={toggle.label}
                    checked={form[toggle.key] ?? profile?.[toggle.key] ?? true}
                    onChange={(value) => updateField(toggle.key, value)}
                    disabled={fieldDisabled}
                    helperText={toggle.helper}
                  />
                ))}
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
                <AssetManager
                  kind="footer"
                  label="Footer strip"
                  url={profile.footerUrl}
                  file={selectedFooter}
                  version={assetVersion}
                  disabled={!isEditing || !canEdit || isBusy}
                  loading={uploading === 'footer'}
                  error={uploadError?.kind === 'footer' ? uploadError.message : ''}
                  broken={brokenFooter === assetSrc(profile.footerUrl) && !!assetSrc(profile.footerUrl)}
                  onError={setBrokenFooter}
                  onFileChange={handleAssetChange}
                />
              </div>
              <LetterheadLivePreview
                profile={profile}
                form={form}
                localLetterheadUrl={localLetterheadUrl}
                localLogoUrl={localLogoUrl}
                localFooterUrl={localFooterUrl}
                signatures={signatures}
              />
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
