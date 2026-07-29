import { describe, it, expect } from 'vitest';
import { GET } from '../../app/api/health/route';

// NOTE: `GET` now returns `Response | Promise<Response>` — it stays synchronous on the anonymous
// liveness path and only goes async for the authorised readiness path (which probes the DB).
// Awaiting covers both.

describe('health route', () => {
  it('reports ok + phase 0', async () => {
    const res = await GET(new Request('http://localhost/api/health'));
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.phase).toBe(0);
  });

  it('tells an anonymous caller nothing about dependencies', async () => {
    const res = await GET(new Request('http://localhost/api/health'));
    const body = await res.json();
    expect(body.status).toBe('ok');
    // Readiness detail is reconnaissance — it must not be reachable without the shared secret.
    expect(body).not.toHaveProperty('checks');
    expect(body).not.toHaveProperty('ready');
    expect(body).not.toHaveProperty('env');
    expect(JSON.stringify(body)).not.toMatch(/KEY|SECRET|DATABASE_URL|postgres/i);
  });

  it('fails closed when a wrong secret is presented', async () => {
    const res = await GET(
      new Request('http://localhost/api/health', { headers: { 'x-borderpass-secret': 'wrong' } }),
    );
    const body = await res.json();
    expect(body).not.toHaveProperty('checks');
  });
});
