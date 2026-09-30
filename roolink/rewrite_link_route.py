with open("src/app/api/link/route.ts", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("globalGraph.unlinkNodes(sourceId, targetId);", "globalGraph.removeLink(sourceId, targetId);")

with open("src/app/api/link/route.ts", "w", encoding="utf-8") as f:
    f.write(text)
