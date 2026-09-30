import { NextResponse } from 'next/server';
import { globalGraph } from '@/lib/graph';
import { extractGraphData, extractVideoGraphData, detectSemanticRelationships } from '@/lib/gemini';
import { YoutubeTranscript } from 'youtube-transcript';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const graphData = globalGraph.getGraphData();
  return NextResponse.json(graphData);
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing node ID' }, { status: 400 });
    }
    globalGraph.deleteNode(id);
    return NextResponse.json(globalGraph.getGraphData());
  } catch (error: any) {
    console.error("API /nodes DELETE Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('[API /api/nodes] Incoming Capture Request:', {
      url: body.url,
      isYouTube: body.isYouTube,
      transcriptSegmentsLength: body.transcriptSegments?.length
    });
    const { url, title, rawContent, formulas = [], workedProblems = [], isYouTube, videoId, channelName, durationSeconds, transcriptSource, transcriptSegments } = body;

    if (!url || !title || (rawContent === undefined && !isYouTube)) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    let finalSegments = transcriptSegments || [];
    let rawSnippet = "";

    // 1. EXTRACT / VALIDATE CONTENT (CAPTURE)
    if (isYouTube) {
      if (finalSegments.length === 0 && videoId) {
        try {
          console.log(`[API /api/nodes] Client provided no transcript. Fetching server-side for videoId: ${videoId}`);
          const ytRes = await YoutubeTranscript.fetchTranscript(videoId);
          finalSegments = ytRes.map((item: any) => ({
            text: item.text,
            startSeconds: item.offset / 1000,
            durationSeconds: item.duration / 1000
          }));
        } catch (err) {}
      }
      rawSnippet = finalSegments.map((s: any) => s.text).join(' ').substring(0, 1500) + '...';
    } else {
      rawSnippet = (rawContent || '').substring(0, 1500) + '...';
    }

    // Prepare Base Page Subject immediately
    const pageSubject: any = {
      canonicalName: title,
      type: isYouTube ? 'youtube_video' : 'page',
      sourceUrl: url,
      trustScore: 1.0,
      sourceReferences: [{ url, contextSnippet: rawSnippet, timestamp: Date.now() }],
      flaggedDebunked: false,
      captureStatus: 'captured',
      processingStatus: 'processing',
      formulas,
      workedProblems
    };
    
    if (isYouTube) {
      pageSubject.videoId = videoId;
      pageSubject.channelName = channelName;
      pageSubject.durationSeconds = durationSeconds;
      pageSubject.transcriptSource = transcriptSource;
    }

    // Save node synchronously so it's instantly available to UI
    const graphData = globalGraph.addScrapedDataToGraph(pageSubject, []);
    const createdNode = graphData.nodes.find((n: any) => n.canonicalName === title) || pageSubject;

        // RUN AI PROCESSING SYNCHRONOUSLY FOR VERCEL
    try {
      console.log(`[AI] Processing started for ${title}`);
      let res: any;
      if (isYouTube) {
        res = await extractVideoGraphData(finalSegments, formulas, workedProblems);
      } else {
        res = await extractGraphData(rawContent || '', formulas, workedProblems);
      }

      if (res && res.structuredSummary) {
        createdNode.structuredSummary = res.structuredSummary;
        createdNode.mindMap = res.mindMap;
        if (res.semanticProfile) createdNode.semanticProfile = res.semanticProfile;
        createdNode.processingStatus = 'completed';
        if (isYouTube) createdNode.keyMoments = res.keyMoments;
        
        const extractedEntities = (res.entities || []).map((e: any) => ({
          canonicalName: e.canonicalName, type: e.type, trustScore: e.trustScore, sourceUrl: url, videoId: videoId,
          sourceReferences: [{ url, contextSnippet: 'Extracted mention', timestamp: Date.now() }]
        }));
        globalGraph.addScrapedDataToGraph(createdNode, extractedEntities);
        globalGraph.recalculateAutomaticLinks();
      } else {
        createdNode.processingStatus = 'failed';
        globalGraph.updateNode(createdNode.id, createdNode);
      }
    } catch (err) {
      console.error('[AI] Processing failed:', err);
      createdNode.processingStatus = 'failed';
      globalGraph.updateNode(createdNode.id, createdNode);
    }

    return NextResponse.json({ 
      success: true,
      captureStatus: 'captured', 
      nodeId: createdNode.id 
    });
  } catch (error: any) {
    console.error("API /nodes POST Error:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
