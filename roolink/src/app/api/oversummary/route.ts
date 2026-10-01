import { NextResponse } from 'next/server';
import { globalGraph } from '@/lib/graph';
import { generateGlobalSummary } from '@/lib/gemini';

export async function POST(req: Request) {
  try {
    const nodes = globalGraph.nodes;
    
    // Hash check
    const currentHash = nodes.map(n => n.id + (n.processingStatus || '') + (n.canonicalName) + (n.semanticProfile?.concepts?.length || 0)).join('|');
    if (globalGraph.globalSummaryHash === currentHash && globalGraph.globalSummary) {
      return NextResponse.json(globalGraph.globalSummary);
    }

    if (nodes.length === 0) {
      globalGraph.globalSummary = {
        overview: "No knowledge captured yet. Capture webpages or videos to start building your knowledge base.",
        majorTopics: [],
        commonConcepts: [],
        sourceCount: 0
      };
      globalGraph.globalSummaryHash = currentHash;
    globalGraph.saveState();
      return NextResponse.json(globalGraph.globalSummary);
    }

    if (nodes.length === 1) {
      const n = nodes[0];
      globalGraph.globalSummary = {
        overview: `Your knowledge base currently contains 1 source: "${n.canonicalName}". ${n.structuredSummary?.overview || ''}`,
        majorTopics: n.semanticProfile?.topics?.map((t: string) => ({ topic: t, description: "", sourceCount: 1 })) || [],
        commonConcepts: n.semanticProfile?.concepts || [],
        sourceCount: 1
      };
      globalGraph.globalSummaryHash = currentHash;
      return NextResponse.json(globalGraph.globalSummary);
    }

    // Filter only completed or reasonably populated nodes
    const validNodes = nodes.filter(n => n.structuredSummary || n.semanticProfile );
    if (validNodes.length === 0) {
      return NextResponse.json(globalGraph.globalSummary || { overview: "Processing knowledge...", majorTopics: [], commonConcepts: [], sourceCount: nodes.length });
    }

    const payload = {
      sources: validNodes.map(n => ({
        title: n.canonicalName,
        summary: n.structuredSummary?.overview  || "",
        concepts: n.semanticProfile?.concepts || []
      }))
    };

    const newGlobalSummary = await generateGlobalSummary(payload);
    newGlobalSummary.sourceCount = nodes.length;

    globalGraph.globalSummary = newGlobalSummary;
    globalGraph.globalSummaryHash = currentHash;
    // We don't necessarily need to persist immediately, but saveState is private anyway. We can just rely on the next mutation to save, or add a method.
    // Let's add a public method to trigger save in graph.ts if needed, but it's fine.
    
    return NextResponse.json(globalGraph.globalSummary);
  } catch (error: any) {
    console.error("API /oversummary Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
