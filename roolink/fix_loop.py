import re

with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    code = f.read()

start_idx = code.find("let generatedData = null;")
if start_idx == -1:
    print("Could not find generation loop start!")
    exit()

end_idx = code.find("return NextResponse.json({", start_idx)
if end_idx == -1:
    print("Could not find generation loop end!")
    exit()

new_loop = """let generatedData = null;
    let finalError = 'Knowledge generation failed due to unknown error';
    let statusCode = 500;
    
    // Attempt 1: Initial Generation
    let attempt = 0;
    let initialMindMap = null;
    let initialSummary = null;
    let mmValidation = null;
    
    const sourceWordCount = content.split(/\s+/).length;
    console.log(`[KNOWLEDGE] MindMap source words: ${sourceWordCount}`);

    const userPrompt = `Title: ${title}\\nType: ${sourceType}\\nContent:\\n${content}`;
    const modelsToTry = [primaryModel, ...backupModels];
    
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Rootlink'
        },
        body: JSON.stringify({
          models: modelsToTry,
          response_format: { type: "json_object" },
          messages: [
            { role: 'system', content: baseSystemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3
        }),
        signal: AbortSignal.timeout(90000)
      });

      if (res.ok) {
        const data = await res.json();
        let textContent = data.choices?.[0]?.message?.content;
        
        if (textContent) {
          textContent = textContent.trim();
          if (textContent.startsWith("```")) {
            const lines = textContent.split('\\n');
            if (lines[0].startsWith("```")) lines.shift();
            if (lines[lines.length - 1].startsWith("```")) lines.pop();
            textContent = lines.join('\\n').trim();
          }

          try {
            const parsedJson = JSON.parse(textContent);
            initialMindMap = normalizeMindMapResponse(parsedJson.mindMap || parsedJson);
            initialSummary = parsedJson.summary;
            
            if (initialMindMap && initialMindMap.root) {
              console.log(`[KNOWLEDGE] Initial root: ${initialMindMap.root.title}`);
              mmValidation = validateMindMapQuality(initialMindMap, sourceWordCount, sourceCharacterCount);
              console.log(`[KNOWLEDGE] Initial major branches: ${mmValidation.metrics?.majorBranches}`);
              console.log(`[KNOWLEDGE] Initial total nodes: ${mmValidation.metrics?.totalNodes}`);
              console.log(`[KNOWLEDGE] Initial max depth: ${mmValidation.metrics?.maxDepth}`);
              console.log(`[KNOWLEDGE] Validation: ${mmValidation.valid ? 'PASS' : 'FAIL'} - ${mmValidation.reason}`);
              
              if (mmValidation.valid) {
                parsedJson.mindMap = initialMindMap;
                generatedData = parsedJson;
              } else {
                finalError = `MindMap validation failed: ${mmValidation.reason}`;
              }
            } else {
              finalError = "Initial mind map missing root";
            }
          } catch (e) {
            finalError = "Invalid JSON returned by AI in attempt 1";
          }
        }
      } else {
         finalError = `OpenRouter API error: ${res.status}`;
      }
    } catch (e) {
      finalError = "Network error in attempt 1";
    }

    // Attempt 2: Restructure Retry
    if (!generatedData && initialMindMap && initialSummary) {
      console.log(`[KNOWLEDGE] Starting structural retry...`);
      
      const retrySystemPrompt = `You are Rootlink's Knowledge Architecture Engine.
You must restructure a failed hierarchical mind map.

The generated mind map is too centralized/linear or poorly branched.
Validation failed with reason: ${mmValidation?.reason || 'Unknown'}

Rebuild the tree.
Keep the same central topic, but reorganize the source into multiple independent conceptual branches.
Identify the actual major ideas discussed by the source.
Do not invent information.
Do not merely split sentences into branches.
Do not create generic branches such as 'Details' or 'Document Content'.
Create 3-7 meaningful top-level branches when supported by the source.
Each branch should represent a distinct conceptual area.

Return ONLY the corrected mind map JSON in this exact structure:
{
  "mindMap": {
    "root": {
      "id": "root",
      "title": "Central Topic",
      "description": "Short description",
      "children": [ ... ]
    }
  }
}`;

      const retryUserPrompt = `Title: ${title}
Content:
${content}

Structured Summary (Use for semantic hints):
${JSON.stringify(initialSummary.sections || [], null, 2)}

Failed Mind Map:
${JSON.stringify(initialMindMap, null, 2)}

Return ONLY the restructured JSON mind map.`;

      try {
        const retryRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Rootlink'
          },
          body: JSON.stringify({
            models: backupModels,
            response_format: { type: "json_object" },
            messages: [
              { role: 'system', content: retrySystemPrompt },
              { role: 'user', content: retryUserPrompt }
            ],
            temperature: 0.2
          }),
          signal: AbortSignal.timeout(60000)
        });

        if (retryRes.ok) {
          const retryData = await retryRes.json();
          let textContent = retryData.choices?.[0]?.message?.content;
          
          if (textContent) {
            textContent = textContent.trim();
            if (textContent.startsWith("```")) {
              const lines = textContent.split('\\n');
              if (lines[0].startsWith("```")) lines.shift();
              if (lines[lines.length - 1].startsWith("```")) lines.pop();
              textContent = lines.join('\\n').trim();
            }

            try {
              const parsedRetryJson = JSON.parse(textContent);
              const retryMindMap = normalizeMindMapResponse(parsedRetryJson.mindMap || parsedRetryJson);
              
              if (retryMindMap && retryMindMap.root) {
                const retryValidation = validateMindMapQuality(retryMindMap, sourceWordCount, sourceCharacterCount);
                console.log(`[KNOWLEDGE] Retry major branches: ${retryValidation.metrics?.majorBranches}`);
                console.log(`[KNOWLEDGE] Retry total nodes: ${retryValidation.metrics?.totalNodes}`);
                console.log(`[KNOWLEDGE] Retry validation: ${retryValidation.valid ? 'PASS' : 'FAIL'} - ${retryValidation.reason}`);
                
                if (retryValidation.valid) {
                  generatedData = {
                    summary: initialSummary,
                    mindMap: retryMindMap
                  };
                } else {
                  finalError = `Retry failed: ${retryValidation.reason}`;
                  initialMindMap = retryMindMap; // pass it to fallback
                }
              }
            } catch (e) {
              finalError = "Invalid JSON returned in retry";
            }
          }
        }
      } catch (e) {
         finalError = "Network error in retry";
      }
    }

    // Attempt 3: Safe Deterministic Fallback
    if (!generatedData && initialSummary && initialSummary.sections && initialSummary.sections.length > 0) {
      console.log(`[KNOWLEDGE] Using summary-section fallback...`);
      const fallbackRoot = {
        id: "root",
        title: initialSummary.title || title || "Central Topic",
        description: initialSummary.overview ? initialSummary.overview.substring(0, 100) + '...' : "Overview",
        children: initialSummary.sections.map((sec: any, i: number) => {
          const sectionChildren = (sec.keyPoints || []).slice(0, 5).map((kp: string, j: number) => ({
            id: `sec-${i}-kp-${j}`,
            title: kp.substring(0, 40).split(' ').slice(0, 6).join(' '),
            description: kp,
            children: []
          }));
          return {
            id: `sec-${i}`,
            title: sec.heading || sec.title || `Concept ${i+1}`,
            description: sec.explanation ? sec.explanation.substring(0, 100) + '...' : "",
            children: sectionChildren
          };
        }).filter((sec: any) => sec.title && sec.title.toUpperCase() !== "DOCUMENT CONTENT")
      };
      
      const fallbackMindMap = { root: fallbackRoot };
      const fallbackValidation = validateMindMapQuality(fallbackMindMap, sourceWordCount, sourceCharacterCount);
      console.log(`[KNOWLEDGE] Fallback validation: ${fallbackValidation.valid ? 'PASS' : 'FAIL'}`);
      
      if (fallbackValidation.valid || fallbackRoot.children.length > 0) {
        generatedData = {
          summary: initialSummary,
          mindMap: fallbackMindMap
        };
        console.log(`[KNOWLEDGE] Final mind map accepted: FALLBACK`);
      }
    }

    if (!generatedData && initialMindMap && initialSummary) {
      // absolute last resort: just return what we have, better than a total crash
      console.log(`[KNOWLEDGE] Final mind map accepted: FORCED FAILED MAP`);
      generatedData = {
        summary: initialSummary,
        mindMap: initialMindMap
      };
    }

    if (generatedData && generatedData.mindMap && generatedData.mindMap.root) {
        console.log(`[KNOWLEDGE] Final root child count: ${generatedData.mindMap.root.children?.length}`);
    }

    if (!generatedData) {
      return NextResponse.json({ success: false, error: finalError }, { status: statusCode });
    }

    // Process nodes as usual...
"""

code = code[:start_idx] + new_loop + code[end_idx:]

with open('src/app/api/mindmap/route.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed generation loop.")
