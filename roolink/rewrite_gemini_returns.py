import re

with open("src/lib/gemini.ts", "r", encoding="utf-8") as f:
    text = f.read()

# Fix extractGraphData signature
text = text.replace(
    '): Promise<{ structuredSummary: any, mindMap: any, entities: any[] }> {',
    '): Promise<{ structuredSummary: any, mindMap: any, entities: any[], semanticProfile?: any }> {'
)
text = text.replace(
    'return { structuredSummary: parsedResult.summary, mindMap: finalMindMap, entities: parsedResult.entities || [] };',
    'return { structuredSummary: parsedResult.summary, mindMap: finalMindMap, entities: parsedResult.entities || [], semanticProfile: parsedResult.semanticProfile };'
)

# Fix extractVideoGraphData signature
text = text.replace(
    '): Promise<{ structuredSummary: any, mindMap: any, entities: any[], keyMoments: any[] }> {',
    '): Promise<{ structuredSummary: any, mindMap: any, entities: any[], keyMoments: any[], semanticProfile?: any }> {'
)

text = text.replace(
    'return { structuredSummary: parsedResult.summary, mindMap: finalMindMap, entities: parsedResult.entities || [], keyMoments };',
    'return { structuredSummary: parsedResult.summary, mindMap: finalMindMap, entities: parsedResult.entities || [], keyMoments, semanticProfile: parsedResult.semanticProfile };'
)

with open("src/lib/gemini.ts", "w", encoding="utf-8") as f:
    f.write(text)
