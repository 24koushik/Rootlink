import { NextResponse } from 'next/server';
import { globalGraph } from '@/lib/graph';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  await globalGraph.ensureLoaded();
  try {
    const body = await req.json();
    const { sourceId, targetId, clientNodes } = body;

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'Missing sourceId or targetId' }, { status: 400 });
    }

    // If serverless container has empty memory, seed from client state
    if (globalGraph.nodes.length === 0 && Array.isArray(clientNodes) && clientNodes.length > 0) {
      globalGraph.nodes = clientNodes;
    }

    await globalGraph.linkNodesManually(sourceId, targetId);

    // Return the updated graph data
    return NextResponse.json(globalGraph.getGraphData());
  } catch (error: any) {
    console.error("API /link Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  await globalGraph.ensureLoaded();
  try {
    const body = await req.json();
    const { sourceId, targetId } = body;

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'Missing sourceId or targetId' }, { status: 400 });
    }

    await globalGraph.removeLink(sourceId, targetId);

    // Return the updated graph data
    return NextResponse.json(globalGraph.getGraphData());
  } catch (error: any) {
    console.error("API /link DELETE Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
