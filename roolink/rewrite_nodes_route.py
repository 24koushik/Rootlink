with open('src/app/api/nodes/route.ts', 'r', encoding='utf-8') as f:
    text = f.read()

new_post = """export async function POST(request: Request) {
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

    // START BACKGROUND AI PROCESSING (Do not await!)
    (async () => {
       try {
         console.log(`[AI] Background processing started for ${title}`);
         let res;
         if (isYouTube) {
           res = await extractVideoGraphData(finalSegments, formulas, workedProblems);
         } else {
           res = await extractGraphData(rawContent, formulas, workedProblems);
         }

         if (res && res.structuredSummary) {
           createdNode.structuredSummary = res.structuredSummary;
           createdNode.mindMap = res.mindMap;
           createdNode.processingStatus = 'completed';
           if (isYouTube) createdNode.keyMoments = res.keyMoments;
           
           // Process entities
           const extractedEntities = (res.entities || []).map((e: any) => ({
             canonicalName: e.canonicalName, type: e.type, trustScore: e.trustScore, sourceUrl: url, videoId: isYouTube ? videoId : undefined,
             sourceReferences: [{ url, contextSnippet: 'Extracted mention', timestamp: Date.now() }]
           }));
           globalGraph.addScrapedDataToGraph(createdNode, extractedEntities);
           console.log(`[AI] Background processing completed for ${title}`);
         } else {
           console.log(`[AI] Background processing returned no summary for ${title}`);
           createdNode.processingStatus = 'failed';
           globalGraph.updateNode(createdNode.id, createdNode);
         }
       } catch (err) {
         console.error(`[AI] Background processing failed for ${title}:`, err);
         createdNode.processingStatus = 'failed';
         globalGraph.updateNode(createdNode.id, createdNode);
       }
    })();

    // 2. RETURN SUCCESS IMMEDIATELY
    console.log(`[Capture] Node created successfully. Returning success.`);
    return NextResponse.json({ 
       success: true, 
       captureStatus: 'captured', 
       nodeId: createdNode.id,
       data: { source: createdNode } 
    });

  } catch (error: any) {
    console.error("[Capture] API Error:", error);
    return NextResponse.json({ success: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
"""

start_idx = text.find('export async function POST(request: Request) {')
text = text[:start_idx] + new_post

with open('src/app/api/nodes/route.ts', 'w', encoding='utf-8') as f:
    f.write(text)
