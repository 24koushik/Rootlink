import re

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

func = '''function normalizeStructuredSummary(node: any) {
  if (!node) return { overview: "", sections: [], keyTakeaways: [] };
  const ss = node.structuredSummary || {};
  
  let overview = ss.overview || ss.detailedSummary || (typeof node.summary === 'string' ? node.summary : "");
  
  let sections = ss.sections || [];
  if (sections.length === 0 && ss.keyConcepts && ss.keyConcepts.length > 0) {
    sections = ss.keyConcepts.map((c: any) => ({
      title: c.concept,
      explanation: c.explanation,
      keyPoints: []
    }));
  }
  
  let keyTakeaways = ss.keyTakeaways || ss.keyInsights || node.keyInsights || [];
  
  return {
    overview,
    sections,
    keyTakeaways
  };
}

export default function Dashboard() {'''

code = code.replace("export default function Dashboard() {", func)

# Now, inside the Dashboard component, add the canonicalSummary
add_summary = '''  // Normalize summary data for the UI
  const canonicalSummary = selectedNode ? normalizeStructuredSummary(selectedNode) : { overview: "", sections: [], keyTakeaways: [] };
  
  return ('''

code = code.replace("  return (", add_summary, 1)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Added normalization function.")
