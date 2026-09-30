import { NextResponse } from 'next/server';
import { globalGraph } from '@/lib/graph';
import { validateMindMapQuality } from '@/lib/mindmap';

export const dynamic = 'force-dynamic';

function extractJSON(text: string): any {
  if (!text) return null;
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  let jsonStr = match ? match[1] : text;
  jsonStr = jsonStr.trim();
  try { return JSON.parse(jsonStr); } catch (e) {
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try { return JSON.parse(jsonStr.substring(firstBrace, lastBrace + 1)); } catch (err) {}
    }
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nodeId } = body;
    const targetNode = globalGraph.nodes.find((n: any) => n.id === nodeId);
    
    if (!targetNode) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const tStart = performance.now();
    let initialSummary = targetNode.structuredSummary;
    let title = targetNode.canonicalName;
    let content = targetNode.sourceReferences?.[0]?.contextSnippet || title;

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI_REQUEST_FAILED', code: 'CONFIG_ERROR' }, { status: 500 });
    }

    const prompt = `Generate a detailed JSON mind map for the following topic/content.
Topic: ${title}
Content: ${content.substring(0, 5000)}

Return ONLY pure JSON matching this schema:
{
  "mindMap": {
    "root": {
      "id": "root",
      "title": "Central Topic",
      "description": "Short overview",
      "children": [
        { "id": "branch-1", "title": "Concept A", "description": "Desc", "children": [] }
      ]
    }
  }
}

Do NOT use generic branches like "Document Content". Use real structural concepts from the source.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    
    console.log(`[AI] Mind Map Request started for ${title}`);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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
        return NextResponse.json({ error: 'AI_REQUEST_FAILED', code: `HTTP_${res.status}` }, { status: res.status });
      }

      const data = await res.json();
      const parsed = extractJSON(data.choices?.[0]?.message?.content);
      const mindMap = parsed?.mindMap || parsed;

      const tEnd = performance.now();
      console.log(`[PERF] Mind Map Generation: ${(tEnd - tStart).toFixed(0)}ms`);

      if (mindMap && mindMap.root) {
        const val = validateMindMapQuality(mindMap, 100, 1000);
        if (!val.valid && mindMap.root.children.length === 0) {
           return NextResponse.json({ error: 'AI_REQUEST_FAILED', code: 'VALIDATION_FAILURE', reason: val.reason }, { status: 400 });
        }
        
        targetNode.mindMap = mindMap;
        globalGraph.updateNode(targetNode.id, targetNode);
        return NextResponse.json({ success: true, generatedData: { mindMap } });
      } else {
        return NextResponse.json({ error: 'AI_REQUEST_FAILED', code: 'INVALID_JSON' }, { status: 400 });
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return NextResponse.json({ error: 'AI_REQUEST_FAILED', code: 'TIMEOUT' }, { status: 408 });
      }
      return NextResponse.json({ error: 'AI_REQUEST_FAILED', code: 'NETWORK_ERROR' }, { status: 500 });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    return NextResponse.json({ error: 'AI_REQUEST_FAILED', code: 'SERVER_ERROR' }, { status: 500 });
  }
}
