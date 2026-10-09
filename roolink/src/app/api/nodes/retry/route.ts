import { NextResponse } from 'next/server';
import { globalGraph } from '@/lib/graph';
import { extractGraphData, extractVideoGraphData } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  await globalGraph.ensureLoaded();
  try {
    const { nodeId } = await request.json();
    if (!nodeId) return NextResponse.json({ success: false, error: 'Missing nodeId' }, { status: 400 });

    const node = globalGraph.nodes.find((n: any) => n.id === nodeId);
    if (!node) return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });

    // Set to processing immediately
    node.processingStatus = 'processing';
    globalGraph.updateNode(node.id, node);

        // Foreground process
    try {
      const isYouTube = node.type === 'youtube_video';
      const textContent = node.sourceReferences?.[0]?.contextSnippet || node.canonicalName;
      
      let res: any;
      if (isYouTube) {
        res = await extractVideoGraphData([{text: textContent, startSeconds: 0}], node.formulas || [], node.workedProblems || []);
      } else {
        res = await extractGraphData(textContent, node.formulas || [], node.workedProblems || []);
      }

      if (res && res.structuredSummary) {
        node.structuredSummary = res.structuredSummary;
        node.mindMap = res.mindMap;
        if (res.semanticProfile) node.semanticProfile = res.semanticProfile;
        node.processingStatus = 'completed';
        if (isYouTube) node.keyMoments = res.keyMoments;
        
        globalGraph.addScrapedDataToGraph(node, []);
        globalGraph.recalculateAutomaticLinks();
      } else {
        node.processingStatus = 'failed';
        globalGraph.updateNode(node.id, node);
      }
    } catch (err) {
      node.processingStatus = 'failed';
      globalGraph.updateNode(node.id, node);
    }

    return NextResponse.json({ success: true, status: 'completed' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
