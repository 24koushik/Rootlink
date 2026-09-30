# -*- coding: utf-8 -*-
import re

with open("src/app/page.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# Add selectedEdge state
text = text.replace(
    'const [selectedNode, setSelectedNode] = useState<TrustNode | null>(null);',
    'const [selectedNode, setSelectedNode] = useState<TrustNode | null>(null);\n  const [selectedEdge, setSelectedEdge] = useState<TrustEdge | null>(null);'
)

# Update onNodeSelect to clear selectedEdge
text = text.replace(
    'setSelectedNode(node);',
    'setSelectedNode(node);\n    setSelectedEdge(null);'
)

# Update onEdgeSelect handler in Dashboard
text = text.replace(
    'const handleNodeSelect = (node: TrustNode) => {',
    'const handleEdgeSelect = (edge: TrustEdge) => {\n    setSelectedEdge(edge);\n    setSelectedNode(null);\n    setGraphMode(\'expanded\');\n  };\n\n  const handleNodeSelect = (node: TrustNode) => {'
)

# Pass onEdgeSelect to GraphViz
text = text.replace(
    '<GraphViz nodes={nodes} edges={edges} onNodeSelect={handleNodeSelect} selectedNodeId={selectedNode?.id} searchQuery={searchQuery} />',
    '<GraphViz nodes={nodes} edges={edges} onNodeSelect={handleNodeSelect} onEdgeSelect={handleEdgeSelect} selectedNodeId={selectedNode?.id} searchQuery={searchQuery} />'
)

# Now, add the UI for selectedEdge
edge_ui = """
        {/* RELATIONSHIP PANEL */}
        {selectedEdge && (
          <div className="scrollable-panel" style={{ width: '400px', background: 'rgba(0, 0, 0, 0.65)', borderLeft: '1px solid var(--border-glass)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', flexShrink: 0, position: 'relative', overflowY: 'auto' }}>
            <button onClick={() => setSelectedEdge(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-disabled)', cursor: 'pointer' }}><X size={20} /></button>
            
            <div>
              <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Relationship</h2>
              
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ color: 'white', fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{nodes.find((n: any) => n.id === selectedEdge.sourceId)?.canonicalName || 'Source'}</div>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}><Network size={16} color="var(--primary)" /></div>
                <div style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>{nodes.find((n: any) => n.id === selectedEdge.targetId)?.canonicalName || 'Target'}</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginBottom: 4 }}>Type</div>
              <div style={{ fontSize: 14, color: 'white', textTransform: 'capitalize' }}>
                {selectedEdge.origin === 'automatic' ? 'Automatic Semantic Link' : 'Manual Connection'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginBottom: 4 }}>Confidence / Strength</div>
              <div style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>{Math.round(selectedEdge.confidence * 100)}%</div>
            </div>

            {selectedEdge.reason && selectedEdge.reason.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginBottom: 8 }}>Why</div>
                <ul style={{ listStyle: 'circle', paddingLeft: 20, margin: 0, color: 'var(--text-body)', fontSize: 13 }}>
                  {selectedEdge.reason.map((r: string, i: number) => (
                    <li key={i} style={{ marginBottom: 4 }}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginBottom: 12 }}>Actions</div>
              <button 
                onClick={async () => {
                  try {
                    const res = await fetch('/api/link', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ sourceId: selectedEdge.sourceId, targetId: selectedEdge.targetId })
                    });
                    if (res.ok) {
                      showToast('Connection removed');
                      setSelectedEdge(null);
                      fetchGraph();
                    }
                  } catch (err) {}
                }}
                style={{ width: '100%', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                Remove Connection
              </button>
            </div>
          </div>
        )}
"""

# Insert edge_ui right before the node detail panel
text = text.replace(
    '{/* NODE DETAILS PANEL */}\n        {selectedNode && (',
    edge_ui + '\n        {/* NODE DETAILS PANEL */}\n        {selectedNode && ('
)

# And add the "Related knowledge" to the Node Details Summary tab
related_knowledge_ui = """
                    {/* RELATED KNOWLEDGE (SEMANTIC LINKS) */}
                    <div className="card-shell" style={{ padding: '20px', background: 'transparent', marginTop: 16 }}>
                      <h3 style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 16 }}>Related Knowledge</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {edges.filter((e: any) => e.sourceId === selectedNode.id || e.targetId === selectedNode.id).map((edge: any) => {
                          const otherId = edge.sourceId === selectedNode.id ? edge.targetId : edge.sourceId;
                          const otherNode = nodes.find((n: any) => n.id === otherId);
                          if (!otherNode) return null;
                          return (
                            <div key={edge.id} style={{ display: 'flex', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleNodeSelect(otherNode as TrustNode)}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, color: 'white', fontWeight: 600 }}>{otherNode.canonicalName}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 4 }}>
                                  {Math.round(edge.confidence * 100)}% &bull; <span style={{ textTransform: 'capitalize' }}>{edge.origin}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {edges.filter((e: any) => e.sourceId === selectedNode.id || e.targetId === selectedNode.id).length === 0 && (
                          <div style={{ fontSize: 13, color: 'var(--text-disabled)', fontStyle: 'italic' }}>No related knowledge found yet.</div>
                        )}
                      </div>
                    </div>
"""

text = text.replace(
    '{/* MAIN CONCEPTS & SECTIONS */}',
    related_knowledge_ui + '\n                    {/* MAIN CONCEPTS & SECTIONS */}'
)

with open("src/app/page.tsx", "w", encoding="utf-8") as f:
    f.write(text)
