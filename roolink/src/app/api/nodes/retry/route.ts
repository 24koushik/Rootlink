import { NextResponse } from 'next/server';
import { globalGraph } from '@/lib/graph';
import { extractGraphData, extractVideoGraphData } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { nodeId } = await request.json();
    if (!nodeId) return NextResponse.json({ success: false, error: 'Missing nodeId' }, { status: 400 });

    const node = globalGraph.nodes.find((n: any) => n.id === nodeId);
    if (!node) return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });

    // Set to processing immediately
    node.processingStatus = 'processing';
    globalGraph.updateNode(node.id, node);

    // Background process
    (async () => {
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
           
           // Process entities
           const extractedEntities = (res.entities || []).map((e: any) => ({
             canonicalName: e.canonicalName, type: e.type, trustScore: e.trustScore, sourceUrl: node.sourceUrl, videoId: node.videoId,
             sourceReferences: [{ url: node.sourceUrl || '', contextSnippet: 'Extracted mention', timestamp: Date.now() }]
           }));
           globalGraph.addScrapedDataToGraph(node, extractedEntities);
           globalGraph.recalculateAutomaticLinks();
         } else {
           node.processingStatus = 'failed';
           globalGraph.updateNode(node.id, node);
         }
       } catch (err) {
         node.processingStatus = 'failed';
         globalGraph.updateNode(node.id, node);
       }
    })();

    return NextResponse.json({ success: true, processingStatus: 'processing' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
