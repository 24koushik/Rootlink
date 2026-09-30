with open("src/components/GraphViz.tsx", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace(
    'onNodeSelect: (node: TrustNode) => void;',
    'onNodeSelect: (node: TrustNode) => void;\n  onEdgeSelect?: (edge: TrustEdge) => void;'
)

text = text.replace(
    'export default function GraphViz({ nodes: rawNodes, edges: rawEdges = [], onNodeSelect, selectedNodeId, searchQuery }: GraphVizProps) {',
    'export default function GraphViz({ nodes: rawNodes, edges: rawEdges = [], onNodeSelect, onEdgeSelect, selectedNodeId, searchQuery }: GraphVizProps) {'
)

text = text.replace(
    'onNodeSelect: (node: TrustNode) => void;',
    'onNodeSelect: (node: TrustNode) => void;\n    onEdgeSelect?: (edge: TrustEdge) => void;'
)

# And in callbacksRef:
text = text.replace(
    'const callbacksRef = useRef({ onNodeSelect, setTooltip });',
    'const callbacksRef = useRef({ onNodeSelect, onEdgeSelect, setTooltip });'
)
text = text.replace(
    'callbacksRef.current = { onNodeSelect, setTooltip };',
    'callbacksRef.current = { onNodeSelect, onEdgeSelect, setTooltip };'
)

# Now add click handler to edge paths in GraphViz
join_path_str = ".join('path')\n      .attr('class', 'edge-path')"
new_join_path = ".join('path')\n      .attr('class', 'edge-path')\n      .style('cursor', 'pointer')\n      .on('click', (event, d) => { event.stopPropagation(); if(callbacksRef.current.onEdgeSelect) callbacksRef.current.onEdgeSelect(d as TrustEdge); })"

text = text.replace(join_path_str, new_join_path)

with open("src/components/GraphViz.tsx", "w", encoding="utf-8") as f:
    f.write(text)
