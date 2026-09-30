with open("src/app/page.tsx", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace(
    'const handleNodeSelect = async (node: TrustNode) => {',
    'const handleEdgeSelect = (edge: TrustEdge) => {\n    setSelectedEdge(edge);\n    setSelectedNode(null);\n    setGraphMode(\'expanded\');\n  };\n\n  const handleNodeSelect = async (node: TrustNode) => {'
)

# And fix line 667 'createdBy' -> 'origin'
text = text.replace("createdBy === 'manual'", "origin === 'manual'")
text = text.replace("createdBy === 'semantic_ai'", "origin === 'automatic'")

with open("src/app/page.tsx", "w", encoding="utf-8") as f:
    f.write(text)
