import { v4 as uuidv4 } from 'uuid';

export interface SourceReference {
  url: string;
  contextSnippet: string;
  timestamp: number;
}


export interface MindMapChild {
  title: string;
  points: string[];
}

export interface MindMapBranch {
  title: string;
  description?: string;
  points: string[];
  children?: MindMapChild[];
}

export interface MindMap {
  title: string;
  description: string;
  branches: MindMapBranch[];
}

export interface StructuredSummary {
  keyInsights: string[];
  sections: { heading: string; points: string[] }[];
  formulas: { label: string; latex: string; context: string }[];
}

export interface Formula {
  type: string;
  latex: string;
  surroundingContext: string;
}

export interface WorkedProblem {
  problemStatement: string;
  givenValues: string;
  solutionSteps: string[];
  finalAnswer: string;
}

export interface KeyMoment {
  timestampSeconds: number;
  timestampFormatted: string;
  insight: string;
  transcriptExcerpt: string;
}


export interface SemanticProfile {
  concepts: string[];
  keywords: string[];
  topics: string[];
}

export interface TrustNode {
  semanticProfile?: SemanticProfile;
  captureStatus?: 'idle' | 'capturing' | 'captured' | 'failed';
  processingStatus?: 'idle' | 'processing' | 'completed' | 'failed';
  id: string; // Deterministic slug or URL
  canonicalName: string;
  type: string; // e.g. "movie", "person", "concept", "page", "youtube_video"
  sourceUrl?: string; // Canonical URL if available
  trustScore: number; // Aggregated score 0-1
  mentionCount: number;
  firstSeen: number;
  lastSeen: number;
  verificationStatus: 'high-trust' | 'med-trust' | 'low-trust' | 'debunked' | 'unverified';
  sourceReferences: SourceReference[];
  structuredSummary?: any;
  mindMap?: MindMap;
  formulas?: Formula[];
  workedProblems?: WorkedProblem[];
  
  // YouTube Video specifics
  videoId?: string;
  channelName?: string;
  durationSeconds?: number;
  publishedDate?: string;
  transcriptSource?: 'manual' | 'auto-generated' | 'unavailable';
  keyMoments?: KeyMoment[];
}

export interface TrustEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: string;
  confidence: number; // 0 to 1
  origin: 'automatic' | 'manual';
  reason?: string[];
  createdAt: number;
}

// ------------------------------------------------------------------
// PURE DEDUPLICATION & AGGREGATION ENGINE
// ------------------------------------------------------------------

export function generateDeterministicId(name: string, url?: string, videoId?: string): string {
  if (videoId) return `yt-${videoId}`;
  
  if (url && url.trim().length > 0) {
    try {
      const parsedUrl = new URL(url);
      // Remove trailing slash, protocol, and common prefixes for stability
      let cleanUrl = parsedUrl.hostname + parsedUrl.pathname;
      cleanUrl = cleanUrl.replace(/^www\./, '').replace(/\/$/, '');
      return cleanUrl.toLowerCase();
    } catch {
      // Fallback to name slugification if URL is invalid
    }
  }

  // Slugify name
  let slug = name.toLowerCase()
    .replace(/ - wikipedia$/, '')
    .replace(/: the revenge.*/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  
  return slug || uuidv4();
}

export function calculateAggregateTrust(existingScore: number, existingCount: number, newScore: number): number {
  // Weighted running average that slightly favors newer/repeated mentions
  // Cap the confidence boost to avoid 100% just from blind repetition
  const totalWeight = existingCount + 1;
  const rawAverage = ((existingScore * existingCount) + newScore) / totalWeight;
  
  // Apply a small log-based confidence boost for repetition
  const repetitionBoost = Math.min(0.15, Math.log10(totalWeight) * 0.05);
  return Math.min(1.0, rawAverage + repetitionBoost);
}

export function processIncomingEntities(newEntities: Partial<TrustNode>[], currentNodes: TrustNode[]): TrustNode[] {
  // Create a deep copy map for pure updates
  const nodeMap = new Map<string, TrustNode>(currentNodes.map(n => [n.id, { ...n, sourceReferences: [...n.sourceReferences] }]));

  for (const entity of newEntities) {
    const canonicalName = entity.canonicalName || 'Unknown Entity';
    const id = generateDeterministicId(canonicalName, entity.sourceUrl, entity.videoId);
    
    const newRef: SourceReference = entity.sourceReferences?.[0] || {
      url: entity.sourceUrl || '',
      contextSnippet: 'Extracted mention',
      timestamp: Date.now()
    };

    const newTrust = entity.trustScore ?? 0.5;

    if (nodeMap.has(id)) {
      // UPDATE EXISTING NODE
      const existing = nodeMap.get(id)!;
      existing.mentionCount += 1;
      existing.trustScore = calculateAggregateTrust(existing.trustScore, existing.mentionCount - 1, newTrust);
      existing.lastSeen = Date.now();
      
      // Update verification status based on new score
      if (existing.verificationStatus !== 'debunked') {
        if (existing.trustScore >= 0.75) existing.verificationStatus = 'high-trust';
        else if (existing.trustScore >= 0.5) existing.verificationStatus = 'med-trust';
        else existing.verificationStatus = 'low-trust';
      }

      // Append provenance safely
      if (!existing.sourceReferences.some(r => r.url === newRef.url && r.contextSnippet === newRef.contextSnippet)) {
        existing.sourceReferences.push(newRef);
      }

      // Merge rich data if newly provided
      if (entity.structuredSummary) existing.structuredSummary = entity.structuredSummary;
      if ((entity as any).mindMap) existing.mindMap = (entity as any).mindMap;
      if (entity.formulas) existing.formulas = entity.formulas;
      if (entity.workedProblems) existing.workedProblems = entity.workedProblems;
      if (entity.keyMoments) existing.keyMoments = entity.keyMoments;
      if (entity.durationSeconds) existing.durationSeconds = entity.durationSeconds;
      if (entity.channelName) existing.channelName = entity.channelName;
    } else {
      // CREATE NEW NODE
      nodeMap.set(id, {
        id,
        canonicalName,
        type: entity.type || 'concept',
        sourceUrl: entity.sourceUrl,
        trustScore: newTrust,
        mentionCount: 1,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        verificationStatus: newTrust >= 0.75 ? 'high-trust' : newTrust >= 0.5 ? 'med-trust' : 'low-trust',
        sourceReferences: [newRef],
        structuredSummary: entity.structuredSummary,
        mindMap: (entity as any).mindMap,
      });
    }
  }

  return Array.from(nodeMap.values());
}

export function generateEdgesFromPage(pageSubjectNodeId: string, extractedEntities: Partial<TrustNode>[], currentEdges: TrustEdge[]): TrustEdge[] {
  const edgeMap = new Map<string, TrustEdge>(currentEdges.map(e => [e.id, { ...e }]));

  for (const entity of extractedEntities) {
    const targetId = generateDeterministicId(entity.canonicalName || '', entity.sourceUrl, entity.videoId);
    if (targetId === pageSubjectNodeId) continue;

    const edgeId = `${pageSubjectNodeId}-${targetId}`;
    const reverseEdgeId = `${targetId}-${pageSubjectNodeId}`;

    if (edgeMap.has(edgeId)) {
      const existing = edgeMap.get(edgeId)!;
      existing.confidence = Math.min(1.0, existing.confidence + 0.1);
    } else if (edgeMap.has(reverseEdgeId)) {
      const existing = edgeMap.get(reverseEdgeId)!;
      existing.confidence = Math.min(1.0, existing.confidence + 0.1);
    } else {
      edgeMap.set(edgeId, {
        id: edgeId,
        sourceId: pageSubjectNodeId,
        targetId: targetId,
        relationshipType: 'co_mentioned',
        confidence: entity.trustScore || 0.5,
        origin: 'automatic',
        createdAt: Date.now()
      });
    }
  }

  return Array.from(edgeMap.values());
}

// ------------------------------------------------------------------
// GLOBAL STATE STORE (In-Memory Backend)
// ------------------------------------------------------------------

class ProvenanceGraph {
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
    // 1. Clear all existing automatic links except co_mentioned which are from extraction
    this.edges = this.edges.filter(e => e.origin === 'manual' || e.relationshipType === 'co_mentioned');

    const JACCARD_THRESHOLD = 0.15; // Tuneable
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
          else if (score >= JACCARD_THRESHOLD) reasons.push("Semantic overlap in topics and keywords");
          
          nodeEdges.push({
            id: `semantic-${p1.id}-${p2.id}`,
            sourceId: p1.id,
            targetId: p2.id,
            relationshipType: 'semantic_link',
            confidence: score,
            origin: 'automatic' as const,
            reason: reasons,
            createdAt: Date.now()
          });
        }
      }
      
      // Keep only top MAX_LINKS for node i
      nodeEdges.sort((a, b) => b.confidence - a.confidence);
      newEdges.push(...nodeEdges.slice(0, MAX_LINKS));
    }

    // Add new edges (deduplicating them since A->B and B->A will generate same edge if we iterate i then j)
    // Wait, the loop does `for(let i=0) { for(let j=i+1) }`, so we don't duplicate.
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
const globalAny: any = globalThis;
export const globalGraph = new ProvenanceGraph();
// Migrate old data if exists
if (globalAny._globalGraph) {
  globalGraph.nodes = globalAny._globalGraph.nodes || [];
  globalGraph.edges = globalAny._globalGraph.edges || [];
}
if (process.env.NODE_ENV !== 'production') {
  globalAny._globalGraph = globalGraph;
}
