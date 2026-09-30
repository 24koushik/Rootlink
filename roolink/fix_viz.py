import re

with open('src/components/MindMapViz.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("let zoomGroup = svg.select('g.zoom-group');", "let zoomGroup: any = svg.select('g.zoom-group');")

with open('src/components/MindMapViz.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed zoomGroup typing.")
