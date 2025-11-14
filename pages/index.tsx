import { useCallback, useMemo, useState } from 'react';

type StatsResponse = {
  data: Record<string, unknown>;
  source: string;
  meta?: Record<string, unknown>;
  degraded?: boolean;
};

export default function HomePage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stats/get');
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Request failed with ${res.status}`);
      }
      const payload: StatsResponse = await res.json();
      setStats(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleExport = useCallback(() => {
    if (!stats) return;
    const blob = new Blob([JSON.stringify(stats, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `stats-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [stats]);

  const statusLabel = useMemo(() => {
    if (!stats) return 'Idle';
    if (stats.degraded) return 'Degraded';
    return stats.source ? stats.source.toUpperCase() : 'Unknown';
  }, [stats]);

  return (
    <main className="page">
      <section className="card">
        <header>
          <div>
            <p className="eyebrow">Cache-backed Stats</p>
            <h1>Fetch the latest metrics snapshot</h1>
            <p className="muted">
              Data is served from Redis-backed cache with optimistic locking and stampede protection.
            </p>
          </div>
          <span className={`status ${stats ? 'active' : ''}`}>{statusLabel}</span>
        </header>
        <div className="actions">
          <button type="button" onClick={handleFetch} disabled={loading}>
            {loading ? 'Refreshing…' : 'Fetch stats'}
          </button>
          <button type="button" onClick={handleExport} disabled={!stats}>
            Export JSON
          </button>
        </div>
        {error && (
          <div className="error">
            <strong>Request failed</strong>
            <span>{error}</span>
          </div>
        )}
        {stats && (
          <pre className="payload">
            <code>{JSON.stringify(stats, null, 2)}</code>
          </pre>
        )}
        {!stats && !error && !loading && (
          <p className="placeholder">Trigger a request to see cached data.</p>
        )}
      </section>
      <style jsx>{`
        .page {
          width: 100%;
          max-width: 960px;
          margin: 0 auto;
          padding: 4rem 1.5rem;
        }
        .card {
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 24px;
          padding: 2.5rem;
          backdrop-filter: blur(16px);
          box-shadow: 0 25px 100px rgba(15, 23, 42, 0.45);
        }
        header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.3em;
          font-size: 0.75rem;
          margin: 0 0 0.5rem;
          color: #38bdf8;
        }
        h1 {
          margin: 0;
          font-size: clamp(1.75rem, 4vw, 2.75rem);
          color: #f8fafc;
        }
        .muted {
          color: #cbd5f5;
          margin-top: 0.5rem;
        }
        .status {
          padding: 0.4rem 0.9rem;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.4);
          font-size: 0.85rem;
        }
        .status.active {
          border-color: #4ade80;
          color: #4ade80;
        }
        .actions {
          display: flex;
          gap: 1rem;
          margin: 2rem 0 1rem;
        }
        button {
          flex: 1;
          padding: 0.95rem 1.5rem;
          border-radius: 999px;
          border: none;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        button:first-of-type {
          background: linear-gradient(135deg, #2563eb, #9333ea);
          color: white;
          box-shadow: 0 15px 30px rgba(79, 70, 229, 0.35);
        }
        button:last-of-type {
          background: rgba(148, 163, 184, 0.2);
          color: #e2e8f0;
          border: 1px solid rgba(148, 163, 184, 0.2);
        }
        .error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.4);
          border-radius: 12px;
          padding: 1rem 1.25rem;
          color: #fecaca;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin: 1rem 0;
        }
        .payload {
          background: rgba(15, 23, 42, 0.8);
          border-radius: 18px;
          padding: 1.5rem;
          color: #e2e8f0;
          font-size: 0.9rem;
          max-height: 320px;
          overflow: auto;
          border: 1px solid rgba(148, 163, 184, 0.2);
        }
        .placeholder {
          color: rgba(226, 232, 240, 0.75);
        }
        @media (max-width: 640px) {
          header {
            flex-direction: column;
          }
          .actions {
            flex-direction: column;
          }
          .card {
            padding: 1.5rem;
          }
        }
      `}</style>
    </main>
  );
}

