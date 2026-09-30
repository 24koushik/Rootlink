with open("src/components/GraphViz.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# Replace createdBy with origin
text = text.replace("d.createdBy === 'semantic_ai'", "d.origin === 'automatic'")
text = text.replace("d.createdBy === 'manual'", "d.origin === 'manual'")

with open("src/components/GraphViz.tsx", "w", encoding="utf-8") as f:
    f.write(text)
