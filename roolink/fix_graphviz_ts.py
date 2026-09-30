with open("src/components/GraphViz.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# Fix duplicate onEdgeSelect in interface
# It probably looks like:
# onNodeSelect: (node: TrustNode) => void;
#   onEdgeSelect?: (edge: TrustEdge) => void;
#     onEdgeSelect?: (edge: TrustEdge) => void;
import re
text = re.sub(r'(onEdgeSelect\?: \(edge: TrustEdge\) => void;\s*)+', 'onEdgeSelect?: (edge: TrustEdge) => void;\n', text)

text = re.sub(r'const callbacksRef = useRef\(\{ onNodeSelect, onEdgeSelect, onEdgeSelect, setTooltip \}\);', 'const callbacksRef = useRef({ onNodeSelect, onEdgeSelect, setTooltip });', text)
text = re.sub(r'callbacksRef.current = \{ onNodeSelect, onEdgeSelect, onEdgeSelect, setTooltip \};', 'callbacksRef.current = { onNodeSelect, onEdgeSelect, setTooltip };', text)

text = text.replace('d as TrustEdge', 'd as unknown as TrustEdge')
text = text.replace('d.origin', '(d as any).origin')

with open("src/components/GraphViz.tsx", "w", encoding="utf-8") as f:
    f.write(text)
