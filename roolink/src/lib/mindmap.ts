export interface MindMapNode {
  id?: string;
  title: string;
  description?: string;
  children?: MindMapNode[];
}

export interface MindMapData {
  root: MindMapNode;
}

export function normalizeMindMap(rawMindMap: any): MindMapData | null {
  if (!rawMindMap) return null;
  
  if (typeof rawMindMap === 'string') {
    try {
      rawMindMap = JSON.parse(rawMindMap);
    } catch {
      return null;
    }
  }

  if (typeof rawMindMap !== 'object' || Array.isArray(rawMindMap)) {
    return null;
  }

  // Handle migration from old format where root was top-level
  if (rawMindMap.title && Array.isArray(rawMindMap.branches)) {
    return {
      root: {
        title: String(rawMindMap.title),
        description: rawMindMap.description ? String(rawMindMap.description) : undefined,
        children: rawMindMap.branches.map((b: any) => ({
          title: String(b.title || 'Branch'),
          description: b.description ? String(b.description) : undefined,
          children: [
            ...(Array.isArray(b.points) ? b.points.map((p: string) => ({ title: String(p) })) : []),
            ...(Array.isArray(b.children) ? b.children.map((c: any) => ({
              title: String(c.title || 'Subconcept'),
              description: c.description ? String(c.description) : undefined,
              children: Array.isArray(c.points) ? c.points.map((p: string) => ({ title: String(p) })) : []
            })) : [])
          ]
        }))
      }
    };
  }

  if (!rawMindMap.root || !rawMindMap.root.title) {
    return null;
  }

  const normalizeNode = (node: any): MindMapNode => ({
    id: node.id ? String(node.id) : undefined,
    title: String(node.title || 'Concept'),
    description: node.description ? String(node.description) : undefined,
    children: Array.isArray(node.children) ? node.children.map(normalizeNode) : undefined
  });

  return {
    root: normalizeNode(rawMindMap.root)
  };
}



export function validateMindMapQuality(mindMap: any, sourceWordCount: number, sourceCharacterCount: number): { valid: boolean; reason: string | null; metrics: any } {
  const root = mindMap.root;
  if (!root || !root.children) return { valid: false, reason: "Missing root or children", metrics: null };

  const badTitles = ["EXTRACTED TOPIC", "EXTRACTED CONTENT", "WEBPAGE CONTENT", "LOCAL SUMMARY", "EXTRACTED POINTS", "DOCUMENT CONTENT", "OVERVIEW", "DETAILS", "INFORMATION"];
  if (badTitles.includes(root.title.toUpperCase())) {
    return { valid: false, reason: `Generic root title detected: ${root.title}`, metrics: null };
  }

  let totalNodes = 1;
  let maxDepth = 0;
  let linearChains = 0;
  const uniqueTitles = new Set<string>([root.title.toLowerCase()]);

  function traverse(node: any, depth: number) {
    if (depth > maxDepth) maxDepth = depth;
    if (!node.children || node.children.length === 0) return;
    if (node.children.length === 1) linearChains++;

    for (const child of node.children) {
      if (!child.title) continue;
      const t = child.title.toLowerCase();
      if (uniqueTitles.has(t)) {
        // duplicate
      }
      uniqueTitles.add(t);
      totalNodes++;
      traverse(child, depth + 1);
    }
  }

  traverse(root, 1);
  const majorBranches = root.children.length;

  if (sourceWordCount > 300 && majorBranches < 2) {
    return { valid: false, reason: `Not enough major conceptual branches (${majorBranches}) for a substantial source.`, metrics: { majorBranches, totalNodes, maxDepth } };
  }
  
  if (majorBranches > 12) {
    return { valid: false, reason: `Too many top-level branches (${majorBranches}). Structure is too flat.`, metrics: { majorBranches, totalNodes, maxDepth } };
  }

  return { valid: true, reason: null, metrics: { majorBranches, totalNodes, maxDepth, linearChains, uniqueConcepts: uniqueTitles.size } };
}
