import re

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

bad = '''    // Normalize summary data for the UI
  const canonicalSummary = selectedNode ? normalizeStructuredSummary(selectedNode) : { overview: "", sections: [], keyTakeaways: [] };
  
  return () => {'''

good = '''  return () => {'''

code = code.replace(bad, good)

bad_dashboard = '''export default function Dashboard() {
  const [rawNodes, setRawNodes] = useState<TrustNode[]>([]);
  const [rawEdges, setRawEdges] = useState<TrustEdge[]>([]);
  const { nodes, edges } = useThrottledGraphState(rawNodes, rawEdges, 1000);
  
  const [selectedNode, setSelectedNode] = useState<TrustNode | null>(null);'''

good_dashboard = '''export default function Dashboard() {
  const [rawNodes, setRawNodes] = useState<TrustNode[]>([]);
  const [rawEdges, setRawEdges] = useState<TrustEdge[]>([]);
  const { nodes, edges } = useThrottledGraphState(rawNodes, rawEdges, 1000);
  
  const [selectedNode, setSelectedNode] = useState<TrustNode | null>(null);
  const canonicalSummary = selectedNode ? normalizeStructuredSummary(selectedNode) : { overview: "", sections: [], keyTakeaways: [] };'''

code = code.replace(bad_dashboard, good_dashboard)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Moved canonicalSummary declaration.")
