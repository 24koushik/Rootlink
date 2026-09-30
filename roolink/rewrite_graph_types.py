import re

with open("src/lib/graph.ts", "r", encoding="utf-8") as f:
    text = f.read()

# Add SemanticProfile interface
semantic_profile = """
export interface SemanticProfile {
  concepts: string[];
  keywords: string[];
  topics: string[];
}
"""
text = text.replace("export interface TrustNode {", semantic_profile + "\nexport interface TrustNode {\n  semanticProfile?: SemanticProfile;")

# Update TrustEdge
edge_replacement = """export interface TrustEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: string;
  confidence: number; // 0 to 1
  origin: 'automatic' | 'manual';
  reason?: string[];
  createdAt: number;
}"""

text = re.sub(r'export interface TrustEdge \{.*?\n\}', edge_replacement, text, flags=re.DOTALL)

with open("src/lib/graph.ts", "w", encoding="utf-8") as f:
    f.write(text)
