import re

with open("src/app/api/nodes/route.ts", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("let createdNode = graphData.nodes.find((n: any) => n.id === exactId);", "let createdNode: any = graphData.nodes.find((n: any) => n.id === exactId);")

with open("src/app/api/nodes/route.ts", "w", encoding="utf-8") as f:
    f.write(text)
