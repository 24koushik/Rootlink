with open("src/components/GraphViz.tsx", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace(
    "export default function GraphViz({ nodes: rawNodes, edges: rawEdges = [], onNodeSelect, selectedNodeId, searchQuery = '' }: GraphVizProps) {",
    "export default function GraphViz({ nodes: rawNodes, edges: rawEdges = [], onNodeSelect, onEdgeSelect, selectedNodeId, searchQuery = '' }: GraphVizProps) {"
)

with open("src/components/GraphViz.tsx", "w", encoding="utf-8") as f:
    f.write(text)
