'use client';

import { useState, useEffect } from 'react';
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

function riskInfo(prob: number) {
  if (prob < 0.3)  return { label: 'Low Risk',      color: '#16a34a', lightColor: '#22c55e', bg: '#f0fdf4', border: '#d1fae5', barBg: '#dcfce7' };
  if (prob < 0.55) return { label: 'Moderate Risk', color: '#d97706', lightColor: '#f59e0b', bg: '#fffbeb', border: '#fde68a', barBg: '#fef3c7' };
  if (prob < 0.75) return { label: 'High Risk',     color: '#dc2626', lightColor: '#ef4444', bg: '#fef2f2', border: '#fecaca', barBg: '#fee2e2' };
  return                  { label: 'Critical Risk', color: '#991b1b', lightColor: '#dc2626', bg: '#fff1f1', border: '#fca5a5', barBg: '#fee2e2' };
}

export default function Home() {
  const [input, setInput] = useState<PredictionInput>(DEFAULT);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    getHistory().then(setHistory).catch(() => {});
  }, []);

  const change = (key: keyof PredictionInput, val: string) =>
    setInput(p => ({ ...p, [key]: parseFloat(val) }));

  const submit = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await predict(input);
      setResult(res);
      getHistory().then(setHistory).catch(() => {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setInput(DEFAULT); setResult(null); setError(null); };

  const info = result ? riskInfo(result.probability) : null;
  const pct = result ? Math.round(result.probability * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', flexDirection: 'column' }}>

      {/* ── Navbar ── */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #e9eaec',
        padding: '0 32px',
        height: 58,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Logo mark */}
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #ff6b6b, #e74c4c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(231,76,76,0.3)',
          }}>
            <svg viewBox="0 0 24 24" fill="white" style={{ width: 17, height: 17 }}>
              <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#111827', letterSpacing: '-0.02em' }}>CardioScan</div>
            <div style={{ fontSize: 10.5, color: '#9ca3af', fontWeight: 500, marginTop: -1 }}>Heart Risk Predictor</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>API Connected</span>
        </div>
      </header>

      {/* ── Page body ── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 310px',
        gap: 22,
        padding: '24px 28px',
        maxWidth: 1120,
        margin: '0 auto',
        width: '100%',
        alignItems: 'start',
      }}>

        {/* ══ LEFT: Form ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Heading */}
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: '-0.03em' }}>
              Risk Assessment
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 5, fontWeight: 500 }}>
              Fill in the patient&apos;s clinical parameters and click <strong style={{ color: '#374151' }}>Predict</strong>.
            </p>
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
                          display: 'inline-block', marginLeft: 6,
                          fontSize: 10, fontWeight: 600, color: '#fff',
                          background: group.accent,
                          padding: '1px 6px', borderRadius: 99,
                          opacity: 0.8,
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Result card ── */}
          <div
            className="card"
            style={{
              padding: 22,
              background: info ? info.bg : '#fff',
              borderColor: info ? info.border : '#e9eaec',
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
          <div className="card" style={{ padding: 20 }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                {history.slice().reverse().map((rec, i) => {
                  const r = riskInfo(rec.probability);
                  const p = Math.round(rec.probability * 100);
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 12px',
                      background: r.bg,
                      border: `1px solid ${r.border}`,
                      borderRadius: 10,
                    }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.label}</p>
                        <p style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 2, fontWeight: 500 }}>
                          {new Date(rec.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          {' · '}
                          {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 800, color: r.color }}>{p}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Disclaimer ── */}
          <div style={{
            background: '#fff',
            border: '1.5px solid #e9eaec',
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" style={{ width: 14, height: 14 }}>
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 3 }}>Disclaimer</p>
              <p style={{ fontSize: 11, color: '#78350f', lineHeight: 1.65, fontWeight: 500 }}>
                For educational use only. Not a substitute for professional medical advice. Always consult a qualified doctor.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ textAlign: 'center', padding: '14px 0', borderTop: '1px solid #e9eaec', background: '#fff' }}>
        <p style={{ fontSize: 11, color: '#c4c9d4', fontWeight: 500 }}>
          Random Forest · GridSearchCV · UCI Cleveland Heart Disease Dataset
        </p>
      </footer>
    </div>
  );
}
