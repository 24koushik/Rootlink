import re

with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    code = f.read()

start_idx = code.find("function validateMindMapQuality")
end_idx = code.find("function validateSummaryQuality")

if start_idx == -1 or end_idx == -1:
    print("Could not find validation functions!")
else:
    new_validator = """function validateMindMapQuality(mindMap: any, sourceWordCount: number, sourceCharacterCount: number) {
  if (!mindMap || !mindMap.root) {
    return { valid: false, reason: "Missing root node", metrics: null };
  }
  
  const root = mindMap.root;
  if (!root.title || root.title === "Untitled") {
    return { valid: false, reason: "Root node has no title", metrics: null };
  }
  
  const badTitles = ["EXTRACTED TOPIC", "EXTRACTED CONTENT", "WEBPAGE CONTENT", "LOCAL SUMMARY", "EXTRACTED POINTS", "DOCUMENT CONTENT", "OVERVIEW", "DETAILS", "INFORMATION"];
  if (badTitles.includes(root.title.toUpperCase())) {
    return { valid: false, reason: `Generic root title detected: ${root.title}`, metrics: null };
  }

  const metrics = { 
    totalNodes: 0, 
    maxDepth: 0, 
    majorBranches: root.children ? root.children.length : 0, 
    leafNodes: 0,
    linearChainRatio: 0
  };
  
  let nonLeafNodes = 0;
  let singleChildNodes = 0;

  function traverse(node: any, depth: number) {
    metrics.totalNodes++;
    metrics.maxDepth = Math.max(metrics.maxDepth, depth);
    if (!node.children || node.children.length === 0) {
      metrics.leafNodes++;
    } else {
      nonLeafNodes++;
      if (node.children.length === 1) singleChildNodes++;
      for (const child of node.children) traverse(child, depth + 1);
    }
  }
  traverse(root, 1);

  if (nonLeafNodes > 0) {
    metrics.linearChainRatio = singleChildNodes / nonLeafNodes;
  }

  if (metrics.totalNodes === 1) {
    return { valid: false, reason: "Only one node generated (no children)", metrics };
  }
  if (metrics.maxDepth === 1 && metrics.totalNodes <= 2) {
    return { valid: false, reason: "Maximum depth = 1 and total nodes <= 2", metrics };
  }
  if (metrics.majorBranches === 0) {
    return { valid: false, reason: "Zero major branches (root has no children)", metrics };
  }
  
  // STRUCTURAL REJECTIONS tailored to source complexity
  if (sourceWordCount > 100) {
    // Highly linear chains
    if (metrics.linearChainRatio >= 0.8 && metrics.totalNodes > 4) {
      return { valid: false, reason: `Tree is extremely linear (ratio: ${metrics.linearChainRatio.toFixed(2)}). Needs independent branching.`, metrics };
    }

    // Dynamic branch requirement based on source size
    let minMajorBranches = 2;
    if (sourceWordCount > 500) minMajorBranches = 3;
    if (sourceWordCount > 1500) minMajorBranches = 4;

    if (metrics.majorBranches < minMajorBranches && metrics.totalNodes > 3) {
      return { valid: false, reason: `Not enough major conceptual branches (${metrics.majorBranches}) for a source of ${sourceWordCount} words. Expected at least ${minMajorBranches}.`, metrics };
    }
  }
  
  return { valid: true, reason: "Validation passed", metrics };
}

"""
    code = code[:start_idx] + new_validator + code[end_idx:]
    with open('src/app/api/mindmap/route.ts', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Fixed validateMindMapQuality.")
