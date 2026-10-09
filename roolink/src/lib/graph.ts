import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { sql } from '@vercel/postgres';

if (!process.env.POSTGRES_URL) {
  if (process.env.DATABASE_URL) process.env.POSTGRES_URL = process.env.DATABASE_URL;
  else if (process.env.STORAGE_URL) process.env.POSTGRES_URL = process.env.STORAGE_URL;
}

import path from 'path';

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
  public globalSummary: any = null;
  public globalSummaryHash: string = "";

// PERSISTENCE ENGINE (Vercel Postgres + Local Fallback)
  public async saveState() {
    try {
      if (typeof window !== 'undefined') return;
      
      const data = {
        nodes: this.nodes,
        edges: this.edges,
        suppressedLinks: Array.from(this.suppressedLinks)
      };

      // 1. Always save locally as a backup
      try {
        const dbPath = process.env.VERCEL ? path.join('/tmp', 'database.json') : path.join(process.cwd(), 'database.json');
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
      } catch (e) { console.log('Local save skipped (read-only FS)'); }

      // 2. If Vercel Postgres is connected, save to cloud
      if (process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.STORAGE_URL) {
        // Ensure table exists (fire and forget)
        await sql`
          CREATE TABLE IF NOT EXISTS graph_state (
            id INTEGER PRIMARY KEY,
            state JSONB NOT NULL
          )
        `;
        
        // Upsert state
        await sql`
          INSERT INTO graph_state (id, state)
          VALUES (1, ${JSON.stringify(data)}::jsonb)
          ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state
        `;
      }
    } catch (e) {
      console.error('Failed to save graph state:', e);
    }
  }

  private _isLoaded = false;
  public async ensureLoaded() {
    if (this._isLoaded) return;
    await this.loadState();
    this._isLoaded = true;
  }

  private async loadState() {
    try {
      if (typeof window !== 'undefined') return;
      
      let loadedData: any = null;

      // 1. Try Vercel Postgres first
      if (process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.STORAGE_URL) {
        try {
          await sql`
            CREATE TABLE IF NOT EXISTS graph_state (
              id INTEGER PRIMARY KEY,
              state JSONB NOT NULL
            )
          `;
          const result = await sql`SELECT state FROM graph_state WHERE id = 1`;
          if (result.rows.length > 0) {
            loadedData = result.rows[0].state;
            console.log("[KNOWLEDGE GRAPH] Loaded from Vercel Postgres!");
          }
        } catch (dbError) {
          console.error("Vercel Postgres load failed, falling back to local:", dbError);
        }
      }

      // 2. Fallback to Local JSON
      if (!loadedData) {
        const dbPath = process.env.VERCEL ? path.join('/tmp', 'database.json') : path.join(process.cwd(), 'database.json');
        if (fs.existsSync(dbPath)) {
          const raw = fs.readFileSync(dbPath, 'utf-8');
          loadedData = JSON.parse(raw);
          console.log("[KNOWLEDGE GRAPH] Loaded from local database.json!");
        }
      }

      if (loadedData) {
        this.nodes = loadedData.nodes || [];
        this.edges = loadedData.edges || [];
        if (loadedData.suppressedLinks) {
          this.suppressedLinks = new Set(loadedData.suppressedLinks);
        }
      }
    } catch (e) {
      console.error('Failed to load graph state:', e);
    }
  }

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
    this.saveState();
    return { nodes: this.nodes, edges: this.edges };
  }

  updateNode(id: string, updatedFields: Partial<TrustNode>) {
    const idx = this.nodes.findIndex(n => n.id === id);
    if (idx >= 0) {
      this.nodes[idx] = { ...this.nodes[idx], ...updatedFields };
        this.saveState();
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
   this.saveState();
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
    this.saveState();
  }

  
  deleteNode(id: string) {
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.edges = this.edges.filter(e => e.sourceId !== id && e.targetId !== id);
    this.saveState();
  }

  recalculateAutomaticLinks() {
    // 1. Clear all existing automatic links except co_mentioned which are from extraction
    this.edges = this.edges.filter(e => e.origin === 'manual' || e.relationshipType === 'co_mentioned');

    const JACCARD_THRESHOLD = 0.08; // Adjusted to be practical based on normalized multi-signal overlap
    const MAX_LINKS = 8;

    const tokenizeConcepts = (arr: string[] = [], fallbackText: string = "") => {
      const set = new Set<string>();
      
      const normalize = (text: string) => {
        let t = text.toLowerCase();
        t = t.replace(/object-oriented programming/g, 'oop').replace(/object oriented programming/g, 'oop');
        return t.replace(/[^a-z0-9]/g, ' ').trim();
      };
      
      for(let s of arr) {
        s = normalize(s);
        if (s.length > 0) set.add(s);
        // Add sub-words if multi-word concept
        const parts = s.split(/\s+/);
        if (parts.length > 1) {
          for(const p of parts) if (p.length > 3) set.add(p);
        }
      }
      
      if (fallbackText) {
        const text = normalize(fallbackText);
        const tokens = text.split(/\s+/).filter(s => s.length > 3);
        const stopwords = new Set(['this', 'that', 'with', 'from', 'what', 'your', 'about', 'there', 'their', 'which', 'would', 'could', 'have', 'been']);
        for(const t of tokens) {
          if (!stopwords.has(t)) set.add(t);
        }
      }
      return set;
    };

    const calcJaccard = (a: Set<string>, b: Set<string>) => {
      if (a.size === 0 && b.size === 0) return 0;
      let intersection = 0;
      for (const item of Array.from(a)) {
        if (b.has(item)) intersection++;
      }
      return intersection / (a.size + b.size - intersection);
    };

    // Calculate profiles with fallback extraction
    const profiles = this.nodes.map(n => {
      const sp = n.semanticProfile || { concepts: [], keywords: [], topics: [] };
      
      let fallbackText = "";
      if (!sp.concepts || sp.concepts.length === 0) {
         fallbackText = `${n.canonicalName} ${n.structuredSummary?.overview || ''} ${n.structuredSummary?.keyTakeaways?.join(' ') || ''}`;
      }
      
      return {
        id: n.id,
        concepts: tokenizeConcepts(sp.concepts || [], fallbackText),
        keywords: tokenizeConcepts(sp.keywords || [], ""),
        topics: tokenizeConcepts(sp.topics || [], "")
      };
    });

    const newEdges: any[] = [];
    
    for (let i = 0; i < profiles.length; i++) {
      let nodeEdges = [];
      for (let j = i + 1; j < profiles.length; j++) {
        const p1 = profiles[i];
        const p2 = profiles[j];
        
        if (this.suppressedLinks.has(this.getPairKey(p1.id, p2.id))) continue;
        
        const hasManual = this.edges.some(e => 
          e.origin === 'manual' && 
          ((e.sourceId === p1.id && e.targetId === p2.id) || (e.sourceId === p2.id && e.targetId === p1.id))
        );
        if (hasManual) continue;

        const conceptScore = calcJaccard(p1.concepts, p2.concepts);
        const keywordScore = calcJaccard(p1.keywords, p2.keywords);
        const topicScore = calcJaccard(p1.topics, p2.topics);

        const score = (conceptScore * 0.6) + (keywordScore * 0.3) + (topicScore * 0.1);

        if (score >= JACCARD_THRESHOLD) {
          const reasons = [];
          const sharedConcepts = Array.from(p1.concepts).filter(c => p2.concepts.has(c));
          if (sharedConcepts.length > 0) {
            // Capitalize for display
            const displayConcepts = sharedConcepts.slice(0,3).map(c => c.charAt(0).toUpperCase() + c.slice(1));
            reasons.push(`Shared concepts: ${displayConcepts.join(", ")}`);
          } else if (score >= JACCARD_THRESHOLD) {
             reasons.push("Semantic overlap in topics and keywords");
          }
          
          nodeEdges.push({
            id: `semantic-${this.getPairKey(p1.id, p2.id)}`,
            sourceId: p1.id,
            targetId: p2.id,
            relationshipType: 'semantic_link',
            confidence: score,
            origin: 'automatic',
            reason: reasons,
            createdAt: Date.now()
          });
        }
      }
      
      nodeEdges.sort((a, b) => b.confidence - a.confidence);
      newEdges.push(...nodeEdges.slice(0, MAX_LINKS));
    }

    // Deduplicate edges before pushing
    const edgeMap = new Map();
    for (const e of newEdges) edgeMap.set(e.id, e);
    
    this.edges.push(...Array.from(edgeMap.values()));
    this.saveState();
  }

  getChainSummaries(nodeId: string): string[] {
    const relatedEdges = this.edges.filter(e => e.sourceId === nodeId || e.targetId === nodeId);
    const relatedIds = relatedEdges.map(e => e.sourceId === nodeId ? e.targetId : e.sourceId);
    
    return this.nodes
      .filter(n => relatedIds.includes(n.id) && n.structuredSummary && n.structuredSummary.overview)
      .map(n => n.structuredSummary.overview as string);
  }

  getGraphData() {
    const hasDb = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.STORAGE_URL);
    return { nodes: this.nodes, edges: this.edges, isEphemeral: !hasDb };
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







