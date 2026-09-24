import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Trash2, ArrowRight, Circle, Building2, FileImage, IndianRupee, Ruler, Users, MonitorCheck, MessageSquare, PenLine, Receipt, FileCheck2, MailCheck } from 'lucide-react';
import useClientPagination from '../../hooks/useClientPagination';
import {
  getOnboarding,
  setOnboardingStep,
  getSignatures,
  createSignature,
  deleteSignature
} from '../../services/setupService';
import useAuth from '../../hooks/useAuth';
import { isAdmin } from '../../utils/permissions';
import formatDate from '../../utils/formatDate';
import {
  PageHeader,
  Button,
  DataTable,
  Input,
  FileUploader,
  ConfirmDialog,
  StatusBadge,
  LoadingSpinner,
  SignaturePreview
} from '../../components/common';
import '../../styles/SignatureManagement.css';

const EMPTY_SIGNATURE_FORM = {
  name: '',
  title: '',
  modalities: '',
  file: null
};
const ALLOWED_SIGNATURE_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_SIGNATURE_BYTES = 10 * 1024 * 1024;

const STEP_META = {
  'verify-email': { icon: MailCheck, link: '' },
  'centre-profile': { icon: Building2, link: '/setup/profile' },
  letterhead: { icon: FileImage, link: '/setup/profile' },
  rates: { icon: IndianRupee, link: '/lab/tests' },
  normals: { icon: Ruler, link: '/lab/tests' },
  users: { icon: Users, link: '/manage/employees' },
  'browser-code': { icon: MonitorCheck, link: '/manage/security' },
  'sms-setup': { icon: MessageSquare, link: '/delivery/templates' },
  signature: { icon: PenLine, link: '#signatures' },
  'first-bill': { icon: Receipt, link: '/cases/bills/new' },
  'first-report': { icon: FileCheck2, link: '/lab/reports' }
};

const getErrorMessage = (error, fallback) => {
  if (error?.response) {
    const message = error.response.data?.message;
    if (typeof message === 'string' && message.trim()) return message;
    const status = error.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to manage signatures.';
    if (status === 404) return 'The requested signature was not found.';
    if (status === 409) return 'The signature data changed elsewhere. Refresh and try again.';
    if (status === 422) return 'The signature data is invalid.';
    if (status >= 500) return 'The server could not complete the signature request.';
  }
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (error?.code === 'ERR_NETWORK' || error?.request) return 'Network error. Check your connection and try again.';
  return error?.message || fallback;
};

const getSignatureList = (response) => {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.signatures)) return response.data.signatures;
  return [];
};

const getModalitiesLabel = (modalities) => {
  if (Array.isArray(modalities)) return modalities.filter(Boolean).join(', ') || '—';
  return modalities || '—';
};

const validateSignatureFile = (file) => {
  if (!file) return 'Choose a signature file.';
  const extension = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
  if (!ALLOWED_SIGNATURE_EXTENSIONS.includes(extension)) {
    return 'Only PDF, JPG, JPEG, and PNG files are supported.';
  }
  if (file.size > MAX_SIGNATURE_BYTES) return 'The signature file must be 10 MB or smaller.';
  return '';
};

const Onboarding = () => {
  const { user } = useAuth();
  const canManage = isAdmin(user);
  const [onboarding, setOnboarding] = useState({ percent: null, steps: [] });
  const [onboardingLoading, setOnboardingLoading] = useState(true);
  const [onboardingError, setOnboardingError] = useState('');
  const [togglingKey, setTogglingKey] = useState('');
  const [signatures, setSignatures] = useState([]);
  const [signaturesLoading, setSignaturesLoading] = useState(true);
  const [signaturesError, setSignaturesError] = useState('');
  const signaturePagination = useClientPagination(signatures, 10);
  const [signatureForm, setSignatureForm] = useState(EMPTY_SIGNATURE_FORM);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadNotice, setUploadNotice] = useState('');
  const [uploadVersion, setUploadVersion] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const uploadInFlightRef = useRef(false);
  const deleteInFlightRef = useRef(false);
  const initialLoadStartedRef = useRef(false);
  const onboardingLoadRequestRef = useRef(0);
  const signatureLoadRequestRef = useRef(0);

  const loadOnboarding = async () => {
    const requestId = ++onboardingLoadRequestRef.current;
    setOnboardingLoading(true);
    try {
      const response = await getOnboarding();
      if (requestId !== onboardingLoadRequestRef.current) return;
      if (!response?.success) {
        setOnboardingError(response?.message || 'The onboarding service returned an unsuccessful response.');
        return;
      }
      setOnboarding(response.data || { percent: null, steps: [] });
      setOnboardingError('');
    } catch (error) {
      if (requestId === onboardingLoadRequestRef.current) {
        setOnboardingError(getErrorMessage(error, 'Failed to load onboarding progress.'));
      }
    } finally {
      if (requestId === onboardingLoadRequestRef.current) setOnboardingLoading(false);
    }
  };

  const loadSignatures = async () => {
    const requestId = ++signatureLoadRequestRef.current;
    setSignaturesLoading(true);
    try {
      const response = await getSignatures();
      if (requestId !== signatureLoadRequestRef.current) return;
      if (!response?.success) {
        setSignaturesError(response?.message || 'The signature service returned an unsuccessful response.');
        return;
      }
      setSignatures(getSignatureList(response));
      setSignaturesError('');
    } catch (error) {
      if (requestId === signatureLoadRequestRef.current) {
        setSignaturesError(getErrorMessage(error, 'Failed to load signatures.'));
      }
    } finally {
      if (requestId === signatureLoadRequestRef.current) setSignaturesLoading(false);
    }
  };

  useEffect(() => {
    if (initialLoadStartedRef.current) return;
    initialLoadStartedRef.current = true;
    const loadInitialData = async () => {
      await Promise.all([loadOnboarding(), loadSignatures()]);
    };
    loadInitialData();
  }, []);

  const toggleStep = async (key, done) => {
    if (!canManage || togglingKey) return;
    setTogglingKey(key);
    setOnboardingError('');
    try {
      const response = await setOnboardingStep(key, done);
      if (!response?.success) {
        setOnboardingError(response?.message || 'The onboarding step could not be updated.');
        return;
      }
      await loadOnboarding();
    } catch (error) {
      setOnboardingError(getErrorMessage(error, 'Failed to update the onboarding step.'));
    } finally {
      setTogglingKey('');
    }
  };

  const updateSignatureField = (field, value) => {
    setSignatureForm((current) => ({ ...current, [field]: value }));
    setUploadError('');
  };

  const uploadSignature = async (event) => {
    event.preventDefault();
    if (!canManage || uploadLoading || uploadInFlightRef.current) return;

    const fileError = validateSignatureFile(signatureForm.file);
    if (fileError) {
      setUploadError(fileError);
      return;
    }
    if (!signatureForm.name.trim()) {
      setUploadError('Signature name is required.');
      return;
    }

    const formData = new FormData();
    formData.append('file', signatureForm.file);
    formData.append('name', signatureForm.name.trim());
    if (signatureForm.title.trim()) formData.append('title', signatureForm.title.trim());
    signatureForm.modalities
      .split(',')
      .map((modality) => modality.trim())
      .filter(Boolean)
      .forEach((modality) => formData.append('modalities', modality));

    uploadInFlightRef.current = true;
    setUploadLoading(true);
    setUploadError('');
    setUploadNotice('');
    setActionError('');

    try {
      const response = await createSignature(formData);
      if (!response?.success) {
        setUploadError(response?.message || 'The signature could not be uploaded.');
        return;
      }
      setSignatureForm(EMPTY_SIGNATURE_FORM);
      setUploadVersion((version) => version + 1);
      setUploadNotice(response.message || 'Signature uploaded.');
      await loadSignatures();
    } catch (error) {
      setUploadError(getErrorMessage(error, 'Failed to upload the signature.'));
    } finally {
      uploadInFlightRef.current = false;
      setUploadLoading(false);
    }
  };

  const openDelete = (signature) => {
    if (!canManage) return;
    setActionError('');
    setUploadNotice('');
    setDeleteTarget(signature);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteLoading || deleteInFlightRef.current) return;
    deleteInFlightRef.current = true;
    setDeleteLoading(true);
    setActionError('');

    try {
      const response = await deleteSignature(deleteTarget._id);
      if (!response?.success) {
        setDeleteTarget(null);
        setActionError(response?.message || 'The signature could not be deleted.');
        return;
      }
      setDeleteTarget(null);
      setUploadNotice(response.message || 'Signature deleted.');
      await loadSignatures();
    } catch (error) {
      setDeleteTarget(null);
      setActionError(getErrorMessage(error, 'Failed to delete the signature.'));
    } finally {
      deleteInFlightRef.current = false;
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    signaturePagination.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatures]);

  const percent = onboarding.percent ?? onboarding.completion;
  const hasPercent = percent !== undefined && percent !== null && percent !== '' && Number.isFinite(Number(percent));
  const steps = useMemo(() => {
    const raw = Array.isArray(onboarding.steps)
      ? onboarding.steps
      : Array.isArray(onboarding.checklist) ? onboarding.checklist : [];
    return raw.map((step, index) => {
      const meta = STEP_META[step.key] || {};
      return {
        ...step,
        key: step.key || `step-${index}`,
        title: step.title || step.label || step.key,
        description: step.description || '',
        link: meta.link || step.link || '',
        Icon: meta.icon || Circle,
        done: !!step.done
      };
    });
  }, [onboarding]);
  const doneCount = steps.filter((step) => step.done).length;
  const nextStep = steps.find((step) => !step.done);
  const complete = steps.length > 0 && doneCount === steps.length;

  return (
    <div className="signature-management-page">
      <PageHeader
        title="Signature Management"
        subtitle="Onboarding checklist and API-backed signature records."
        action={canManage ? (
          <Button variant="secondary" onClick={() => { loadOnboarding(); loadSignatures(); }} icon={<RefreshCw size={14} />}>
            Refresh
          </Button>
        ) : null}
      />

      {onboardingError && (
        <div className="signature-management-alert signature-management-alert-error" role="alert">
          <span>{onboardingError}</span>
          <Button variant="secondary" size="sm" onClick={loadOnboarding}>Retry</Button>
        </div>
      )}

      <section className="signature-management-section" aria-labelledby="onboarding-progress-heading">
        <div className="signature-management-section-heading">
          <h2 id="onboarding-progress-heading">Onboarding progress</h2>
          <p>Checklist data comes from the existing onboarding API.</p>
        </div>
        {onboardingLoading ? (
          <LoadingSpinner label="Loading onboarding progress..." />
        ) : (
          <>
            <div className="signature-management-progress-label">
              <strong>Progress</strong>
              <span>{hasPercent ? `${percent}%` : '—'}</span>
            </div>
            <div className="signature-management-progress-track" aria-hidden="true">
              <div style={{ width: hasPercent ? `${percent}%` : '0%' }} />
            </div>
            <p className="signature-management-helper">
              {complete ? 'Setup complete — nice work!' : nextStep ? `Up next: ${nextStep.title}` : 'Loading your checklist…'}
            </p>
            <div className="signature-management-checklist">
              {steps.length === 0 ? (
                <p className="signature-management-helper">No onboarding steps were returned.</p>
              ) : steps.map((step, index) => {
                const Icon = step.Icon;
                const isNext = nextStep?.key === step.key;
                return (
                  <div className="signature-management-check" key={step.key || index}>
                    <Icon size={16} aria-hidden="true" />
                    <label>
                      <input
                        type="checkbox"
                        checked={!!step.done}
                        disabled={!canManage || !!togglingKey}
                        onChange={() => toggleStep(step.key, !step.done)}
                      />
                      <span>{step.title}</span>
                    </label>
                    {step.description && <small>{step.description}</small>}
                    {isNext && step.link && (
                      step.link.startsWith('#') ? (
                        <a href={step.link}>Open <ArrowRight size={12} /></a>
                      ) : (
                        <Link to={step.link}>Open <ArrowRight size={12} /></Link>
                      )
                    )}
                    {togglingKey === step.key && <span role="status">Saving…</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="signature-management-section" aria-labelledby="signature-management-heading">
        <div className="signature-management-section-heading">
          <h2 id="signature-management-heading">Signature Management</h2>
          <p>List, preview, upload, and remove signatures supported by the existing signature API.</p>
        </div>

        {signaturesError && (
          <div className="signature-management-alert signature-management-alert-error" role="alert">
            <span>{signaturesError}</span>
            <Button variant="secondary" size="sm" onClick={loadSignatures}>Retry</Button>
          </div>
        )}
        {actionError && <div className="signature-management-alert signature-management-alert-error" role="alert">{actionError}</div>}
        {uploadNotice && <div className="signature-management-alert signature-management-alert-success" role="status">{uploadNotice}</div>}

        {canManage && (
          <form className="signature-management-form" onSubmit={uploadSignature} noValidate>
            {uploadError && <div className="signature-management-alert signature-management-alert-error" role="alert">{uploadError}</div>}
            <div className="signature-management-form-grid">
              <Input
                label="Signature name"
                name="signature-name"
                value={signatureForm.name}
                onChange={(event) => updateSignatureField('name', event.target.value)}
                disabled={uploadLoading}
                required
              />
              <Input
                label="Title"
                name="signature-title"
                value={signatureForm.title}
                onChange={(event) => updateSignatureField('title', event.target.value)}
                disabled={uploadLoading}
              />
            </div>
            <Input
              label="Modalities (optional metadata)"
              name="signature-modalities"
              value={signatureForm.modalities}
              onChange={(event) => updateSignatureField('modalities', event.target.value)}
              disabled={uploadLoading}
              helperText="Comma-separated values. The API stores this metadata but does not currently enforce modality assignment."
            />
            <FileUploader
              key={`signature-upload-${uploadVersion}`}
              label="Upload signature"
              subtitle="PDF, JPG, JPEG, or PNG up to 10 MB"
              accept=".pdf,.jpg,.jpeg,.png"
              value={signatureForm.file}
              disabled={uploadLoading}
              onChange={(file) => updateSignatureField('file', file)}
            />
            <Button type="submit" loading={uploadLoading} disabled={uploadLoading}>Upload signature</Button>
          </form>
        )}

        <DataTable
          headers={['Name', 'Title', 'Modalities', 'Status', 'Preview', 'Created', 'Updated', 'Actions']}
          data={signaturePagination.paged}
          loading={signaturesLoading}
          emptyMessage="No signature records are available."
          pagination={{
            total: signaturePagination.total,
            page: signaturePagination.page,
            limit: signaturePagination.limit,
            pages: signaturePagination.pages,
            onPageChange: signaturePagination.goToPage,
            onLimitChange: signaturePagination.setLimit
          }}
          renderRow={(signature) => (
            <tr key={signature._id}>
              <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{signature.name || '—'}</td>
              <td>{signature.title || '—'}</td>
              <td>{getModalitiesLabel(signature.modalities)}</td>
              <td>{signature.status ? <StatusBadge status={signature.status} /> : '—'}</td>
              <td><SignaturePreview url={signature.imageUrl} label={signature.name || 'Signature'} /></td>
              <td>{formatDate(signature.createdAt)}</td>
              <td>{formatDate(signature.updatedAt)}</td>
              <td>
                {canManage ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => openDelete(signature)}
                    aria-label={`Delete ${signature.name || 'signature'}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                ) : '—'}
              </td>
            </tr>
          )}
        />
        <p className="signature-management-helper">
          Signature records can be uploaded, previewed, activated/deactivated, and removed. Use Settings → Signatures for the full management view.
        </p>
      </section>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        title="Delete signature record?"
        message={`Delete ${deleteTarget?.name || 'this signature'}? Historical reports may no longer be able to display its image.`}
        confirmText="Delete signature"
      />
    </div>
  );
};

export default Onboarding;
