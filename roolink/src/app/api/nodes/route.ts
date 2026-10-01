import { NextResponse } from 'next/server';
import { globalGraph } from '@/lib/graph';
import { extractGraphData, extractVideoGraphData, detectSemanticRelationships } from '@/lib/gemini';
import { Innertube } from 'youtubei.js';
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
    let { url, title, rawContent, formulas = [], workedProblems = [], isYouTube: clientIsYouTube, videoId: clientVideoId, channelName, durationSeconds, transcriptSource, transcriptSegments } = body;

    // 1. SERVER-SIDE YOUTUBE DETECTION & NORMALIZATION
    let isYouTube = clientIsYouTube;
    let videoId = clientVideoId;
    
    const ytMatch = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (ytMatch && ytMatch[1]) {
        isYouTube = true;
        videoId = ytMatch[1];
    }

    if (!url || !title || (rawContent === undefined && !isYouTube)) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    let finalSegments = transcriptSegments || [];
    let rawSnippet = "";
    let ytInfo: any = null;

    if (isYouTube && videoId) {
        try {
            console.log(`[API /api/nodes] Using InnerTube for videoId: ${videoId}`);
            const yt = await Innertube.create();
            ytInfo = await yt.getInfo(videoId);
            
            if (ytInfo && ytInfo.basic_info) {
                title = ytInfo.basic_info.title || title;
                channelName = ytInfo.basic_info.channel?.name || channelName;
                durationSeconds = ytInfo.basic_info.duration || durationSeconds;
            }

            if (finalSegments.length === 0) {
                try {
                    const transcriptData = await ytInfo.getTranscript();
                    if (transcriptData && transcriptData.transcript && transcriptData.transcript.content) {
                        const bodyData = transcriptData.transcript.content.body;
                        if (bodyData && bodyData.initial_segments) {
                           finalSegments = bodyData.initial_segments.map((seg: any) => ({
                               text: seg.snippet.text,
                               startSeconds: parseInt(seg.start_ms) / 1000,
                               durationSeconds: parseInt(seg.duration_ms) / 1000
                           }));
                           transcriptSource = 'manual';
                        }
                    }
                } catch (innerErr) {
                    console.log("[API] InnerTube transcript fetch failed, falling back to YoutubeTranscript", innerErr);
                    const ytRes = await YoutubeTranscript.fetchTranscript(videoId);
                    finalSegments = ytRes.map((item: any) => ({
                      text: item.text,
                      startSeconds: item.offset / 1000,
                      durationSeconds: item.duration / 1000
                    }));
                    transcriptSource = 'auto-generated';
                }
            }
        } catch (err) {
            console.error("[API] InnerTube metadata fetch failed:", err);
        }
        
        if (finalSegments.length > 0) {
            rawSnippet = finalSegments.map((s: any) => s.text).join(' ').substring(0, 1500) + '...';
        } else {
            rawSnippet = (ytInfo?.basic_info?.short_description || "Video transcript unavailable.").substring(0, 1500) + '...';
        }
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
    
    if (isYouTube && videoId) {
      pageSubject.videoId = videoId;
      pageSubject.channelName = channelName;
      pageSubject.durationSeconds = durationSeconds;
      pageSubject.transcriptSource = transcriptSource;
    }

    // Save node synchronously so it's instantly available to UI
    const expectedId = pageSubject.videoId ? `yt-${pageSubject.videoId}` : (pageSubject.sourceUrl ? new URL(pageSubject.sourceUrl).hostname + new URL(pageSubject.sourceUrl).pathname : title).replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
    
    // Actually, just let addScrapedDataToGraph run and we will explicitly find it by the deterministic ID logic
    const graphData = globalGraph.addScrapedDataToGraph(pageSubject, []);
    
    // Re-import the ID logic to perfectly match
    const { generateDeterministicId } = require('@/lib/graph');
    const exactId = generateDeterministicId(pageSubject.canonicalName, pageSubject.sourceUrl, pageSubject.videoId);
    
    let createdNode: any = graphData.nodes.find((n: any) => n.id === exactId);
    if (!createdNode) {
        console.error("[API] Could not find created node by ID! Using pageSubject as fallback.");
        createdNode = { ...pageSubject, id: exactId };
    }

    // RUN AI PROCESSING SYNCHRONOUSLY FOR VERCEL
    try {
      console.log(`[AI] Processing started for ${title}`);
      let res: any;
      if (isYouTube) {
        if (finalSegments.length === 0) {
             res = await extractGraphData((ytInfo?.basic_info?.short_description || title), formulas, workedProblems);
        } else {
             res = await extractVideoGraphData(finalSegments, formulas, workedProblems);
        }
      } else {
        res = await extractGraphData(rawContent || '', formulas, workedProblems);
      }

      if (res && res.structuredSummary) {
        createdNode.structuredSummary = res.structuredSummary;
        createdNode.mindMap = res.mindMap;
        if (res.semanticProfile) createdNode.semanticProfile = res.semanticProfile;
        createdNode.processingStatus = 'completed';
        if (isYouTube && res.keyMoments) createdNode.keyMoments = res.keyMoments;
        
        globalGraph.updateNode(createdNode.id, createdNode);
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
      nodeId: createdNode.id,
      source: {
        aiSummary: createdNode.structuredSummary?.overview || createdNode.summary || "Successfully captured and added to your Knowledge Graph."
      }
    });
  } catch (error: any) {
    console.error("API /nodes POST Error:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
