import { describe, it, expect } from 'vitest';
import { GET } from '../../app/api/health/route';

describe('health route', () => {
  it('reports ok + phase 0', async () => {
    const res = GET();
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.phase).toBe(0);
  });
});
