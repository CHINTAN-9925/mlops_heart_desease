'use client';

import { useState, useEffect, useCallback } from 'react';
import { predict, getHistory } from '@/lib/api';
import { PredictionInput, PredictionResult, HistoryRecord } from '@/types';

const DEFAULT: PredictionInput = {
  age: 54,
  sex: 1,
  'chest pain type': 0,
  'resting blood pressure': 130,
  'serum cholestoral in mg/dl': 250,
  'fasting blood sugar > 120 mg/dl': 0,
  'resting electrocardiographic results': 0,
  'maximum heart rate achieved': 150,
  'exercise induced angina': 0,
  'oldpeak = ST depression induced by exercise relative to rest': 1.5,
  'the slope of the peak exercise ST segment': 1,
  'number of major vessels (0-3) colored by flourosopy': 0,
  thal: 2,
};

type Field =
  | { key: keyof PredictionInput; label: string; type: 'number'; min: number; max: number; step: number; unit: string }
  | { key: keyof PredictionInput; label: string; type: 'select'; options: { v: number; l: string }[] };

const GROUPS: { title: string; accent: string; dot: string; fields: Field[] }[] = [
  {
    title: 'Demographics',
    accent: '#3b82f6',
    dot: '#dbeafe',
    fields: [
      { key: 'age', label: 'Age', type: 'number', min: 1, max: 120, step: 1, unit: 'yrs' },
      { key: 'sex', label: 'Sex', type: 'select', options: [{ v: 0, l: 'Female' }, { v: 1, l: 'Male' }] },
    ],
  },
  {
    title: 'Vitals',
    accent: '#f59e0b',
    dot: '#fef3c7',
    fields: [
      { key: 'resting blood pressure', label: 'Resting Blood Pressure', type: 'number', min: 50, max: 250, step: 1, unit: 'mmHg' },
      { key: 'serum cholestoral in mg/dl', label: 'Serum Cholesterol', type: 'number', min: 100, max: 700, step: 1, unit: 'mg/dl' },
      { key: 'maximum heart rate achieved', label: 'Max Heart Rate', type: 'number', min: 60, max: 220, step: 1, unit: 'bpm' },
      { key: 'fasting blood sugar > 120 mg/dl', label: 'Fasting Blood Sugar > 120 mg/dl', type: 'select', options: [{ v: 0, l: 'No' }, { v: 1, l: 'Yes' }] },
    ],
  },
  {
    title: 'Cardiac Symptoms',
    accent: '#e74c4c',
    dot: '#fee2e2',
    fields: [
      { key: 'chest pain type', label: 'Chest Pain Type', type: 'select', options: [{ v: 0, l: 'Typical Angina' }, { v: 1, l: 'Atypical Angina' }, { v: 2, l: 'Non-Anginal Pain' }, { v: 3, l: 'Asymptomatic' }] },
      { key: 'resting electrocardiographic results', label: 'Resting ECG', type: 'select', options: [{ v: 0, l: 'Normal' }, { v: 1, l: 'ST-T Abnormality' }, { v: 2, l: 'LV Hypertrophy' }] },
      { key: 'exercise induced angina', label: 'Exercise-Induced Angina', type: 'select', options: [{ v: 0, l: 'No' }, { v: 1, l: 'Yes' }] },
    ],
  },
  {
    title: 'Diagnostic Tests',
    accent: '#8b5cf6',
    dot: '#ede9fe',
    fields: [
      { key: 'oldpeak = ST depression induced by exercise relative to rest', label: 'ST Depression (Oldpeak)', type: 'number', min: 0, max: 10, step: 0.1, unit: 'mm' },
      { key: 'the slope of the peak exercise ST segment', label: 'Peak ST Slope', type: 'select', options: [{ v: 0, l: 'Upsloping' }, { v: 1, l: 'Flat' }, { v: 2, l: 'Downsloping' }] },
      { key: 'number of major vessels (0-3) colored by flourosopy', label: 'Fluoroscopy Vessels', type: 'select', options: [0, 1, 2, 3].map(v => ({ v, l: `${v}` })) },
      { key: 'thal', label: 'Thalassemia', type: 'select', options: [{ v: 0, l: 'Normal' }, { v: 1, l: 'Fixed Defect' }, { v: 2, l: 'Reversible Defect' }] },
    ],
  },
];

// Flat label map for modal display
const FIELD_LABELS: Partial<Record<keyof PredictionInput, string>> = {};
for (const g of GROUPS) {
  for (const f of g.fields) {
    FIELD_LABELS[f.key] = f.label;
  }
}

// Returns a human-readable value for select fields
function readableValue(key: keyof PredictionInput, val: number): string {
  for (const g of GROUPS) {
    for (const f of g.fields) {
      if (f.key === key && f.type === 'select') {
        const opt = f.options.find(o => o.v === val);
        return opt ? opt.l : String(val);
      }
    }
  }
  return String(val);
}

const NAMES_KEY = 'cardioscan_names';

function riskInfo(prob: number) {
  if (prob < 0.3)  return { label: 'Low Risk',      color: '#16a34a', lightColor: '#22c55e', bg: '#f0fdf4', border: '#d1fae5', barBg: '#dcfce7' };
  if (prob < 0.55) return { label: 'Moderate Risk', color: '#d97706', lightColor: '#f59e0b', bg: '#fffbeb', border: '#fde68a', barBg: '#fef3c7' };
  if (prob < 0.75) return { label: 'High Risk',     color: '#dc2626', lightColor: '#ef4444', bg: '#fef2f2', border: '#fecaca', barBg: '#fee2e2' };
  return                  { label: 'Critical Risk', color: '#991b1b', lightColor: '#dc2626', bg: '#fff1f1', border: '#fca5a5', barBg: '#fee2e2' };
}

export default function Home() {
  const [input, setInput] = useState<PredictionInput>(DEFAULT);
  const [patientName, setPatientName] = useState('');
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [localNames, setLocalNames] = useState<Record<string, string>>({});
  const [selectedRecord, setSelectedRecord] = useState<{ rec: HistoryRecord; name: string } | null>(null);

  useEffect(() => {
    getHistory().then(setHistory).catch(() => {});
    try {
      const stored = localStorage.getItem(NAMES_KEY);
      if (stored) setLocalNames(JSON.parse(stored));
    } catch {}
  }, []);

  const change = (key: keyof PredictionInput, val: string) =>
    setInput(p => ({ ...p, [key]: parseFloat(val) }));

  const submit = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await predict(input);
      setResult(res);
      const updatedHistory = await getHistory();
      setHistory(updatedHistory);
      // Associate patient name with the newest record's timestamp (client-side only)
      if (updatedHistory.length > 0) {
        const newest = updatedHistory[updatedHistory.length - 1];
        const newNames = { ...localNames, [newest.timestamp]: patientName.trim() };
        setLocalNames(newNames);
        try { localStorage.setItem(NAMES_KEY, JSON.stringify(newNames)); } catch {}
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setInput(DEFAULT); setResult(null); setError(null); setPatientName(''); };

  const closeModal = useCallback(() => setSelectedRecord(null), []);

  const info = result ? riskInfo(result.probability) : null;
  const pct = result ? Math.round(result.probability * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', flexDirection: 'column' }}>

      {/* ── Navbar ── */}
      <header style={{
        background: 'linear-gradient(135deg, #0d0b1f 0%, #1a1638 55%, #0e0c20 100%)',
        borderBottom: '1.5px solid rgba(231,76,76,0.28)',
        padding: '0 36px',
        height: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 4px 28px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.04)',
        position: 'relative',
      }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 13, position: 'relative' }}>
          {/* Logo mark */}
          <div style={{
            width: 42, height: 42, borderRadius: 13,
            background: 'linear-gradient(145deg, #ff7070, #e02d2d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 22px rgba(231,76,76,0.55), 0 4px 12px rgba(231,76,76,0.3)',
          }}>
            <svg viewBox="0 0 24 24" fill="white" style={{ width: 20, height: 20 }}>
              <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
            </svg>
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.03em' }}>CardioScan</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.42)', fontWeight: 500, marginTop: 1 }}>Heart Risk Predictor</div>
          </div>

          {/* Vertical divider */}
          <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.11)', margin: '0 4px' }} />

          {/* Decorative heartbeat line */}
          <svg viewBox="0 0 130 34" style={{ width: 96, height: 26, opacity: 0.55 }} aria-hidden>
            <polyline
              points="0,17 22,17 30,5 39,29 48,3 57,29 65,17 87,17 95,10 103,24 111,17 130,17"
              fill="none"
              stroke="#ff6b6b"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* ── Right: model info ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Model badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            padding: '7px 14px',
          }}>
            {/* Chip icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" style={{ width: 14, height: 14, flexShrink: 0 }}>
              <rect x="7" y="7" width="10" height="10" rx="1" />
              <path d="M7 9H5M7 12H5M7 15H5M17 9h2M17 12h2M17 15h2M9 7V5M12 7V5M15 7V5M9 17v2M12 17v2M15 17v2" strokeLinecap="round" />
            </svg>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.01em' }}>Random Forest</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>GridSearchCV · UCI Dataset</div>
            </div>
          </div>

          {/* Live dot */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(22,163,74,0.12)',
            border: '1px solid rgba(34,197,94,0.22)',
            borderRadius: 99,
            padding: '5px 11px',
          }}>
            <div className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Live</span>
          </div>
        </div>

      </header>

      {/* ── Page body ── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 372px',
        gap: 22,
        padding: '24px 28px',
        maxWidth: 1120,
        margin: '0 auto',
        width: '100%',
        alignItems: 'stretch',
      }}>

        {/* ══ LEFT: Form ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Heading */}
          <div className="card" style={{
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            // borderLeft: '3.5px solid #e74c4c',
          }}>
            {/* Icon */}
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: '#fff1f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg viewBox="0 0 24 24" fill="#e74c4c" style={{ width: 20, height: 20 }}>
                <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: '#111827', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                Risk Assessment
              </h1>
              <p style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 3, fontWeight: 500 }}>
                Fill in the patient&apos;s clinical parameters and click{' '}
                <span style={{
                  color: '#e74c4c',
                  fontWeight: 700,
                  background: '#fff1f1',
                  padding: '1px 7px',
                  borderRadius: 6,
                  border: '1px solid #fecaca',
                }}>Predict</span>.
              </p>
            </div>
          </div>

          {/* ── Patient Info card ── */}
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Patient Information</span>
              <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
              <span style={{ fontSize: 11, color: '#d1d5db', fontWeight: 500 }}>identification only</span>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Patient Name
                {/* <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginLeft: 6, fontSize: 10, fontWeight: 700,
                  color: '#16a34a', background: '#dcfce7',
                  padding: '2px 8px', borderRadius: 999,
                }}>optional</span> */}
              </label>
              <input
                type="text"
                placeholder="e.g. John Smith"
                value={patientName}
                onChange={e => setPatientName(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px',
                  border: '1.5px solid #e5e7eb', borderRadius: 9,
                  fontSize: 13, fontWeight: 500, color: '#111827',
                  outline: 'none', background: '#fafafa',
                  boxSizing: 'border-box', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = '#16a34a'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#fafafa'; }}
              />
              {/* <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 5, fontWeight: 500 }}>
                Stored locally for identification only — not sent to the prediction model.
              </p> */}
            </div>
          </div>

          {/* Field groups */}
          {GROUPS.map(group => (
            <div key={group.title} className="card" style={{ padding: 22 }}>
              {/* Group header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: group.dot,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: group.accent }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{group.title}</span>
                <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
                <span style={{ fontSize: 11, color: '#d1d5db', fontWeight: 500 }}>{group.fields.length} fields</span>
              </div>

              {/* Fields grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {group.fields.map(f => (
                  <div key={f.key}>
                    <label>
                      {f.label}
                      {'unit' in f && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          color: group.accent,
                          background: `${group.accent}20`,
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}>
                          {f.unit}
                        </span>
                      )}
                    </label>
                    {f.type === 'select' ? (
                      <div className="select-wrap">
                        <select value={input[f.key]} onChange={e => change(f.key, e.target.value)}>
                          {f.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                        </select>
                      </div>
                    ) : (
                      <input
                        type="number"
                        value={input[f.key]}
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        onChange={e => change(f.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn-predict" onClick={submit} disabled={loading}>
              {loading ? (
                <>
                  <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                  </svg>
                  Analyzing…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Predict
                </>
              )}
            </button>
            <button className="btn-reset" onClick={reset} disabled={loading}>Reset</button>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>
              {input.age} yrs · {input.sex === 1 ? 'Male' : 'Female'}
            </span>
          </div>
        </div>

        {/* ══ RIGHT: Result + History ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>

          {/* ── Result card ── */}
          <div
            className="card"
            style={{
              padding: 22,
              background: info ? info.bg : '#fff',
              borderColor: info ? info.border : '#e9eaec',
              // marginTop: 65,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>
              Prediction Result
            </div>

            {/* Idle state */}
            {!result && !error && !loading && (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px',
                }}>
                  <svg viewBox="0 0 24 24" fill="#d1d5db" style={{ width: 26, height: 26 }}>
                    <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
                  </svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af' }}>Awaiting Prediction</p>
                <p style={{ fontSize: 12, color: '#c4c9d4', marginTop: 4, fontWeight: 500 }}>Fill the form and click Predict</p>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ position: 'relative', width: 48, height: 48, margin: '0 auto 14px' }}>
                  <svg className="spin" viewBox="0 0 48 48" fill="none" style={{ width: 48, height: 48 }}>
                    <circle cx="24" cy="24" r="20" stroke="#f3f4f6" strokeWidth="4" />
                    <circle cx="24" cy="24" r="20" stroke="#e74c4c" strokeWidth="4" strokeDasharray="26 100" strokeLinecap="round" />
                  </svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>Analyzing…</p>
                <p style={{ fontSize: 12, color: '#c4c9d4', marginTop: 4, fontWeight: 500 }}>Running model</p>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" style={{ width: 15, height: 15, flexShrink: 0 }}>
                    <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>Connection Error</p>
                </div>
                <p style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.5 }}>{error}</p>
              </div>
            )}

            {/* Result */}
            {result && !loading && info && (
              <div className="fade-up">

                {/* Big score */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{
                    display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                    background: '#fff', borderRadius: 14,
                    border: `1.5px solid ${info.border}`,
                    padding: '16px 28px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    gap: 2,
                  }}>
                    <span style={{ fontSize: 44, fontWeight: 800, color: info.color, lineHeight: 1, letterSpacing: '-0.04em' }}>
                      {pct}<span style={{ fontSize: 20, fontWeight: 700 }}>%</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: info.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {info.label}
                    </span>
                  </div>
                </div>

                {/* Verdict */}
                <p style={{ fontSize: 16, fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: 6, letterSpacing: '-0.02em' }}>
                  {result.prediction === 1 ? 'Heart Disease Detected' : 'No Heart Disease'}
                </p>
                <p style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', marginBottom: 20, lineHeight: 1.6, fontWeight: 500 }}>
                  {result.prediction === 1
                    ? 'Risk factors suggest the presence of heart disease. Consult a cardiologist.'
                    : 'Parameters indicate low cardiac risk. Continue routine check-ups.'}
                </p>

                {/* Probability bar */}
                <div style={{ background: '#fff', border: `1px solid ${info.border}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Disease probability</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: info.color }}>{pct}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 99, background: info.barBg, overflow: 'hidden' }}>
                    <div
                      className="bar-grow"
                      style={{
                        height: '100%', borderRadius: 99,
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${info.lightColor}99, ${info.color})`,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                    <span style={{ fontSize: 10, color: '#c4c9d4', fontWeight: 600 }}>Healthy</span>
                    <span style={{ fontSize: 10, color: '#c4c9d4', fontWeight: 600 }}>At Risk</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── History card ── */}
          <div className="card" style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>History</span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#374151',
                background: '#f3f4f6', border: '1px solid #e5e7eb',
                padding: '2px 9px', borderRadius: 99,
              }}>
                {history.length}
              </span>
            </div>

            {history.length === 0 ? (
              <p style={{ fontSize: 13, color: '#c4c9d4', textAlign: 'center', padding: '14px 0', fontWeight: 500 }}>
                No predictions yet
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
                {history.slice().reverse().map((rec, i) => {
                  const r = riskInfo(rec.probability);
                  const p = Math.round(rec.probability * 100);
                  const name = localNames[rec.timestamp] || '';
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedRecord({ rec, name })}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 12px',
                        background: r.bg,
                        border: `1px solid ${r.border}`,
                        borderRadius: 10,
                        cursor: 'pointer',
                        transition: 'box-shadow 0.15s, transform 0.1s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.10)';
                        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                        (e.currentTarget as HTMLDivElement).style.transform = 'none';
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        {name && (
                          <p style={{
                            fontSize: 12.5, fontWeight: 700, color: '#111827',
                            marginBottom: 5, whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190,
                          }}>
                            {name}
                          </p>
                        )}
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, fontWeight: 700,
                          color: r.color,
                          background: `${r.color}18`,
                          border: `1px solid ${r.color}40`,
                          padding: '2px 8px 2px 6px',
                          borderRadius: 999,
                          marginBottom: 4,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                          {r.label}
                        </span>
                        <p style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 0, fontWeight: 500 }}>
                          {new Date(rec.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          {' · '}
                          {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: r.color }}>{p}%</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke={r.color} strokeWidth="2.5" style={{ width: 12, height: 12, opacity: 0.55 }}>
                          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ══ Detail Modal Overlay ══ */}
      {selectedRecord && (() => {
        const { rec, name } = selectedRecord;
        const r = riskInfo(rec.probability);
        const p = Math.round(rec.probability * 100);
        return (
          <div
            onClick={closeModal}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(13,11,31,0.72)',
              backdropFilter: 'blur(5px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000,
              padding: '20px 16px',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff',
                borderRadius: 18,
                width: '100%',
                maxWidth: 560,
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
                border: '1.5px solid #e9eaec',
                animation: 'modalIn 0.18s ease',
              }}
            >
              {/* Modal header */}
              <div style={{
                padding: '20px 24px 16px',
                borderBottom: '1px solid #f3f4f6',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                position: 'sticky', top: 0, background: '#fff', zIndex: 1,
                borderRadius: '18px 18px 0 0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: r.bg, border: `1.5px solid ${r.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg viewBox="0 0 24 24" fill={r.color} style={{ width: 20, height: 20 }}>
                      <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 17, fontWeight: 800, color: name ? '#111827' : '#9ca3af', letterSpacing: '-0.02em' }}>
                      {name || 'Unknown Patient'}
                    </p>
                    <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, fontWeight: 500 }}>
                      {new Date(rec.timestamp).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                      {' · '}
                      {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: '#f3f4f6', border: '1px solid #e5e7eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#e5e7eb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#f3f4f6')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div style={{ padding: '20px 24px 28px' }}>

                {/* Result banner */}
                <div style={{
                  background: r.bg, border: `1.5px solid ${r.border}`,
                  borderRadius: 14, padding: '16px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 16,
                }}>
                  <div>
                    <p style={{ fontSize: 18, fontWeight: 800, color: r.color, letterSpacing: '-0.02em' }}>{r.label}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 3 }}>
                      {rec.prediction === 1 ? 'Heart Disease Detected' : 'No Heart Disease'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 36, fontWeight: 800, color: r.color, lineHeight: 1, letterSpacing: '-0.04em' }}>
                      {p}<span style={{ fontSize: 16, fontWeight: 700 }}>%</span>
                    </p>
                    <p style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>probability</p>
                  </div>
                </div>

                {/* Probability bar */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ height: 8, borderRadius: 99, background: r.barBg, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99, width: `${p}%`,
                      background: `linear-gradient(90deg, ${r.lightColor}99, ${r.color})`,
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                    <span style={{ fontSize: 10, color: '#c4c9d4', fontWeight: 600 }}>Healthy</span>
                    <span style={{ fontSize: 10, color: '#c4c9d4', fontWeight: 600 }}>At Risk</span>
                  </div>
                </div>

                {/* Clinical parameters grouped */}
                {GROUPS.map(group => (
                  <div key={group.title} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: group.dot,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: group.accent }} />
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#374151' }}>{group.title}</span>
                      <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                      {group.fields.map(f => (
                        <div key={f.key} style={{
                          background: '#fafafa', border: '1px solid #f3f4f6',
                          borderRadius: 9, padding: '9px 12px',
                        }}>
                          <p style={{ fontSize: 10.5, fontWeight: 600, color: '#9ca3af', marginBottom: 3 }}>
                            {FIELD_LABELS[f.key] ?? f.key}
                          </p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                            {readableValue(f.key, rec.input[f.key])}
                            {'unit' in f && (
                              <span style={{ fontSize: 10.5, fontWeight: 600, color: group.accent, marginLeft: 4 }}>{f.unit}</span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* ── Footer ── */}
      <footer style={{
        background: 'linear-gradient(135deg, #0d0b1f 0%, #1a1638 55%, #0e0c20 100%)',
        borderTop: '1.5px solid rgba(231,76,76,0.28)',
        padding: '0 36px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
      }}>
        {/* Left: brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg viewBox="0 0 24 24" fill="rgba(231,76,76,0.7)" style={{ width: 12, height: 12 }}>
            <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.01em' }}>CardioScan</span>
        </div>

        {/* Center: model info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {['Random Forest', 'GridSearchCV', 'UCI Cleveland Dataset'].map((tag, i) => (
            <span key={i} style={{
              fontSize: 10.5, fontWeight: 600,
              color: 'rgba(255,255,255,0.28)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              {i > 0 && <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'inline-block' }} />}
              {tag}
            </span>
          ))}
        </div>

        {/* Right: note */}
        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.22)', fontWeight: 500 }}>
          For educational use only
        </span>
      </footer>
    </div>
  );
}
