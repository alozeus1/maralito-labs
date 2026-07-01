import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    app: 'borderpass',
    status: 'ok',
    phase: 0,
    ts: new Date().toISOString(),
  });
}
