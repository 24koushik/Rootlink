import re

with open('src/app/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

bad = '''                </details>
              )}


              

              </div>
              )}



              
              {activeTab === 'mindmap' && (() => {'''

good = '''                </details>
              )}



              
              {activeTab === 'mindmap' && (() => {'''

code = code.replace(bad, good)

with open('src/app/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Removed extra closing tags.")
