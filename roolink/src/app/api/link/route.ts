import { NextResponse } from 'next/server';
import { globalGraph } from '@/lib/graph';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sourceId, targetId } = body;

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'Missing sourceId or targetId' }, { status: 400 });
    }

    globalGraph.linkNodesManually(sourceId, targetId);

    // Return the updated graph data
    return NextResponse.json(globalGraph.getGraphData());
  } catch (error: any) {
    console.error("API /link Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { sourceId, targetId } = body;

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'Missing sourceId or targetId' }, { status: 400 });
    }

    globalGraph.removeLink(sourceId, targetId);

    // Return the updated graph data
    return NextResponse.json(globalGraph.getGraphData());
  } catch (error: any) {
    console.error("API /link DELETE Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
