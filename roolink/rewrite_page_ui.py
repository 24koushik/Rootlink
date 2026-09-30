import re

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add AlertCircle
text = text.replace('import { BrainCircuit, Link2, ExternalLink, RefreshCw, X, PlaySquare, Clock, Search, Network } from \'lucide-react\';',
                    'import { BrainCircuit, Link2, ExternalLink, RefreshCw, X, PlaySquare, Clock, Search, Network, AlertCircle } from \'lucide-react\';')

# Find the TABS area
tabs_str = """                {/* TABS */}
                <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px', marginBottom: '32px' }}>"""

new_tabs_str = """                {/* AI PROCESSING STATUS */}
                {selectedNode.processingStatus === 'processing' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(53, 214, 199, 0.1)', border: '1px solid rgba(53, 214, 199, 0.3)', borderRadius: '12px', marginBottom: '24px' }}>
                    <RefreshCw size={20} color="var(--primary)" className="animate-spin" />
                    <span style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 600 }}>Building knowledge with AI...</span>
                  </div>
                )}
                {selectedNode.processingStatus === 'failed' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', marginBottom: '24px' }}>
                    <AlertCircle size={20} color="#ef4444" />
                    <span style={{ fontSize: '14px', color: '#ef4444', fontWeight: 600 }}>AI processing failed</span>
                    <button onClick={async () => {
                      showToast('Retrying AI processing...');
                      await fetch('/api/nodes/retry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodeId: selectedNode.id }) });
                      fetchGraph();
                    }} style={{ marginLeft: 'auto', background: 'rgba(239, 68, 68, 0.2)', border: 'none', padding: '8px 16px', borderRadius: '8px', color: '#fca5a5', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Retry AI</button>
                  </div>
                )}

                {/* TABS */}
                <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px', marginBottom: '32px' }}>"""

text = text.replace(tabs_str, new_tabs_str)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
