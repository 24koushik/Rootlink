import re

with open("src/lib/graph.ts", "r", encoding="utf-8") as f:
    text = f.read()

# Fix generateEdgesFromPage
old_edges = """export function generateEdgesFromPage(pageSubjectNodeId: string, extractedEntities: Partial<TrustNode>[], currentEdges: TrustEdge[]): TrustEdge[] {
  const edgeMap = new Map<string, TrustEdge>(currentEdges.map(e => [e.id, { ...e }]));

  for (const entity of extractedEntities) {
    const targetId = generateDeterministicId(entity.canonicalName || '', entity.sourceUrl, entity.videoId);
    if (targetId === pageSubjectNodeId) continue;

    const edgeId = `${pageSubjectNodeId}-${targetId}`;
    const reverseEdgeId = `${targetId}-${pageSubjectNodeId}`;

    if (edgeMap.has(edgeId)) {
      const existing = edgeMap.get(edgeId)!;
      existing.confidence = Math.min(1.0, existing.confidence + 0.1);
    } else if (edgeMap.has(reverseEdgeId)) {
      const existing = edgeMap.get(reverseEdgeId)!;
      existing.confidence = Math.min(1.0, existing.confidence + 0.1);
    } else {
      edgeMap.set(edgeId, {
        id: edgeId,
        sourceId: pageSubjectNodeId,
        targetId: targetId,
        relationshipType: 'co_mentioned',
        confidence: entity.trustScore || 0.5,
        createdBy: 'auto-extracted',
        createdAt: Date.now()
      });
    }
  }

  return Array.from(edgeMap.values());
}"""

new_edges = """export function generateEdgesFromPage(pageSubjectNodeId: string, extractedEntities: Partial<TrustNode>[], currentEdges: TrustEdge[]): TrustEdge[] {
  const edgeMap = new Map<string, TrustEdge>(currentEdges.map(e => [e.id, { ...e }]));

  for (const entity of extractedEntities) {
    const targetId = generateDeterministicId(entity.canonicalName || '', entity.sourceUrl, entity.videoId);
    if (targetId === pageSubjectNodeId) continue;

    const edgeId = `${pageSubjectNodeId}-${targetId}`;
    const reverseEdgeId = `${targetId}-${pageSubjectNodeId}`;

    if (edgeMap.has(edgeId)) {
      const existing = edgeMap.get(edgeId)!;
      existing.confidence = Math.min(1.0, existing.confidence + 0.1);
    } else if (edgeMap.has(reverseEdgeId)) {
      const existing = edgeMap.get(reverseEdgeId)!;
      existing.confidence = Math.min(1.0, existing.confidence + 0.1);
    } else {
      edgeMap.set(edgeId, {
        id: edgeId,
        sourceId: pageSubjectNodeId,
        targetId: targetId,
        relationshipType: 'co_mentioned',
        confidence: entity.trustScore || 0.5,
        origin: 'automatic',
        createdAt: Date.now()
      });
    }
  }

  return Array.from(edgeMap.values());
}"""

if old_edges in text:
    text = text.replace(old_edges, new_edges)
else:
    # Use regex if exact match fails
    text = re.sub(r'export function generateEdgesFromPage.*?\n\}', new_edges, text, flags=re.DOTALL)

with open("src/lib/graph.ts", "w", encoding="utf-8") as f:
    f.write(text)
