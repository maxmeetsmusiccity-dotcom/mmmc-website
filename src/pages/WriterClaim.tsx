import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

/**
 * /claim/:pg_id/:token
 *
 * Writer-claim confirmation route. On mount, calls GET /api/claim/verify to
 * server-verify the HMAC token + single-use status, then renders a confirm
 * form. Submitting POSTs to /api/claim/submit.
 *
 * All HMAC verification happens server-side; this component only reflects
 * the server's verdict.
 */

type VerifyOk = {
  ok: true;
  pg_id: string;
  expires_at: string;
  writer_context: {
    artist_name: string;
    current_instagram_handle: string | null;
    spotify_artist_id: string | null;
  };
};

type VerifyErr = {
  ok?: false;
  error: string;
  reason?: string;
  used_at?: string;
};

type UiState =
  | { kind: 'loading' }
  | { kind: 'error'; error: string; reason?: string; status: number; used_at?: string }
  | { kind: 'ready'; verified: VerifyOk }
  | { kind: 'submitting'; verified: VerifyOk }
  | { kind: 'done'; submission_id: string; submitted_at: string };

export default function WriterClaim() {
  const { pg_id: pg_id_raw, token: token_raw } = useParams();
  const pg_id = pg_id_raw || '';
  const token = token_raw || '';

  const [state, setState] = useState<UiState>({ kind: 'loading' });
  const [confirmedHandle, setConfirmedHandle] = useState('');
  const [correctedHandle, setCorrectedHandle] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!pg_id || !token) {
      setState({ kind: 'error', error: 'Missing pg_id or token', status: 400 });
      return;
    }
    void (async () => {
      try {
        const params = new URLSearchParams({ pg_id, token });
        const resp = await fetch(`/api/claim/verify?${params.toString()}`);
        const body = (await resp.json()) as VerifyOk | VerifyErr;
        if (resp.ok && 'ok' in body && body.ok) {
          setState({ kind: 'ready', verified: body });
          setConfirmedHandle(body.writer_context.current_instagram_handle || '');
        } else {
          const err = body as VerifyErr;
          setState({
            kind: 'error',
            error: err.error || 'Verification failed',
            reason: err.reason,
            used_at: err.used_at,
            status: resp.status,
          });
        }
      } catch (e) {
        setState({
          kind: 'error',
          error: `Network error: ${e instanceof Error ? e.message : 'unknown'}`,
          status: 0,
        });
      }
    })();
  }, [pg_id, token]);

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    if (state.kind !== 'ready') return;
    if (!confirmedHandle.trim()) return;
    setState({ kind: 'submitting', verified: state.verified });
    try {
      const resp = await fetch('/api/claim/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pg_id,
          token,
          confirmed_instagram_handle: confirmedHandle.trim(),
          corrected_instagram_handle: correctedHandle.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const body = await resp.json();
      if (resp.ok) {
        setState({
          kind: 'done',
          submission_id: body.submission_id,
          submitted_at: body.submitted_at,
        });
      } else {
        setState({
          kind: 'error',
          error: body.error || 'Submit failed',
          reason: body.reason,
          status: resp.status,
        });
      }
    } catch (e) {
      setState({
        kind: 'error',
        error: `Network error: ${e instanceof Error ? e.message : 'unknown'}`,
        status: 0,
      });
    }
  };

  return (
    <div
      data-testid="claim-page"
      style={{
        maxWidth: 560,
        margin: '48px auto',
        padding: '0 20px',
        fontFamily: '-apple-system, "DM Sans", sans-serif',
        color: '#111',
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, color: '#0F1B33' }}>Confirm your MMMC writer profile</h1>
        <p style={{ color: '#666', marginTop: 4 }}>
          Max reaches out directly — this link is single-use and expires in 7 days.
        </p>
      </header>

      {state.kind === 'loading' && (
        <p data-testid="claim-loading">Verifying link…</p>
      )}

      {state.kind === 'error' && (
        <div
          data-testid="claim-error"
          style={{
            padding: 20,
            background: '#fdecea',
            border: '1px solid #f5c6c3',
            borderRadius: 6,
          }}
        >
          <strong>{state.error}</strong>
          {state.reason && (
            <p style={{ margin: '8px 0 0' }}>Reason: <code>{state.reason}</code></p>
          )}
          {state.used_at && (
            <p style={{ margin: '8px 0 0' }}>
              This link was already used on {new Date(state.used_at).toLocaleString()}.
            </p>
          )}
        </div>
      )}

      {(state.kind === 'ready' || state.kind === 'submitting') && (
        <form data-testid="claim-form" onSubmit={handleSubmit}>
          <p>
            <strong>Name we have on file:</strong>{' '}
            <span data-testid="claim-artist-name">
              {state.verified.writer_context.artist_name || '(no name on file)'}
            </span>
          </p>
          <p>
            <strong>Instagram handle we have:</strong>{' '}
            <code data-testid="claim-current-handle">
              {state.verified.writer_context.current_instagram_handle || '(no handle on file)'}
            </code>
          </p>
          <label
            style={{ display: 'block', marginTop: 16, fontWeight: 600 }}
            htmlFor="confirmed_handle"
          >
            Confirm your IG handle (paste it exactly):
          </label>
          <input
            id="confirmed_handle"
            data-testid="claim-confirmed-handle"
            type="text"
            value={confirmedHandle}
            onChange={(e) => setConfirmedHandle(e.target.value)}
            placeholder="@yourhandle"
            required
            style={{
              display: 'block',
              width: '100%',
              padding: 10,
              marginTop: 4,
              borderRadius: 4,
              border: '1px solid #ccc',
            }}
          />

          <label
            style={{ display: 'block', marginTop: 16, fontWeight: 600 }}
            htmlFor="corrected_handle"
          >
            If your handle is different, correct it here (optional):
          </label>
          <input
            id="corrected_handle"
            data-testid="claim-corrected-handle"
            type="text"
            value={correctedHandle}
            onChange={(e) => setCorrectedHandle(e.target.value)}
            placeholder="@different_handle"
            style={{
              display: 'block',
              width: '100%',
              padding: 10,
              marginTop: 4,
              borderRadius: 4,
              border: '1px solid #ccc',
            }}
          />

          <label
            style={{ display: 'block', marginTop: 16, fontWeight: 600 }}
            htmlFor="notes"
          >
            Anything else? (optional)
          </label>
          <textarea
            id="notes"
            data-testid="claim-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{
              display: 'block',
              width: '100%',
              padding: 10,
              marginTop: 4,
              borderRadius: 4,
              border: '1px solid #ccc',
              fontFamily: 'inherit',
            }}
          />

          <button
            data-testid="claim-submit"
            type="submit"
            disabled={state.kind === 'submitting' || !confirmedHandle.trim()}
            style={{
              marginTop: 24,
              padding: '12px 28px',
              background: '#3EE6C3',
              color: '#0F1B33',
              border: 'none',
              borderRadius: 4,
              fontWeight: 700,
              fontSize: 16,
              cursor: state.kind === 'submitting' ? 'wait' : 'pointer',
            }}
          >
            {state.kind === 'submitting' ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      )}

      {state.kind === 'done' && (
        <div
          data-testid="claim-done"
          style={{
            padding: 20,
            background: '#eaf8ee',
            border: '1px solid #c3e6cb',
            borderRadius: 6,
          }}
        >
          <strong>Thanks — submission received.</strong>
          <p style={{ margin: '8px 0 0', color: '#555' }}>
            Submission ID: <code>{state.submission_id}</code>
            <br />
            Submitted at: {new Date(state.submitted_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
