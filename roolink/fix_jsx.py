import re

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Let's fix the broken JSX.
# It seems ctiveTab === 'sources' is broken:
sources_old = '''{activeTab === 'sources' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {selectedNode.sourceReferences?.map((ref, idx) => (
                    <div key={idx} className="card-shell" style={{ padding: '16px', background: 'rgba(0,0,0,0.1)' }}>
                      <a href={ref.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', wordBreak: 'break-all' }}>{ref.url}</a>
                      <p style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 8, fontFamily: 'monospace' }}>{ref.contextSnippet}</p>
                    </div>
                  ))}
  
              

              </div>
              )}'''

sources_new = '''{activeTab === 'sources' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {selectedNode.sourceReferences?.map((ref: any, idx: number) => (
                    <div key={idx} className="card-shell" style={{ padding: '16px', background: 'rgba(0,0,0,0.1)' }}>
                      <a href={ref.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', wordBreak: 'break-all' }}>{ref.url}</a>
                      <p style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 8, fontFamily: 'monospace' }}>{ref.contextSnippet}</p>
                    </div>
                  ))}
                </div>
              )}'''

code = code.replace(sources_old, sources_new)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed activeTab sources.")
