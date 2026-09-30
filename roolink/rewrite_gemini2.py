new_gemini_ts = r'''import { YoutubeTranscript } from 'youtube-transcript';
import { validateMindMapQuality } from './mindmap';

const NOISE_PATTERNS = [
  /archived from the original[^.]*\./gi,
  /retrieved[^.]*\d{4}[^.]*\./gi,
  /cite[^.]*\./gi,
  /\[\d+\]/g,
  /\[edit\]/gi,
  /jump to (navigation|search|content)/gi,
  /\^ [a-z]/gi,
  /isbn[^.]+/gi,
  /doi:[^.]+/gi,
  /https?:\/\/\S+/g,
  /privacy policy[^.]*\./gi,
  /terms of (use|service)[^.]*\./gi,
  /copyright [^.]*\./gi,
  /advertisement/gi,
  /related articles?:?/gi,
  /read more:?/gi,
  /LIVE Full Stack Course/gi,
  /job listings?/gi,
  /course recommendations?/gi,
  /subscribe now/gi,
  /sign up for/gi
];

function cleanContent(raw: string): string {
  let text = raw;
  NOISE_PATTERNS.forEach(p => { text = text.replace(p, ' '); });
  return text.replace(/\n{3,}/g, '\n\n').replace(/\s{2,}/g, ' ').trim();
}

function extractJSON(text: string): any {
  if (!text) return null;
  const match = text.match(/`(?:json)?\s*([\s\S]*?)\s*`/);
  let jsonStr = match ? match[1] : text;
  jsonStr = jsonStr.trim();
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(jsonStr.substring(firstBrace, lastBrace + 1));
      } catch (err) {}
    }
    return null;
  }
}

function localSummarize(text: string): string {
  const sentences = text.split('. ').filter(s => s.length > 20);
  const start = sentences.slice(0, 3).join('. ');
  const end = sentences.slice(-2).join('. ');
  return start + (start && end ? '. ' : '') + end;
}

// ---------------------------------------------------------
// Fast OpenRouter Pipeline (One AI Call for Summary + MindMap)
// ---------------------------------------------------------

async function performAIExtraction(content: string, type: 'text' | 'video', extraContext: string = ''): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OpenRouter API key is missing.");
    return null;
  }

  const prompt = You are an expert knowledge-structuring assistant and the Rootlink Knowledge Extraction Engine.
Read the supplied source content and extract structured knowledge.

Content:


Respond ONLY with pure JSON matching this EXACT schema:
{
  "summary": {
    "overview": "Detailed overview paragraph...",
    "sections": [
      {
        "title": "Main Concept/Heading",
        "explanation": "Explanation of this section",
        "keyPoints": ["Important detail 1", "Important detail 2"]
      }
    ],
    "keyTakeaways": ["Takeaway 1", "Takeaway 2"],
    "formulas": [{"name": "", "latex": "", "explanation": ""}]
  },
  "mindMap": {
    "root": {
      "id": "root",
      "title": "Central Topic",
      "description": "Short explanation",
      "children": [
        {
          "id": "branch-1",
          "title": "Major Conceptual Branch",
          "description": "Short description",
          "children": []
        }
      ]
    }
  },
  "entities": [
    { "canonicalName": "Specific Noun/Concept", "type": "concept", "trustScore": 0.9 }
  ]
}

CRITICAL INSTRUCTIONS:
- The mind map MUST NOT be a linear outline. Extract 3-7 independent conceptual branches for the root if the source supports it.
- Never use "Document Content", "Details", or "Overview" as a mind map branch.
- Keep mind map nodes concise. Put detailed text in the summary.sections.;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second fast timeout

  const t0 = performance.now();
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': Bearer ,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Rootlink'
      },
      signal: controller.signal,
      body: JSON.stringify({
        models: ["google/gemini-2.5-flash", "meta-llama/llama-3.1-8b-instruct"],
        provider: { sort: "throughput", allow_fallbacks: true },
        response_format: { type: "json_object" },
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });
    
    if (!res.ok) {
      console.error([AI] API Error );
      return null;
    }
    
    const data = await res.json();
    const t1 = performance.now();
    console.log([PERF] AI Extraction took ms);
    
    return extractJSON(data.choices?.[0]?.message?.content);
  } catch (e) {
    console.error("[AI] Network Error:", e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Targeted mind map repair
async function repairMindMap(content: string, failedMap: any, reason: string): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const prompt = The following mind map structure failed validation: 
Reorganize this into a valid hierarchical concept tree based on the source content.
Return ONLY the JSON mindMap object.
Failed Map: 
Source: ;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': Bearer ,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Rootlink'
      },
      signal: controller.signal,
      body: JSON.stringify({
        models: ["google/gemini-2.5-flash", "meta-llama/llama-3.1-8b-instruct"],
        provider: { sort: "throughput", allow_fallbacks: true },
        response_format: { type: "json_object" },
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = extractJSON(data.choices?.[0]?.message?.content);
    return parsed?.mindMap || parsed;
  } catch(e) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function extractGraphData(
  rawContent: string, 
  formulas: any[] = [], 
  workedProblems: any[] = []
): Promise<{ structuredSummary: any, mindMap: any, entities: any[] }> {
  
  const tStart = performance.now();
  let cleaned = cleanContent(rawContent);
  if (cleaned.length > 15000) cleaned = cleaned.substring(0, 15000) + "\n...[TRUNCATED]";

  const mathContext = formulas.length > 0 || workedProblems.length > 0 
    ? \n\nFormulas:\n\n\nWorked Problems:\n : '';

  let parsedResult = await performAIExtraction(cleaned, 'text', mathContext);

  if (!parsedResult || !parsedResult.summary) {
    console.log("[AI] Fast extraction failed. Using local deterministic fallback.");
    const localSum = localSummarize(cleaned);
    const localInsights = localSum.split('. ').filter(s => s.length > 5).map(s => s.trim() + (s.endsWith('.') ? '' : '.'));
    const points = [];
    for (let i = 0; i < localInsights.length; i += 3) {
      points.push(localInsights.slice(i, i + 3).join(' '));
    }
    parsedResult = {
      summary: {
        overview: 'Automated Local Extraction: ' + (localSum.length > 0 ? localSum.substring(0, 500) + '...' : 'No content extracted.'),
        sections: [{ title: "Extracted Points", explanation: "", keyPoints: points }],
        keyTakeaways: localInsights.slice(0, 5)
      },
      mindMap: {
        root: {
          id: "root", title: "Central Topic", children: points.map((p, i) => ({ id: c, title: Point , description: p, children: [] }))
        }
      },
      entities: []
    };
  }

  // Phase 2: Local Validation & Targeted Repair
  const sourceWordCount = cleaned.split(/\s+/).length;
  let finalMindMap = parsedResult.mindMap;
  
  if (finalMindMap && finalMindMap.root) {
    const val = validateMindMapQuality(finalMindMap, sourceWordCount, cleaned.length);
    if (!val.valid) {
      console.log([KNOWLEDGE] Mind Map Invalid (). Triggering targeted repair...);
      const repaired = await repairMindMap(cleaned, finalMindMap, val.reason || 'Invalid');
      if (repaired && repaired.root) {
        const val2 = validateMindMapQuality(repaired, sourceWordCount, cleaned.length);
        if (val2.valid || repaired.root.children.length > 0) {
          finalMindMap = repaired;
        }
      }
    }
  }

  const tEnd = performance.now();
  console.log([PERF] Total Extraction Time: ms);

  return { 
    structuredSummary: parsedResult.summary, 
    mindMap: finalMindMap, 
    entities: parsedResult.entities || [] 
  };
}

export async function extractVideoGraphData(
  transcriptSegments: { text: string, startSeconds: number }[],
  formulas: any[] = [],
  workedProblems: any[] = []
): Promise<{ structuredSummary: any, mindMap: any, entities: any[], keyMoments: any[] }> {
  
  const tStart = performance.now();
  let transcriptText = "";
  for (const seg of transcriptSegments) {
    const formattedTime = new Date(seg.startSeconds * 1000).toISOString().substring(11, 19).replace(/^00:/, '');
    transcriptText += [] \n;
  }
  if (transcriptText.length > 15000) transcriptText = transcriptText.substring(0, 15000) + "\n...[TRUNCATED]";

  const mathContext = formulas.length > 0 || workedProblems.length > 0 
    ? \n\nFormulas:\n\n\nWorked Problems:\n : '';

  let parsedResult = await performAIExtraction(transcriptText, 'video', mathContext);

  if (!parsedResult || !parsedResult.summary) {
    console.log("[AI] Fast extraction failed for video. Using local fallback.");
    const localSum = localSummarize(transcriptText);
    parsedResult = {
      summary: {
        overview: 'Automated Local Extraction: ' + localSum.substring(0, 200),
        sections: [{ title: "Transcript Summary", explanation: "", keyPoints: [localSum.substring(0, 300)] }],
        keyTakeaways: ["Review transcript for details."]
      },
      mindMap: null,
      entities: []
    };
  }
  
  // Phase 2: Targeted Repair
  const sourceWordCount = transcriptText.split(/\s+/).length;
  let finalMindMap = parsedResult.mindMap;
  if (finalMindMap && finalMindMap.root) {
    const val = validateMindMapQuality(finalMindMap, sourceWordCount, transcriptText.length);
    if (!val.valid) {
      const repaired = await repairMindMap(transcriptText, finalMindMap, val.reason || 'Invalid');
      if (repaired && repaired.root) finalMindMap = repaired;
    }
  }

  const keyMoments = (parsedResult.summary?.sections || []).map((sec: any, i: number) => ({
    timestampSeconds: i * 60,
    timestampFormatted: "00:00",
    insight: sec.title || "Key Insight"
  }));

  const tEnd = performance.now();
  console.log([PERF] Total Video Extraction Time: ms);

  return { 
    structuredSummary: parsedResult.summary, 
    mindMap: finalMindMap, 
    entities: parsedResult.entities || [], 
    keyMoments 
  };
}

export async function detectSemanticRelationships(newNode: any, existingNodes: any[]): Promise<any[]> {
  if (!existingNodes || existingNodes.length === 0) return [];
  return []; 
}'''

with open('src/lib/gemini.ts', 'w', encoding='utf-8') as f:
    f.write(new_gemini_ts)

print("Rewrote gemini.ts correctly without regex mangling!")
