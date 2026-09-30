import re

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

new_func = '''function normalizeStructuredSummary(node: any) {
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
  
  // Normalize points -> keyPoints for the fallback object
  sections = sections.map((sec: any) => ({
    ...sec,
    keyPoints: sec.keyPoints || sec.points || []
  }));
  
  let keyTakeaways = ss.keyTakeaways || ss.keyInsights || node.keyInsights || [];
  
  return {
    overview,
    sections,
    keyTakeaways
  };
}'''

# Replace using regex to grab the whole function
code = re.sub(r'function normalizeStructuredSummary\(node: any\) \{.*?\n  \}', new_func, code, flags=re.DOTALL)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated normalize function!")
