import { NextResponse } from 'next/server';
import { globalGraph } from '@/lib/graph';
import { generateGlobalSummary, generateOverSummary } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  await globalGraph.ensureLoaded();
  try {
    const body = await req.json().catch(() => ({}));
    const { nodeId, clientNodes, clientEdges } = body;

    const allNodes = (Array.isArray(clientNodes) && clientNodes.length > 0)
      ? clientNodes
      : globalGraph.nodes;
    const allEdges = (Array.isArray(clientEdges) && clientEdges.length > 0)
      ? clientEdges
      : globalGraph.edges;

    // 1. SPECIFIC NODE CHAIN / LINKED SYSTEM OVER-SUMMARY
    if (nodeId) {
      const rootNode = allNodes.find((n: any) => n.id === nodeId);
      if (!rootNode) {
        return NextResponse.json({ error: 'Node not found' }, { status: 404 });
      }

      // Find all connected edges for this node (both incoming and outgoing)
      const connectedEdges = allEdges.filter(
        (e: any) => e.sourceId === nodeId || e.targetId === nodeId
      );

      if (connectedEdges.length === 0) {
        return NextResponse.json({
          overSummary: null,
          connectedCount: 0,
          message: "No connections found for this node."
        });
      }

      // Collect 1-hop and 2-hop connected nodes to capture the link system
      const visitedIds = new Set<string>([nodeId]);
      const queue = [nodeId];
      let depth = 0;

      while (queue.length > 0 && depth < 2) {
        const current = queue.shift()!;
        const neighbors = allEdges
          .filter((e: any) => e.sourceId === current || e.targetId === current)
          .map((e: any) => e.sourceId === current ? e.targetId : e.sourceId);

        for (const nId of neighbors) {
          if (!visitedIds.has(nId)) {
            visitedIds.add(nId);
            queue.push(nId);
          }
        }
        depth++;
      }

      const clusterNodes = allNodes.filter((n: any) => visitedIds.has(n.id));

      // Build structured text snippets for AI synthesis
      const snippets = clusterNodes.map((n: any) => {
        const title = n.canonicalName || 'Concept';
        const overview = n.structuredSummary?.overview || n.summary || '';
        const points = (n.structuredSummary?.keyTakeaways || []).join('; ');
        return `### ${title}\nOverview: ${overview}\nKey Points: ${points}`;
      });

      let aiSummary = "";
      try {
        aiSummary = await generateOverSummary(snippets);
      } catch (err) {
        console.error("AI overSummary failed:", err);
      }

      // Fallback if AI returned generic/empty
      if (!aiSummary || aiSummary.includes("Overview generated locally") || aiSummary.length < 20) {
        const otherNodes = clusterNodes.filter((n: any) => n.id !== nodeId);
        const otherTitles = otherNodes.map((n: any) => n.canonicalName).join(', ');
        
        const keyPointsList = clusterNodes.flatMap((n: any) => 
          (n.structuredSummary?.keyTakeaways || []).slice(0, 2)
        );

        aiSummary = `**${rootNode.canonicalName}** forms a central link system with **${otherTitles}**.\n\n` +
          `Across these ${clusterNodes.length} interconnected concepts, the link system establishes key relationships:\n\n` +
          clusterNodes.map((n: any) => `• **${n.canonicalName}**: ${n.structuredSummary?.overview || 'Fundamental concept in this knowledge cluster.'}`).join('\n\n') +
          (keyPointsList.length > 0 ? `\n\n**Key Synthesized Takeaways:**\n` + keyPointsList.map((pt: string) => `• ${pt}`).join('\n') : '');
      }

      return NextResponse.json({
        overSummary: aiSummary,
        connectedCount: connectedEdges.length,
        clusterCount: clusterNodes.length,
        clusterTitles: clusterNodes.map((n: any) => n.canonicalName)
      });
    }

    // 2. GLOBAL GRAPH OVER-SUMMARY
    const validNodes = allNodes.filter((n: any) => n.structuredSummary || n.semanticProfile);
    if (validNodes.length === 0) {
      return NextResponse.json({
        overview: "No knowledge captured yet. Capture webpages or videos to start building your knowledge base.",
        majorTopics: [],
        commonConcepts: [],
        sourceCount: allNodes.length
      });
    }

    const payload = {
      sources: validNodes.map((n: any) => ({
        title: n.canonicalName,
        summary: n.structuredSummary?.overview || "",
        concepts: n.semanticProfile?.concepts || []
      }))
    };

    const newGlobalSummary = await generateGlobalSummary(payload);
    newGlobalSummary.sourceCount = allNodes.length;

    return NextResponse.json(newGlobalSummary);
  } catch (error: any) {
    console.error("API /oversummary Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
