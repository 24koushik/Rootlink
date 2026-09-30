import re

with open('src/app/api/nodes/route.ts', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace('graphData.nodes.find(n =>', 'graphData.nodes.find((n: any) =>')
code = code.replace('graphData.nodes.filter(n =>', 'graphData.nodes.filter((n: any) =>')

with open('src/app/api/nodes/route.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed implicit any.")
