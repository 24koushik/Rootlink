import { NextResponse } from 'next/server';
import { globalGraph, TrustNode } from '@/lib/graph';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  await globalGraph.ensureLoaded();
  try {
    const data = await req.json();
    globalGraph.nodes.push(...data.nodes);
    globalGraph.recalculateAutomaticLinks();
    return NextResponse.json(globalGraph.getGraphData());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
