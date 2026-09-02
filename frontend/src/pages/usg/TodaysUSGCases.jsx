import React, { useState, useEffect } from 'react';
import { getUSGCases, createUSGCase, updateUSGCase, getUSGTemplates } from '../../services/usgService';
import { getPatients } from '../../services/patientService';
import { getDoctors } from '../../services/doctorService';
import formatDate from '../../utils/formatDate';
import { Plus, Edit2, Printer } from 'lucide-react';
import { DataTable, PageHeader, Button, Modal, Select, Input, StatusBadge } from '../../components/common';

const TodaysUSGCases = () => {
  const [cases, setCases] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [formData, setFormData] = useState({ patient: '', referringDoctor: '', templateName: '', findings: '', status: 'Completed' });
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Print Case State
  const [printTarget, setPrintTarget] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await getUSGCases({ date: todayStr });
      if (res.success) {
        setCases(res.data);
      }
    } catch (err) {
      console.error('Failed to load today USG cases', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const [patRes, docRes, tempRes] = await Promise.all([
        getPatients({ limit: 100 }),
        getDoctors({ status: 'Active' }),
        getUSGTemplates()
      ]);
      if (patRes.success) setPatients(patRes.data.patients);
      if (docRes.success) setDoctors(docRes.data);
      if (tempRes.success) setTemplates(tempRes.data);
    } catch (err) {
      console.error('Failed to load options', err);
    }
  };

  useEffect(() => {
    fetchCases();
    loadOptions();
  }, []);

  const handleOpenCreate = () => {
    setEditingCase(null);
    setFormData({ patient: '', referringDoctor: '', templateName: '', findings: '', status: 'Completed' });
    setErrors({});
    setFormOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditingCase(c);
    setFormData({
      patient: c.patient?._id || '',
      referringDoctor: c.referringDoctor?._id || '',
      templateName: c.templateName || '',
      findings: c.findings,
      status: c.status
    });
    setErrors({});
    setFormOpen(true);
  };

  const handleTemplateChange = (e) => {
    const tempName = e.target.value;
    const selectedTemp = templates.find(t => t.name === tempName);
    setFormData(prev => ({
      ...prev,
      templateName: tempName,
      findings: selectedTemp ? selectedTemp.findings : ''
    }));
  };

  const validate = () => {
    const errs = {};
    if (!formData.patient) errs.patient = 'Please select a patient';
    if (!formData.findings.trim()) errs.findings = 'Findings report text is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitLoading(true);
    try {
      let res;
      const payload = {
        ...formData,
        referringDoctor: formData.referringDoctor || null
      };

      if (editingCase) {
        res = await updateUSGCase(editingCase._id, payload);
      } else {
        res = await createUSGCase(payload);
      }

      if (res.success) {
        setFormOpen(false);
        fetchCases();
      }
    } catch (err) {
      setErrors({ api: err.response?.data?.message || 'Failed to save USG findings' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handlePrint = (c) => {
    setPrintTarget(c);
    setPrintOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Today's Ultrasonography Cases"
        subtitle="Manage USG case findings, clinical report templates, and signatures verification"
        action={
          <Button variant="primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Create USG Case
          </Button>
        }
      />

      <DataTable
        headers={['Registered Date', 'Patient Reg No', 'Patient Name', 'Referring Doctor', 'Template Selected', 'Status', 'Actions']}
        data={cases}
        loading={loading}
        emptyMessage="No ultrasonography cases recorded today."
        renderRow={(c) => (
          <tr key={c._id}>
            <td>{formatDate(c.date).split(',')[0]}</td>
            <td style={{ fontWeight: '600' }}>{c.patient?.registrationNumber}</td>
            <td style={{ fontWeight: '600' }}>{c.patient?.name}</td>
            <td>{c.referringDoctor?.name || 'Self'}</td>
            <td>{c.templateName || 'Custom Findings'}</td>
            <td>
              <StatusBadge status={c.status} />
            </td>
            <td>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handleOpenEdit(c)}
                >
                  <Edit2 size={14} /> Findings
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => handlePrint(c)}
                >
                  <Printer size={14} /> Print
                </button>
              </div>
            </td>
          </tr>
        )}
      />

      {/* Case Creation Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingCase ? 'Edit USG Case Findings' : 'Create USG Case File'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={submitLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleFormSubmit} loading={submitLoading}>
              Save Findings
            </Button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit} className="form-grid" style={{ gridTemplateColumns: '1fr', maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
          {errors.api && <div className="form-error">{errors.api}</div>}
          
          <Select
            label="Patient Profile"
            value={formData.patient}
            onChange={(e) => setFormData(prev => ({ ...prev, patient: e.target.value }))}
            options={patients.map(p => ({ value: p._id, label: `${p.name} (${p.registrationNumber})` }))}
            error={errors.patient}
            required
            disabled={!!editingCase}
          />

          <Select
            label="Referring Doctor"
            value={formData.referringDoctor}
            onChange={(e) => setFormData(prev => ({ ...prev, referringDoctor: e.target.value }))}
            options={doctors.map(d => ({ value: d._id, label: d.name }))}
            placeholder="Self Referral"
          />

          <Select
            label="Choose USG Template"
            value={formData.templateName}
            onChange={handleTemplateChange}
            options={templates.map(t => ({ value: t.name, label: t.name }))}
            placeholder="Start with blank report findings"
          />

          <div className="form-group">
            <label className="form-label">Clinical USG Findings Details *</label>
            <textarea
              value={formData.findings}
              onChange={(e) => setFormData(prev => ({ ...prev, findings: e.target.value }))}
              className="form-control"
              rows={8}
              placeholder="Record findings details..."
              required
            />
            {errors.findings && <p className="form-error">{errors.findings}</p>}
          </div>

          <Select
            label="Case Status"
            value={formData.status}
            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
            options={[
              { value: 'Pending', label: 'Pending Signature' },
              { value: 'Completed', label: 'Completed Report' }
            ]}
            required
          />

        </form>
      </Modal>

      {/* Print USG Findings Modal */}
      <Modal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title="USG Report Print Preview"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPrintOpen(false)}>Close</Button>
            <Button variant="primary" onClick={() => window.print()}><Printer size={16} /> Print Report</Button>
          </>
        }
      >
        {printTarget && (
          <div className="printable-area" style={{ padding: '16px', color: '#000', fontSize: '0.9rem', lineHeight: '1.5' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img
                src="/logo.jpg"
                alt="Logo"
                style={{ width: '64px', height: '64px', borderRadius: '50%', marginBottom: '4px', objectFit: 'cover' }}
              />
              <h2 style={{ margin: 0, fontWeight: '700' }}>PURE PATH LAB</h2>
              <p style={{ margin: '2px 0' }}>ULTRASONOGRAPHY REPORT</p>
              <div style={{ borderBottom: '2px solid #000', margin: '10px 0', width: '100%' }}></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '1.5rem' }}>
              <div>
                <strong>Patient Name:</strong> {printTarget.patient?.name}<br />
                <strong>Age / Gender:</strong> {printTarget.patient?.age} Yrs / {printTarget.patient?.gender}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Reg Code:</strong> {printTarget.patient?.registrationNumber}<br />
                <strong>Date:</strong> {formatDate(printTarget.date).split(',')[0]}
              </div>
            </div>

            <div style={{ borderBottom: '1px solid #000', marginBottom: '1rem' }}></div>

            <div style={{ minHeight: '300px', whiteSpace: 'pre-wrap', fontFamily: 'sans-serif' }}>
              <strong>FINDINGS:</strong><br /><br />
              {printTarget.findings}
            </div>

            <div style={{ borderTop: '1px solid #000', marginTop: '2rem', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ textAlign: 'center', width: '200px' }}>
                <div style={{ height: '40px' }}></div>
                <strong>Dr. Anil Mehta, MD</strong><br />
                <span>Consultant Radiologist</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TodaysUSGCases;
