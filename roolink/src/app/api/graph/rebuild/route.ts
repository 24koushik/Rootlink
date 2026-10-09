import { NextResponse } from 'next/server';
import { globalGraph } from '@/lib/graph';

export const dynamic = 'force-dynamic';

export async function POST() {
  await globalGraph.ensureLoaded();
  try {
    globalGraph.recalculateAutomaticLinks();
    return NextResponse.json(globalGraph.getGraphData());
  } catch (error: any) {
    console.error("API /graph/rebuild Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
