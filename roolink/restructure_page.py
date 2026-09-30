import re

def main():
    with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Replace empty state
    old_empty = """          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', textAlign: 'center',
              gap: 'var(--space-3)', color: 'var(--text-disabled)',
            }}>
              <Network size={64} style={{ opacity: 0.2 }} strokeWidth={1} />
              <div style={{ fontSize: '14px', maxWidth: '240px', lineHeight: 1.6, fontWeight: 500, letterSpacing: '0.02em', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ display: 'block', textAlign: 'center' }}>Select a glowing node in the nebula to view its provenance.</span>
              </div>
            </div>
          )}"""

    new_empty = """          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', textAlign: 'center',
              gap: '24px', color: 'var(--text-disabled)',
            }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '0.1em' }}>ROOTLINK</div>
              <div style={{ fontSize: '16px', maxWidth: '300px', lineHeight: 1.6 }}>
                Capture knowledge from the web.
                <br/><br/>
                Click the Capture Orb on any webpage or YouTube video to begin.
              </div>
              <button style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: 'var(--primary-light)', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>How it works</button>
            </div>
          )}"""
    
    content = content.replace(old_empty, new_empty)

    # 2. Extract Link Nodes Tool and remove it from aside
    link_tool_pattern = re.compile(r'\{\/\* Link Nodes Tool \*\/.*?<\/div>\n      <\/aside>', re.DOTALL)
    
    link_tool_modal = """
      {/* Link Nodes Modal */}
      {isLinkingModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(10px)'
        }}>
          <div className="liquid-glass" style={{ width: '400px', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Establish Knowledge Link</h3>
              <button onClick={() => setIsLinkingModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-disabled)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={(e) => { handleLinkNodes(e); setIsLinkingModalOpen(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SearchableSelect nodes={nodes} value={linkSource} onChange={setLinkSource} placeholder="Select Source Node..." />
              <SearchableSelect nodes={nodes} value={linkTarget} onChange={setLinkTarget} placeholder="Select Target Node..." />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsLinkingModalOpen(false)} style={{ padding: '10px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isLinking || !linkSource || !linkTarget} style={{ padding: '10px 16px', borderRadius: '8px', background: (isLinking || !linkSource || !linkTarget) ? 'var(--border-glass)' : 'var(--primary)', color: 'white', border: 'none', cursor: (isLinking || !linkSource || !linkTarget) ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Create Link</button>
              </div>
            </form>
          </div>
        </div>
      )}
"""
    
    content = re.sub(link_tool_pattern, '</aside>', content)

    # 3. Add isLinkingModalOpen state
    content = content.replace("const [isLinking, setIsLinking] = useState(false);", "const [isLinking, setIsLinking] = useState(false);\n  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);")

    # 4. Inject modal at the end of the root div
    content = content.replace("{/* Custom Delete Confirmation Modal */}", link_tool_modal + "\n      {/* Custom Delete Confirmation Modal */}")

    # 5. Redesign the Knowledge Graph panel
    old_main_pattern = re.compile(r'\{\/\* SECONDARY WORKSPACE: Knowledge Graph \*\/\}.*?<\/main>', re.DOTALL)
    
    new_main = """      {/* SECONDARY WORKSPACE: Knowledge Graph */}
      <main 
        className="relative flex flex-col liquid-glass transition-all duration-300" 
        style={{ 
          height: '100%', 
          flex: graphMode === 'expanded' ? '1' : graphMode === 'hidden' ? '0' : '2.8',
          display: graphMode === 'hidden' ? 'none' : 'flex',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
           <div>
             <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Knowledge Graph</h2>
           </div>
           <div style={{ display: 'flex', gap: 8 }}>
             {graphMode === 'expanded' ? (
                <button onClick={() => setGraphMode('normal')} style={{ background: 'rgba(0,0,0,0.4)', border: 'none', color: 'white', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Shrink Graph</button>
             ) : (
                <button onClick={() => setGraphMode('expanded')} style={{ background: 'rgba(0,0,0,0.4)', border: 'none', color: 'white', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>⛶ Expand</button>
             )}
           </div>
        </div>

        {/* Search Bar Inline */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)' }}>
          <Search size={16} color="var(--text-disabled)" />
          <input 
            type="text"
            placeholder="Search knowledge..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '14px' }}
          />
          {searchQuery && <X size={16} color="var(--text-disabled)" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />}
        </div>
        
        {/* Graph Canvas */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          {nodes.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-disabled)', flexDirection: 'column', gap: '16px' }}>
              <Network size={48} style={{ opacity: 0.2 }} />
              <span style={{ fontSize: '13px' }}>Nebula is empty. Capture a source.</span>
            </div>
          ) : (
            <GraphViz nodes={nodes} edges={edges} onNodeSelect={handleNodeSelect} selectedNodeId={selectedNode?.id} searchQuery={searchQuery} />
          )}
        </div>

        {/* Bottom Statistics and Actions Inline */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)' }}>{nodes.length}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nodes</div>
            </div>
            <div style={{ width: 1, height: '24px', background: 'var(--border-glass)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)' }}>{edges.length}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Links</div>
            </div>
            <div style={{ width: 1, height: '24px', background: 'var(--border-glass)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)' }}>{Math.round(nodes.length ? (nodes.reduce((sum, n) => sum + n.trustScore, 0) / nodes.length * 100) : 0)}%</div>
              <div style={{ fontSize: '10px', color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Avg Trust</div>
            </div>
          </div>
          
          <button 
            onClick={() => setIsLinkingModalOpen(true)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-light)', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
          >
            <LinkIcon size={14} /> Establish Link
          </button>
        </div>
      </main>"""
      
    content = re.sub(old_main_pattern, new_main, content)

    # 6. Change flex: 7 to flex: 7.2 in aside
    content = content.replace("flex: graphMode === 'hidden' ? '1' : graphMode === 'expanded' ? '0' : '7',", "flex: graphMode === 'hidden' ? '1' : graphMode === 'expanded' ? '0' : '7.2',")

    with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__': main()
