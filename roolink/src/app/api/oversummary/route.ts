import { NextResponse } from 'next/server';
import { globalGraph } from '@/lib/graph';
import { generateOverSummary } from '@/lib/gemini';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nodeId } = body;

    if (!nodeId) {
      return NextResponse.json({ error: 'Missing nodeId' }, { status: 400 });
    }

    const summaries = globalGraph.getChainSummaries(nodeId);
    
    if (summaries.length === 0) {
      return NextResponse.json({ overSummary: "No data available." });
    }

    // Call Gemini to synthesize
    const overSummary = await generateOverSummary(summaries);

    return NextResponse.json({ overSummary });
  } catch (error: any) {
    console.error("API /oversummary Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
