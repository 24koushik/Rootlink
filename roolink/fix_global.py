with open("src/lib/graph.ts", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace(
    'export const globalGraph = globalAny._globalGraph || new ProvenanceGraph();',
    'export const globalGraph = new ProvenanceGraph();\n// Migrate old data if exists\nif (globalAny._globalGraph) {\n  globalGraph.nodes = globalAny._globalGraph.nodes || [];\n  globalGraph.edges = globalAny._globalGraph.edges || [];\n}'
)

with open("src/lib/graph.ts", "w", encoding="utf-8") as f:
    f.write(text)
