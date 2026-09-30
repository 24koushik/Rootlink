import re

with open("src/lib/graph.ts", "r", encoding="utf-8") as f:
    text = f.read()

# Replace the ProvenanceGraph class
old_graph_class_match = re.search(r'class ProvenanceGraph \{.*?\nexport const globalGraph = new ProvenanceGraph\(\);', text, flags=re.DOTALL)
if not old_graph_class_match:
    print("Could not find ProvenanceGraph class")
    exit(1)

new_graph_class = """class ProvenanceGraph {
  public nodes: TrustNode[] = [];
  public edges: TrustEdge[] = [];
  public suppressedLinks = new Set<string>(); // Stores pair keys like "nodeA:nodeB"

  private getPairKey(a: string, b: string) {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }

  addScrapedDataToGraph(pageSubject: Partial<TrustNode>, extractedEntities: Partial<TrustNode>[]): { nodes: TrustNode[], edges: TrustEdge[] } {
    const pageSubjectId = generateDeterministicId(pageSubject.canonicalName || '', pageSubject.sourceUrl, pageSubject.videoId);
    const allEntities = [pageSubject, ...extractedEntities];
    this.nodes = processIncomingEntities(allEntities, this.nodes);
    this.edges = generateEdgesFromPage(pageSubjectId, extractedEntities, this.edges);
    return { nodes: this.nodes, edges: this.edges };
  }

  updateNode(id: string, updatedFields: Partial<TrustNode>) {
    const idx = this.nodes.findIndex(n => n.id === id);
    if (idx >= 0) {
      this.nodes[idx] = { ...this.nodes[idx], ...updatedFields };
    }
  }

  linkNodesManually(sourceId: string, targetId: string, label: string = "Related") {
    if (sourceId === targetId) throw new Error("Cannot link node to itself");
    const edgeId = `manual-${sourceId}-${targetId}`;
    
    // Remove any automatic edges between them
    this.edges = this.edges.filter(e => !(
      (e.sourceId === sourceId && e.targetId === targetId) ||
      (e.sourceId === targetId && e.targetId === sourceId)
    ) || e.origin === 'manual');

    if (!this.edges.some(e => e.id === edgeId)) {
      this.edges.push({
        id: edgeId,
        sourceId,
        targetId,
        relationshipType: label,
        confidence: 1.0,
        origin: 'manual',
        createdAt: Date.now()
      });
    }
  }

  removeLink(sourceId: string, targetId: string) {
    const edgesToRemove = this.edges.filter(e => 
      (e.sourceId === sourceId && e.targetId === targetId) ||
      (e.sourceId === targetId && e.targetId === sourceId)
    );

    for (const edge of edgesToRemove) {
      if (edge.origin === 'automatic') {
        this.suppressedLinks.add(this.getPairKey(sourceId, targetId));
      }
    }

    this.edges = this.edges.filter(e => 
      !(e.sourceId === sourceId && e.targetId === targetId) &&
      !(e.sourceId === targetId && e.targetId === sourceId)
    );
  }

  recalculateAutomaticLinks() {
    // 1. Clear all existing automatic links
    this.edges = this.edges.filter(e => e.origin === 'manual' || e.relationshipType === 'co_mentioned');

    const JACCARD_THRESHOLD = 0.20; // Tuneable
    const MAX_LINKS = 8;

    // Helper to extract tokens
    const tokenize = (arr: string[] = []) => new Set(
      arr.map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()).filter(s => s.length > 0)
    );

    const calcJaccard = (a: Set<string>, b: Set<string>) => {
      if (a.size === 0 && b.size === 0) return 0;
      let intersection = 0;
      for (const item of Array.from(a)) {
        if (b.has(item)) intersection++;
      }
      return intersection / (a.size + b.size - intersection);
    };

    // Calculate profiles
    const profiles = this.nodes.map(n => {
      const sp = n.semanticProfile || { concepts: [], keywords: [], topics: [] };
      return {
        id: n.id,
        concepts: tokenize(sp.concepts),
        keywords: tokenize(sp.keywords),
        topics: tokenize(sp.topics)
      };
    });

    // Score all pairs
    const newEdges = [];
    
    for (let i = 0; i < profiles.length; i++) {
      let nodeEdges = [];
      for (let j = i + 1; j < profiles.length; j++) {
        const p1 = profiles[i];
        const p2 = profiles[j];
        
        // Skip if suppressed
        if (this.suppressedLinks.has(this.getPairKey(p1.id, p2.id))) continue;
        
        // Skip if manual link exists
        const hasManual = this.edges.some(e => 
          e.origin === 'manual' && 
          ((e.sourceId === p1.id && e.targetId === p2.id) || (e.sourceId === p2.id && e.targetId === p1.id))
        );
        if (hasManual) continue;

        const conceptScore = calcJaccard(p1.concepts, p2.concepts);
        const keywordScore = calcJaccard(p1.keywords, p2.keywords);
        const topicScore = calcJaccard(p1.topics, p2.topics);

        // Weighted score
        const score = (conceptScore * 0.6) + (keywordScore * 0.3) + (topicScore * 0.1);

        if (score >= JACCARD_THRESHOLD) {
          // Generate reason
          const reasons = [];
          const sharedConcepts = Array.from(p1.concepts).filter(c => p2.concepts.has(c));
          if (sharedConcepts.length > 0) reasons.push(`Shared concepts: ${sharedConcepts.slice(0,3).join(", ")}`);
          
          nodeEdges.push({
            id: `semantic-${p1.id}-${p2.id}`,
            sourceId: p1.id,
            targetId: p2.id,
            relationshipType: 'semantic_link',
            confidence: score,
            origin: 'automatic' as const,
            reason: reasons.length > 0 ? reasons : ["Semantic overlap"],
            createdAt: Date.now()
          });
        }
      }
      
      // Keep only top MAX_LINKS for node i
      nodeEdges.sort((a, b) => b.confidence - a.confidence);
      newEdges.push(...nodeEdges.slice(0, MAX_LINKS));
    }

    // Add new edges
    this.edges.push(...newEdges);
  }

  markDebunked(nodeId: string) {
    const nodeIndex = this.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex >= 0) {
      this.nodes = [
        ...this.nodes.slice(0, nodeIndex),
        { ...this.nodes[nodeIndex], trustScore: 0, verificationStatus: 'debunked' as const },
        ...this.nodes.slice(nodeIndex + 1)
      ];
    }
  }

  deleteNode(nodeId: string) {
    this.nodes = this.nodes.filter(n => n.id !== nodeId);
    this.edges = this.edges.filter(e => e.sourceId !== nodeId && e.targetId !== nodeId);
  }

  getChainSummaries(nodeId: string): string[] {
    const relatedEdges = this.edges.filter(e => e.sourceId === nodeId || e.targetId === nodeId);
    const relatedIds = relatedEdges.map(e => e.sourceId === nodeId ? e.targetId : e.sourceId);
    
    return this.nodes
      .filter(n => relatedIds.includes(n.id) && n.structuredSummary && n.structuredSummary.overview)
      .map(n => n.structuredSummary.overview as string);
  }

  getGraphData() {
    return { nodes: this.nodes, edges: this.edges };
  }
}

export const globalGraph = new ProvenanceGraph();"""

text = text.replace(old_graph_class_match.group(0), new_graph_class)

with open("src/lib/graph.ts", "w", encoding="utf-8") as f:
    f.write(text)
