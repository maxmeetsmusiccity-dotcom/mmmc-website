import { useState } from 'react';

const STEPS = [
  { title: 'Select Your Source', desc: 'Choose Nashville releases or paste artist names to scan for new music this week.' },
  { title: 'Pick Your Tracks', desc: 'Click releases to add them to your carousel. Star one as the featured cover artist.' },
  { title: 'Choose Templates', desc: 'Pick a grid style and title slide template. Click the pencil icon to customize any template.' },
  { title: 'Generate Carousel', desc: 'Hit Generate to create your slides. Drag thumbnails to reorder. Download individual slides or ZIP all.' },
  { title: 'Share', desc: 'Download your carousel PNGs and post to Instagram. Use the Tags section for hashtags and captions.' },
];

export default function Onboarding() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('nmf_onboarding_done') === '1'; } catch { return false; }
  });
  const [step, setStep] = useState(0);

  if (dismissed) return null;

  const finish = () => {
    setDismissed(true);
    try { localStorage.setItem('nmf_onboarding_done', '1'); } catch {}
  };

  return (
    <>
      <div onClick={finish}
        style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 601, background: 'var(--midnight-raised)', border: '2px solid var(--gold-dark)',
        borderRadius: 16, padding: '32px 28px', width: 'min(420px, 90vw)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
      }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: step === i ? 24 : 8, height: 6, borderRadius: 3,
              background: i <= step ? 'var(--gold)' : 'var(--midnight-border)',
              transition: 'all 0.2s',
            }} />
          ))}
        </div>

        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', color: 'var(--gold)', marginBottom: 12, textAlign: 'center' }}>
          {STEPS[step].title}
        </h3>
        <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>
          {STEPS[step].desc}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={finish}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button className="btn btn-sm" onClick={() => setStep(step - 1)}>Back</button>
            )}
            {step < STEPS.length - 1 ? (
              <button className="btn btn-sm btn-gold" onClick={() => setStep(step + 1)}>Next</button>
            ) : (
              <button className="btn btn-sm btn-gold" onClick={finish}>Get Started</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
