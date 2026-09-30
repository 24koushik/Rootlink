import re

with open('src/app/api/mindmap/route.ts', 'r', encoding='utf-8') as f:
    code = f.read()

bad_validation = re.compile(r'// NEW STRUCTURAL REJECTIONS.*?metrics \};\n      \}\n    \}', re.DOTALL)

good_validation = r'''// STRUCTURAL REJECTIONS for extremely bad trees (let moderate trees pass)
    if (sourceWordCount > 100) {
      // Only reject if it's exceptionally linear (e.g. 80%+ linear) and not just a tiny tree
      if (metrics.linearChainRatio >= 0.8 && metrics.totalNodes > 4) {
        return { valid: false, reason: Tree is extremely linear (ratio: ). Needs independent branching., metrics };
      }
      // Require at least a little branching for substantial sources
      if (metrics.majorBranches < 2 && metrics.totalNodes > 5) {
        return { valid: false, reason: Not enough major conceptual branches (). Needs at least 2 for non-trivial sources., metrics };
      }
      // Require at least 5 nodes for substantial sources, not 12
      if (metrics.totalNodes < 5) {
        return { valid: false, reason: Too few nodes (). Expected at least 5 meaningful concepts., metrics };
      }
    }'''

code = bad_validation.sub(good_validation, code)

with open('src/app/api/mindmap/route.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed validation logic.")
