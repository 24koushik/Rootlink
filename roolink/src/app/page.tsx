'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import MindMapViz from '@/components/MindMapViz';
import { normalizeMindMap } from '@/lib/mindmap';
import GraphViz from '@/components/GraphViz';
import { TrustNode, TrustEdge } from '@/lib/graph';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { BlockMath } from 'react-katex';
import {
  Network, Link as LinkIcon, RefreshCw, FileText,
  ExternalLink, Shield, GitBranch, Search, X,
  PlaySquare, Clock, PlayCircle, Trash2, HelpCircle
} from 'lucide-react';

// Custom CountUp Hook
function useCountUp(endValue: number, duration = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTime: number | null = null;
    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.round(ease * endValue));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [endValue, duration]);
  return count;
}

// Custom Hook to Throttle High-Frequency State Updates
function useThrottledGraphState(rawNodes: TrustNode[], rawEdges: TrustEdge[], delayMs: number = 600) {
  const [nodes, setNodes] = useState<TrustNode[]>(rawNodes);
  const [edges, setEdges] = useState<TrustEdge[]>(rawEdges);
  const lastUpdate = useRef<number>(Date.now());
  const prevCounts = useRef<{ nodes: number; edges: number }>({ nodes: rawNodes.length, edges: rawEdges.length });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // If counts changed (e.g. node created/deleted, link created/removed), update immediately!
    const countChanged = prevCounts.current.nodes !== rawNodes.length || prevCounts.current.edges !== rawEdges.length;
    prevCounts.current = { nodes: rawNodes.length, edges: rawEdges.length };

    if (countChanged) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setNodes(rawNodes);
      setEdges(rawEdges);
      lastUpdate.current = Date.now();
      return;
    }

    const now = Date.now();
    const timeSinceLast = now - lastUpdate.current;

    if (timeSinceLast >= delayMs) {
      setNodes(rawNodes);
      setEdges(rawEdges);
      lastUpdate.current = now;
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setNodes(rawNodes);
        setEdges(rawEdges);
        lastUpdate.current = Date.now();
      }, delayMs - timeSinceLast);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [rawNodes, rawEdges, delayMs]);

  return { nodes, edges };
}

// Searchable Select Component (Clean Light Style)
function SearchableSelect({ nodes, value, onChange, placeholder }: { nodes: TrustNode[], value: string, onChange: (id: string) => void, placeholder: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<'down'|'up'>('down');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      if (window.innerHeight - rect.bottom < 320) {
        setDirection('up');
      } else {
        setDirection('down');
      }
    }
  }, [open]);

  const filtered = nodes.filter(n => {
    const name = n.canonicalName || (n as any).title || n.id || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });
  const selectedNode = nodes.find(n => n.id === value);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', zIndex: open ? 100 : 1 }}>
      {/* Trigger Button */}
      <div 
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', height: '44px', fontSize: '13px', padding: '0 12px',
          color: selectedNode ? '#0f2d24' : '#9ca3af',
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#ffffff', border: open ? '1.5px solid #10b981' : '1px solid #d1fae5',
          borderRadius: '8px', transition: 'all 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedNode ? (selectedNode.canonicalName || (selectedNode as any).title || selectedNode.id) : placeholder}
        </span>
        <span style={{ fontSize: '10px', color: '#9ca3af', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </div>
      
      {/* Popover Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', 
          [direction === 'down' ? 'top' : 'bottom']: 'calc(100% + 4px)',
          left: 0, right: 0, zIndex: 9999,
          display: 'flex', flexDirection: 'column',
          background: '#ffffff',
          border: '1px solid #cce8d2', borderRadius: '10px',
          boxShadow: '0 16px 36px rgba(0, 40, 20, 0.12)',
          overflow: 'hidden'
        }}>
          <input
            autoFocus
            type="text"
            placeholder="Search nodes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              height: '40px', padding: '0 12px', 
              borderBottom: '1px solid #e5e7eb',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              background: '#f9fdfa', outline: 'none', fontSize: '13px', color: '#0f2d24',
              width: '100%'
            }}
          />
          <div style={{ overflowY: 'auto', maxHeight: '200px', padding: '4px 0' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
                No matches found
              </div>
            ) : null}
            {filtered.map(n => (
              <div 
                key={n.id}
                onClick={() => { onChange(n.id); setOpen(false); setSearch(''); }}
                style={{
                  padding: '8px 12px', fontSize: '13px', color: '#1f2937', cursor: 'pointer',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.color = '#15803d'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#1f2937'; }}
              >
                {n.canonicalName || (n as any).title || n.id}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeStructuredSummary(node: any) {
  if (!node) return { overview: "", sections: [], keyTakeaways: [] };
  const ss = node.structuredSummary || {};
  
  let overview = ss.overview || ss.detailedSummary || (typeof node.summary === 'string' ? node.summary : "");
  
  let sections = ss.sections || [];
  if (sections.length === 0 && ss.keyConcepts && ss.keyConcepts.length > 0) {
    sections = ss.keyConcepts.map((c: any) => ({
      title: c.concept,
      explanation: c.explanation,
      keyPoints: []
    }));
  }
  
  sections = sections.map((sec: any) => ({
    ...sec,
    keyPoints: sec.keyPoints || sec.points || []
  }));
  
  let keyTakeaways = ss.keyTakeaways || ss.keyInsights || node.keyInsights || [];
  
  return {
    overview,
    sections,
    keyTakeaways
  };
}

export default function Dashboard() {
  const [rawNodes, setRawNodes] = useState<TrustNode[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('rootlink_cached_nodes');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });
  const [rawEdges, setRawEdges] = useState<TrustEdge[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('rootlink_cached_edges');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  // Keep localStorage up-to-date
  useEffect(() => {
    if (typeof window !== 'undefined' && rawNodes.length > 0) {
      try {
        localStorage.setItem('rootlink_cached_nodes', JSON.stringify(rawNodes));
      } catch (e) {}
    }
  }, [rawNodes]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('rootlink_cached_edges', JSON.stringify(rawEdges));
      } catch (e) {}
    }
  }, [rawEdges]);
  const { nodes, edges } = useThrottledGraphState(rawNodes, rawEdges, 300);
  
  const [selectedNode, setSelectedNode] = useState<TrustNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<TrustEdge | null>(null);
  const canonicalSummary = selectedNode ? normalizeStructuredSummary(selectedNode) : { overview: "", sections: [], keyTakeaways: [] };
  const [activeTab, setActiveTab] = useState<'summary' | 'mindmap' | 'sources'>('summary');
  const [isGeneratingMindMap, setIsGeneratingMindMap] = useState(false);
  const [linkedSummary, setLinkedSummary] = useState<string | null>(null);
  const [isLoadingLinkedSummary, setIsLoadingLinkedSummary] = useState(false);
  const [mindMapError, setMindMapError] = useState<string | null>(null);
  const [linkSource, setLinkSource] = useState('');
  const [linkTarget, setLinkTarget] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [nodeToDelete, setNodeToDelete] = useState<string | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const lastKnownNodeIds = useRef<Set<string>>(new Set());
  
  // Loading states
  const [isLinking, setIsLinking] = useState(false);
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [graphMode, setGraphMode] = useState<'normal' | 'hidden' | 'expanded'>('normal');
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const generateMindMap = async () => {
    if (!selectedNode) return;
    
    setIsGeneratingMindMap(true);
    setMindMapError(null);
    try {
      const res = await fetch('/api/mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: selectedNode.id })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate knowledge');
      }
      await fetchGraph();
      setSelectedNode((prev: any) => prev?.id === selectedNode.id ? { 
        ...prev, 
        mindMap: data.mindMap || prev.mindMap,
        structuredSummary: data.summary || prev.structuredSummary
      } : prev);
      showToast('✓ AI Mind Map generated successfully');
    } catch (err: any) {
      setMindMapError(err.message);
    } finally {
      setIsGeneratingMindMap(false);
    }
  };

  const fetchGraph = async () => {
    try {
      const res = await fetch('/api/nodes');
      const data = await res.json();
      
      const normalizedNodes: TrustNode[] = Array.isArray(data?.nodes) ? data.nodes : (Array.isArray(data) ? data : []);
      const normalizedEdges: TrustEdge[] = Array.isArray(data?.edges) ? data.edges : [];
      
      if (data.isEphemeral) {
        (window as any)._isEphemeral = true;
      }

      // Merge nodes safely - never drop nodes that the client already has!
      setRawNodes(prev => {
        if (normalizedNodes.length === 0) return prev;
        const map = new Map(prev.map(n => [n.id, n]));
        for (const n of normalizedNodes) {
          map.set(n.id, { ...(map.get(n.id) || {}), ...n });
        }
        return Array.from(map.values());
      });

      // Merge edges safely
      setRawEdges(prev => {
        const map = new Map(prev.map(e => [e.id, e]));
        for (const e of normalizedEdges) {
          map.set(e.id, e);
        }
        return Array.from(map.values());
      });

      if (normalizedNodes.length > 0) {
        if (lastKnownNodeIds.current.size > 0) {
          const newIds = normalizedNodes.filter((n: any) => !lastKnownNodeIds.current.has(n.id));
          if (newIds.length > 0) {
            const newlyCaptured = newIds[newIds.length - 1];
            handleNodeSelect(newlyCaptured);
            setGraphMode('normal');
          }
        }
        lastKnownNodeIds.current = new Set(normalizedNodes.map((n: any) => n.id));
      }
    } catch (error) {
      console.error('Failed to fetch graph:', error);
    }
  };

  useEffect(() => {
    fetchGraph();
    const interval = setInterval(() => {
      if (!(window as any)._isEphemeral) {
        fetchGraph();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleEdgeSelect = (edge: TrustEdge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    setGraphMode('expanded');
  };

  const fetchLinkedSummary = useCallback(async (node: TrustNode) => {
    const connectedEdges = edges.filter(e => e.sourceId === node.id || e.targetId === node.id);
    if (connectedEdges.length === 0) {
      setLinkedSummary(null);
      setIsLoadingLinkedSummary(false);
      return;
    }

    setIsLoadingLinkedSummary(true);
    try {
      const res = await fetch('/api/oversummary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nodeId: node.id, 
          clientNodes: nodes, 
          clientEdges: edges 
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLinkedSummary(data.overSummary || data.overview || null);
      }
    } catch (e) {
      console.error("Failed to fetch linked summary:", e);
    } finally {
      setIsLoadingLinkedSummary(false);
    }
  }, [nodes, edges]);

  useEffect(() => {
    if (selectedNode) {
      fetchLinkedSummary(selectedNode);
    } else {
      setLinkedSummary(null);
    }
  }, [selectedNode?.id, edges.length, fetchLinkedSummary]);

  const handleNodeSelect = async (node: TrustNode) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    setActiveTab('summary');
    setLinkedSummary(null);
  };

  const handleLinkNodes = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!linkSource || !linkTarget) {
      showToast('⚠️ Please select both Source and Target nodes');
      return;
    }
    if (linkSource === linkTarget) {
      showToast('⚠️ Cannot link a node to itself');
      return;
    }

    setIsLinking(true);

    // Optimistically add manual link to edges immediately
    const manualEdgeId = `manual-${linkSource}-${linkTarget}`;
    const newManualEdge: TrustEdge = {
      id: manualEdgeId,
      sourceId: linkSource,
      targetId: linkTarget,
      relationshipType: 'Related',
      confidence: 1.0,
      origin: 'manual',
      createdAt: Date.now()
    };

    setRawEdges(prev => {
      const filtered = prev.filter(edge => edge.id !== manualEdgeId);
      return [...filtered, newManualEdge];
    });

    try {
      const res = await fetch('/api/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: linkSource, targetId: linkTarget, clientNodes: rawNodes }),
      });
      if (res.ok) {
        const updatedData = await res.json();
        const incomingNodes: TrustNode[] = Array.isArray(updatedData?.nodes) ? updatedData.nodes : [];
        const incomingEdges: TrustEdge[] = Array.isArray(updatedData?.edges) ? updatedData.edges : [];
        
        // Merge nodes safely (never wipe existing nodes)
        if (incomingNodes.length > 0) {
          setRawNodes(prev => {
            const map = new Map(prev.map(n => [n.id, n]));
            for (const n of incomingNodes) {
              map.set(n.id, { ...(map.get(n.id) || {}), ...n });
            }
            return Array.from(map.values());
          });
        }

        // Merge edges safely
        setRawEdges(prev => {
          const map = new Map(prev.map(edge => [edge.id, edge]));
          map.set(newManualEdge.id, newManualEdge);
          for (const edge of incomingEdges) {
            map.set(edge.id, edge);
          }
          return Array.from(map.values());
        });

        setLinkSource('');
        setLinkTarget('');
        setIsLinkingModalOpen(false);
        showToast('✓ Trust link established successfully');
      } else {
        showToast('✓ Link established');
        setIsLinkingModalOpen(false);
      }
    } catch {
      showToast('✓ Link established locally');
      setIsLinkingModalOpen(false);
    } finally {
      setIsLinking(false);
    }
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodeToDelete(nodeId);
  };

  const confirmDeleteNode = async () => {
    if (!nodeToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/nodes?id=${encodeURIComponent(nodeToDelete)}`, { method: 'DELETE' });
      if (res.ok) {
        const updatedData = await res.json();
        const normalizedNodes = Array.isArray(updatedData?.nodes) ? updatedData.nodes : (Array.isArray(updatedData) ? updatedData : []);
        const normalizedEdges = Array.isArray(updatedData?.edges) ? updatedData.edges : [];
        
        setRawNodes(normalizedNodes);
        setRawEdges(normalizedEdges);
        
        if (selectedNode?.id === nodeToDelete) {
          setSelectedNode(null);
        }
        showToast('✓ Node deleted successfully');
      } else {
        showToast('✗ Failed to delete node');
      }
    } catch {
      showToast('✗ Error deleting node');
    } finally {
      setIsDeleting(false);
      setNodeToDelete(null);
    }
  };

  const handleUnlinkNode = async (sourceId: string, targetId: string) => {
    const unlinkKey = `${sourceId}-${targetId}`;
    setUnlinkingId(unlinkKey);

    // Optimistically remove link immediately
    setRawEdges(prev => prev.filter(e => 
      !(e.sourceId === sourceId && e.targetId === targetId) &&
      !(e.sourceId === targetId && e.targetId === sourceId)
    ));

    try {
      const res = await fetch('/api/link', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, targetId }),
      });
      if (res.ok) {
        const updatedData = await res.json();
        const incomingEdges: TrustEdge[] = Array.isArray(updatedData?.edges) ? updatedData.edges : [];
        if (incomingEdges.length > 0) {
          setRawEdges(prev => {
            return incomingEdges.filter(e => 
              !(e.sourceId === sourceId && e.targetId === targetId) &&
              !(e.sourceId === targetId && e.targetId === sourceId)
            );
          });
        }
        showToast('✓ Link removed successfully');
      } else {
        showToast('✓ Link removed');
      }
    } catch {
      showToast('✓ Link removed');
    } finally {
      setUnlinkingId(null);
    }
  };

  const totalEdges = edges.length;
  const rawAvgTrust = nodes.length
    ? (nodes.reduce((sum, n) => sum + n.trustScore, 0) / nodes.length * 100)
    : 0;

  const animatedNodes = useCountUp(nodes.length);
  const animatedEdges = useCountUp(totalEdges);
  const animatedTrust = useCountUp(rawAvgTrust);

  const incomingCount = selectedNode ? edges.filter(e => e.targetId === selectedNode.id).length : 0;
  const outgoingCount = selectedNode ? edges.filter(e => e.sourceId === selectedNode.id).length : 0;

  return (
    <div className="h-screen w-full overflow-hidden" style={{ display: 'flex', flexDirection: 'row', background: '#d2eed6', gap: '16px', padding: '16px' }}>
      
      {/* LEFT PANEL: Main Content Workspace */}
      <aside 
        className="white-panel flex flex-col z-20 flex-shrink-0 transition-all duration-300" 
        style={{ 
          height: '100%', 
          flex: graphMode === 'hidden' ? '1' : graphMode === 'expanded' ? '0' : '7.2',
          display: graphMode === 'expanded' ? 'none' : 'flex'
        }}
      >
        
        {/* Header (Logo + Actions) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px', borderBottom: '1px solid #e5efe7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }} onClick={() => setSelectedNode(null)}>
            
            {/* Emerald Glowing Orb Logo (Image 5) */}
            <div style={{ position: 'relative', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%)', animation: 'pulse-glow 3s ease-in-out infinite' }} />

              {/* Outer Slow Dashed Ring */}
              <svg style={{ position: 'absolute', inset: -3, width: 'calc(100% + 6px)', height: 'calc(100% + 6px)', animation: 'orbit-spin 18s linear infinite' }} viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="1.5" strokeDasharray="4,8" />
              </svg>

              {/* Main Sphere with White "R" */}
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #34d399 0%, #10b981 40%, #065f46 100%)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35), inset 0 2px 4px rgba(255,255,255,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff',
                fontWeight: 900, fontSize: '20px', fontFamily: 'Inter, system-ui, sans-serif'
              }}>
                R
              </div>
            </div>

            <span style={{ fontSize: '24px', fontWeight: 800, color: '#0f2d24', letterSpacing: '-0.02em', margin: 0 }}>
              Rootlink
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <a 
              href="/rootlink-extension.zip" 
              download 
              style={{
                background: '#f0fdf4',
                color: '#15803d',
                border: '1px solid #bbf7d0',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              Get Extension
            </a>
            {graphMode === 'hidden' ? (
              <button 
                onClick={() => setGraphMode('normal')} 
                style={{ 
                  background: '#15803d', color: '#ffffff', border: 'none', 
                  padding: '6px 14px', borderRadius: '8px', fontSize: '12px', 
                  fontWeight: 600, cursor: 'pointer' 
                }}
              >
                Show Graph &gt;
              </button>
            ) : graphMode === 'normal' ? (
              <button 
                onClick={() => setGraphMode('hidden')} 
                style={{ 
                  background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', 
                  padding: '6px 14px', borderRadius: '8px', fontSize: '12px', 
                  fontWeight: 600, cursor: 'pointer' 
                }}
              >
                &larr; Hide Graph
              </button>
            ) : null}
          </div>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column' }}>

          {/* CASE A: NO NODE SELECTED (Image 1) */}
          {!selectedNode ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f2d24', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '14px' }}>
                ROOTLINK
              </h2>
              <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '6px' }}>
                Capture knowledge from the web.
              </p>
              <p style={{ fontSize: '14px', color: '#4b5563', maxWidth: '380px', lineHeight: 1.6, marginBottom: '24px' }}>
                Click the Capture Orb on any webpage or YouTube video to begin.
              </p>
              <button 
                onClick={() => setShowHowItWorks(true)}
                style={{
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  color: '#166534',
                  borderRadius: '8px',
                  padding: '8px 22px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                How it works
              </button>
            </div>
          ) : (
            /* CASE B: NODE IS SELECTED (Images 2, 3, 4, 5) */
            <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Title & Metadata Row */}
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f2d24', lineHeight: 1.3, marginBottom: '10px' }}>
                  {selectedNode.type === 'youtube_video' && <PlaySquare size={22} style={{ display: 'inline', color: '#ef4444', marginRight: 8, verticalAlign: 'text-bottom' }} />}
                  {selectedNode.canonicalName}
                </h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {/* Trust Pill */}
                  <span style={{
                    padding: '4px 10px', fontSize: 11, fontWeight: 800, borderRadius: 100, letterSpacing: '0.04em',
                    background: '#dcfce7', color: '#15803d'
                  }}>
                    {Math.round(selectedNode.trustScore * 100)}% TRUST
                  </span>

                  {/* URL */}
                  {selectedNode.sourceUrl && (
                    <a href={selectedNode.sourceUrl} target="_blank" rel="noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 13, color: '#0284c7', textDecoration: 'none', wordBreak: 'break-all', fontWeight: 500
                    }}>
                      <ExternalLink size={14} />
                      {selectedNode.sourceUrl.substring(0, 42)}{selectedNode.sourceUrl.length > 42 ? '...' : ''}
                    </a>
                  )}

                  {/* Mention count */}
                  <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
                    Mentioned {selectedNode.mentionCount} times
                  </span>
                </div>
                
                {selectedNode.type === 'youtube_video' && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 13, color: '#6b7280', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} />
                      {Math.floor((selectedNode.durationSeconds || 0)/60)}:{((selectedNode.durationSeconds || 0)%60).toString().padStart(2, '0')}
                    </div>
                    {selectedNode.channelName && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <PlaySquare size={14} /> {selectedNode.channelName}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* TABS ROW (Image 2 & 3) */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e5efe7', paddingBottom: '14px' }}>
                <button 
                  onClick={() => setActiveTab('summary')} 
                  style={{ 
                    padding: '6px 20px', 
                    background: activeTab === 'summary' ? '#136c4b' : 'transparent', 
                    color: activeTab === 'summary' ? '#ffffff' : '#374151', 
                    borderRadius: '100px', cursor: 'pointer', fontSize: '13px', 
                    fontWeight: 600, border: 'none', transition: 'all 0.2s' 
                  }}
                >
                  Summary
                </button>
                <button 
                  onClick={() => setActiveTab('mindmap')} 
                  style={{ 
                    padding: '6px 20px', 
                    background: activeTab === 'mindmap' ? '#136c4b' : 'transparent', 
                    color: activeTab === 'mindmap' ? '#ffffff' : '#374151', 
                    borderRadius: '100px', cursor: 'pointer', fontSize: '13px', 
                    fontWeight: 600, border: 'none', transition: 'all 0.2s' 
                  }}
                >
                  Mind Map
                </button>
                <button 
                  onClick={() => setActiveTab('sources')} 
                  style={{ 
                    padding: '6px 20px', 
                    background: activeTab === 'sources' ? '#136c4b' : 'transparent', 
                    color: activeTab === 'sources' ? '#ffffff' : '#374151', 
                    borderRadius: '100px', cursor: 'pointer', fontSize: '13px', 
                    fontWeight: 600, border: 'none', transition: 'all 0.2s' 
                  }}
                >
                  Sources
                </button>
              </div>

              {/* TAB 1: SUMMARY (Image 2) */}
              {activeTab === 'summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* LOCAL SUMMARY CARD */}
                  {canonicalSummary.overview && (
                    <div>
                      <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        LOCAL SUMMARY
                      </h3>
                      <div className="card-shell" style={{ padding: '16px 20px' }}>
                        <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#1f2937' }}>
                          {canonicalSummary.overview}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* MAIN CONCEPTS & SECTIONS (Image 2) */}
                  {canonicalSummary.sections.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        MAIN CONCEPTS & SECTIONS
                      </h3>
                      <div className="card-shell" style={{ padding: '20px' }}>
                        <strong style={{ color: '#111827', fontSize: '11px', display: 'block', marginBottom: '10px', textTransform: 'uppercase', fontWeight: 800 }}>
                          DOCUMENT CONTENT
                        </strong>
                        <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '16px', listStyleType: 'disc' }}>
                          {canonicalSummary.sections.map((sec: any, i: number) => (
                            <li key={i} style={{ color: '#1f2937', fontSize: '13px', lineHeight: 1.6 }}>
                              <strong>{sec.title || sec.heading}:</strong> {sec.explanation}
                              {sec.keyPoints && sec.keyPoints.length > 0 && (
                                <ul style={{ listStyleType: 'circle', paddingLeft: '16px', marginTop: '4px' }}>
                                  {sec.keyPoints.map((kp: string, j: number) => (
                                    <li key={j} style={{ color: '#4b5563', fontSize: '12px' }}>{kp}</li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* KEY INSIGHTS */}
                  {canonicalSummary.keyTakeaways.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileText size={14} /> KEY INSIGHTS
                      </h3>
                      <div className="card-shell" style={{ padding: '16px 20px' }}>
                        <ul style={{ listStyleType: 'disc', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {canonicalSummary.keyTakeaways.map((insight: string, idx: number) => (
                            <li key={idx} style={{ fontSize: '13px', color: '#1f2937', lineHeight: 1.6 }}>
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{insight}</ReactMarkdown>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* FORMULAS */}
                  {(() => {
                    const validFormulas = (selectedNode.structuredSummary?.formulas || selectedNode.formulas || []).filter((f: any) => f.latex && f.latex.trim().length > 0);
                    if (validFormulas.length === 0) return null;
                    return (
                      <div>
                        <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                          Formulas
                        </h3>
                        <div className="card-shell" style={{ padding: '16px' }}>
                          {validFormulas.map((f: any, i: number) => (
                            <div key={i} style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f2d24', marginBottom: 4 }}>{f.label || 'Formula'}</div>
                              <BlockMath math={f.latex} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* YOUTUBE KEY MOMENTS */}
                  {selectedNode.type === 'youtube_video' && selectedNode.keyMoments && selectedNode.keyMoments.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <PlayCircle size={14} /> Key Moments
                      </h3>
                      <div className="card-shell" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {selectedNode.keyMoments.map((moment: any, idx: number) => (
                          <div key={idx} style={{ padding: '10px', background: '#ffffff', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                            <a 
                              href={`https://youtube.com/watch?v=${selectedNode.videoId}&t=${moment.timestampSeconds}s`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', fontWeight: 700, color: '#15803d', textDecoration: 'none', marginBottom: '4px' }}
                            >
                              <PlayCircle size={12} /> {moment.timestampFormatted}
                            </a>
                            <p style={{ fontSize: '13px', color: '#111827', fontWeight: 600, marginBottom: '2px' }}>{moment.insight}</p>
                            <p style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>"{moment.transcriptExcerpt}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}


                  {/* CONNECTIONS LIST */}
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <LinkIcon size={12} /> CONNECTIONS
                      </h3>
                      <button
                        onClick={() => {
                          setLinkSource(selectedNode.id);
                          setLinkTarget('');
                          setIsLinkingModalOpen(true);
                        }}
                        style={{
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          color: '#15803d',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        + Connect
                      </button>
                    </div>
                    {(() => {
                      const connections = edges
                        .filter(e => e.sourceId === selectedNode.id || e.targetId === selectedNode.id)
                        .map(e => {
                          const isOutgoing = e.sourceId === selectedNode.id;
                          const targetId = isOutgoing ? e.targetId : e.sourceId;
                          return { targetId, node: nodes.find(n => n.id === targetId), isOutgoing, edgeId: e.id, sourceId: e.sourceId, realTargetId: e.targetId };
                        })
                        .filter(c => c.node);
                      
                      if (connections.length === 0) {
                        return <div style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>No connections yet. Click "+ Connect" to link with other nodes.</div>;
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {connections.map(c => (
                            <div key={c.edgeId} className="card-shell" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', color: '#1f2937' }}>
                                <Shield size={12} color="#15803d" />
                                <span style={{ fontWeight: 500 }}>{c.node?.canonicalName}</span>
                              </div>
                              <button 
                                onClick={() => handleUnlinkNode(c.sourceId, c.realTargetId)}
                                disabled={unlinkingId === `${c.sourceId}-${c.realTargetId}`}
                                style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 4 }}
                                title="Remove Link"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* TOTAL LINKED SYSTEM SUMMARY CARD (Bottom of Summary Tab) */}
                  {(() => {
                    const nodeConnections = edges.filter(e => e.sourceId === selectedNode.id || e.targetId === selectedNode.id);
                    return (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h3 style={{
                            fontSize: '11px', fontWeight: 800, color: '#166534',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                            display: 'flex', alignItems: 'center', gap: 6
                          }}>
                            <Network size={14} color="#15803d" /> LINKED KNOWLEDGE SUMMARY
                            {nodeConnections.length > 0 && (
                              <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                                {nodeConnections.length} Active {nodeConnections.length === 1 ? 'Link' : 'Links'}
                              </span>
                            )}
                          </h3>
                          {nodeConnections.length > 0 && (
                            <button
                              onClick={() => fetchLinkedSummary(selectedNode)}
                              disabled={isLoadingLinkedSummary}
                              style={{
                                background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d',
                                borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 700,
                                cursor: isLoadingLinkedSummary ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              <RefreshCw size={11} className={isLoadingLinkedSummary ? 'animate-spin' : ''} />
                              {isLoadingLinkedSummary ? 'Synthesizing...' : 'Regenerate'}
                            </button>
                          )}
                        </div>

                        <div className="card-shell" style={{
                          padding: '18px 20px',
                          background: '#f0fdf4',
                          border: '1.5px solid #86efac',
                          boxShadow: '0 4px 12px rgba(21, 128, 61, 0.08)'
                        }}>
                          {isLoadingLinkedSummary ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#15803d', fontSize: '13px', padding: '12px 0', fontWeight: 600 }}>
                              <RefreshCw size={16} className="animate-spin" /> Synthesizing total linked knowledge across connected nodes...
                            </div>
                          ) : nodeConnections.length === 0 ? (
                            <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.6 }}>
                              <p style={{ marginBottom: '8px' }}>No links established for <strong>{selectedNode.canonicalName}</strong> yet.</p>
                              <button
                                onClick={() => {
                                  setLinkSource(selectedNode.id);
                                  setLinkTarget('');
                                  setIsLinkingModalOpen(true);
                                }}
                                style={{
                                  background: '#15803d', color: '#ffffff', border: 'none',
                                  borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 700,
                                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
                                }}
                              >
                                <LinkIcon size={12} /> Establish Link to Generate Linked Summary
                              </button>
                            </div>
                          ) : (
                            <div style={{ fontSize: '13px', color: '#14532d', lineHeight: 1.7 }}>
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {linkedSummary || 'Synthesizing interconnected concepts across links...'}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              )}

              {/* TAB 2: MIND MAP (Images 3 & 4) */}
              {activeTab === 'mindmap' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Incoming / Outgoing Badges (Image 3) */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{
                      padding: '4px 12px', background: '#f0fdf4', border: '1px solid #a7f3d0',
                      color: '#065f46', fontSize: '12px', fontWeight: 600, borderRadius: '9999px',
                      display: 'inline-flex', alignItems: 'center', gap: '6px'
                    }}>
                      ◯ {incomingCount} incoming
                    </span>
                    <span style={{
                      padding: '4px 12px', background: '#f0fdf4', border: '1px solid #a7f3d0',
                      color: '#065f46', fontSize: '12px', fontWeight: 600, borderRadius: '9999px',
                      display: 'inline-flex', alignItems: 'center', gap: '6px'
                    }}>
                      ☍ {outgoingCount} outgoing
                    </span>
                  </div>

                  {/* Raw Context Snippets (Collapsible) */}
                  {selectedNode.sourceReferences && selectedNode.sourceReferences.length > 0 && (
                    <details style={{ cursor: 'pointer', outline: 'none' }}>
                      <summary style={{ 
                        fontSize: '11px', fontWeight: 800, color: '#166534', 
                        textTransform: 'uppercase', letterSpacing: '0.05em', 
                        userSelect: 'none', listStyle: 'none'
                      }}>
                        ▾ RAW CONTEXT SNIPPETS
                      </summary>
                      <div className="card-shell" style={{ padding: '12px', marginTop: 8 }}>
                        <div style={{ fontSize: '11px', color: '#4b5563', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                          {selectedNode.sourceReferences[0]?.contextSnippet || 'No snippet available.'}
                        </div>
                      </div>
                    </details>
                  )}

                  {/* Mind Map Canvas or Generator State */}
                  {(() => {
                    const finalMindMap = normalizeMindMap((selectedNode as any).mindMap);
                    
                    if (finalMindMap) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                              onClick={generateMindMap} 
                              disabled={isGeneratingMindMap} 
                              style={{ 
                                background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', 
                                padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, 
                                cursor: isGeneratingMindMap ? 'not-allowed' : 'pointer', 
                                display: 'flex', alignItems: 'center', gap: '6px' 
                              }}
                            >
                              <RefreshCw size={14} className={isGeneratingMindMap ? "animate-spin" : ""} />
                              {isGeneratingMindMap ? 'Regenerating...' : 'Regenerate AI Mind Map'}
                            </button>
                          </div>
                          
                          <div style={{ height: '480px', width: '100%', background: '#f9fdfa', borderRadius: '12px', overflow: 'hidden', border: '1px solid #cce8d2' }}>
                            <MindMapViz mindMap={finalMindMap} />
                          </div>
                        </div>
                      );
                    } else {
                      // Image 3 empty state
                      return (
                        <div style={{ padding: '36px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                          <Network size={40} style={{ color: '#94a3b8' }} />
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
                              No mind map generated yet.
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              Click below to generate a hierarchical conceptual map using AI.
                            </div>
                          </div>
                          
                          {mindMapError && (
                            <div style={{ color: '#dc2626', fontSize: '12px' }}>
                              Mind map generation failed: {mindMapError}
                            </div>
                          )}
                          
                          <button 
                            onClick={generateMindMap} 
                            disabled={isGeneratingMindMap} 
                            style={{ 
                              background: '#bbf7d0', color: '#14532d', border: '1px solid #86efac', 
                              padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, 
                              cursor: isGeneratingMindMap ? 'not-allowed' : 'pointer', display: 'flex', 
                              alignItems: 'center', gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' 
                            }}
                          >
                            <RefreshCw size={14} className={isGeneratingMindMap ? "animate-spin" : ""} />
                            {isGeneratingMindMap ? 'Generating AI Mind Map...' : 'Generate AI Mind Map'}
                          </button>
                        </div>
                      );
                    }
                  })()}

                  {/* Connections List (Image 3) */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '11px', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <LinkIcon size={12} /> CONNECTIONS
                      </h3>
                      <button
                        onClick={() => {
                          setLinkSource(selectedNode.id);
                          setLinkTarget('');
                          setIsLinkingModalOpen(true);
                        }}
                        style={{
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          color: '#15803d',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        + Connect
                      </button>
                    </div>
                    {(() => {
                      const connections = edges
                        .filter(e => e.sourceId === selectedNode.id || e.targetId === selectedNode.id)
                        .map(e => {
                          const isOutgoing = e.sourceId === selectedNode.id;
                          const targetId = isOutgoing ? e.targetId : e.sourceId;
                          return { targetId, node: nodes.find(n => n.id === targetId), isOutgoing, edgeId: e.id, sourceId: e.sourceId, realTargetId: e.targetId };
                        })
                        .filter(c => c.node);
                      
                      if (connections.length === 0) {
                        return <div style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>No connections yet.</div>;
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {connections.map(c => (
                            <div key={c.edgeId} className="card-shell" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', color: '#1f2937' }}>
                                <Shield size={12} color="#15803d" />
                                <span style={{ fontWeight: 500 }}>{c.node?.canonicalName}</span>
                              </div>
                              <button 
                                onClick={() => handleUnlinkNode(c.sourceId, c.realTargetId)}
                                disabled={unlinkingId === `${c.sourceId}-${c.realTargetId}`}
                                style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 4 }}
                                title="Remove Link"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Delete Node Button (Image 3) */}
                  <div style={{ marginTop: 20 }}>
                    <button
                      onClick={() => handleDeleteNode(selectedNode.id)}
                      style={{
                        width: '100%', padding: '10px', borderRadius: '8px',
                        background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                        fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 6, cursor: 'pointer', transition: 'all 0.2s ease'
                      }}
                    >
                      <Trash2 size={15} /> Delete Node
                    </button>
                  </div>

                </div>
              )}

              {/* TAB 3: SOURCES */}
              {activeTab === 'sources' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedNode.sourceReferences?.map((ref: any, idx: number) => (
                    <div key={idx} className="card-shell" style={{ padding: '14px 18px' }}>
                      <a href={ref.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#0284c7', textDecoration: 'none', wordBreak: 'break-all', fontWeight: 600 }}>{ref.url}</a>
                      <p style={{ fontSize: 12, color: '#4b5563', marginTop: 6, fontFamily: 'monospace', lineHeight: 1.5 }}>{ref.contextSnippet}</p>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

        </div>

      </aside>

      {/* RIGHT PANEL: Knowledge Graph (Images 1, 2, 3, 4) */}
      <main 
        className="white-panel relative flex flex-col transition-all duration-300" 
        style={{ 
          height: '100%', 
          flex: graphMode === 'expanded' ? '1' : graphMode === 'hidden' ? '0' : '2.8',
          display: graphMode === 'hidden' ? 'none' : 'flex',
          overflow: 'hidden'
        }}
      >
        {/* Graph Header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #e5efe7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ fontSize: '12px', fontWeight: 800, color: '#1c3d2f', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            KNOWLEDGE GRAPH
          </h2>
          <button 
            onClick={() => setGraphMode(graphMode === 'expanded' ? 'normal' : 'expanded')} 
            style={{ 
              background: '#ffffff', border: '1px solid #d1d5db', color: '#374151', 
              padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, 
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 
            }}
          >
            {graphMode === 'expanded' ? 'Shrink' : '⛶ Expand'}
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5efe7', display: 'flex', alignItems: 'center', gap: '8px', background: '#f9fdfa', flexShrink: 0 }}>
          <Search size={14} color="#6b7280" />
          <input 
            type="text"
            placeholder="Search knowledge..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#111827', outline: 'none', fontSize: '13px' }}
          />
          {searchQuery && <X size={14} color="#6b7280" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />}
        </div>
        
        {/* Graph Canvas Container */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
          {nodes.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', flexDirection: 'column', gap: '12px', padding: '24px', textAlign: 'center' }}>
              <Network size={36} style={{ color: '#94a3b8' }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
                  No knowledge yet
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
                  Capture a webpage or video to start building Rootlink.
                </div>
              </div>
            </div>
          ) : (
            <GraphViz nodes={nodes} edges={edges} onNodeSelect={handleNodeSelect} onEdgeSelect={handleEdgeSelect} selectedNodeId={selectedNode?.id} searchQuery={searchQuery} />
          )}
        </div>

        {/* Recent Nodes (Image 2) */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #e5efe7', background: '#ffffff', flexShrink: 0 }}>
          <h3 style={{ fontSize: '10px', fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            RECENT NODES
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '60px', overflowY: 'auto' }}>
            {nodes.slice(-3).reverse().map(node => (
              <div 
                key={node.id} 
                onClick={() => handleNodeSelect(node)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', 
                  color: selectedNode?.id === node.id ? '#15803d' : '#1f2937', 
                  fontWeight: selectedNode?.id === node.id ? 700 : 500,
                  cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.canonicalName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Row (Images 1 & 2) */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e5efe7', background: '#f9fdfa', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>{animatedNodes}</div>
              <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>NODES</div>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid #e5efe7', borderRight: '1px solid #e5efe7' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>{animatedEdges}</div>
              <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>LINKS</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>{Math.round(animatedTrust)}%</div>
              <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>AVG TRUST</div>
            </div>
          </div>
        </div>
        
        {/* Establish Link Action Button (Images 1 & 2) */}
        <div style={{ padding: '12px 16px', flexShrink: 0, borderTop: '1px solid #e5efe7' }}>
          <button 
            onClick={() => {
              if (selectedNode) {
                setLinkSource(selectedNode.id);
              }
              setIsLinkingModalOpen(true);
            }}
            style={{ 
              width: '100%', padding: '10px 16px', borderRadius: '8px', 
              background: '#15803d', color: '#ffffff', border: 'none', 
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', 
              display: 'flex', justifyContent: 'center', alignItems: 'center', 
              gap: '8px', boxShadow: '0 2px 6px rgba(21, 128, 61, 0.25)',
              transition: 'all 0.2s' 
            }}
          >
            <LinkIcon size={15} /> Establish Link
          </button>
        </div>
      </main>

      {/* FLOATING "N" BADGE (Images 1, 2, 3, 4) */}
      <div 
        className="fixed bottom-3 left-3 w-7 h-7 rounded-full bg-white border border-gray-300 shadow-sm flex items-center justify-center text-xs font-bold text-gray-700 select-none z-50 pointer-events-none"
      >
        N
      </div>

      {/* MODAL: Establish Knowledge Link */}
      {isLinkingModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.35)', backdropFilter: 'blur(4px)'
        }}>
          <div style={{ width: '420px', padding: '24px', borderRadius: '16px', background: '#ffffff', border: '1px solid #cce8d2', boxShadow: '0 20px 48px rgba(0, 40, 20, 0.15)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f2d24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Establish Knowledge Link
              </h3>
              <button onClick={() => setIsLinkingModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleLinkNodes} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ position: 'relative', zIndex: 20 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Source Node</label>
                <SearchableSelect nodes={nodes} value={linkSource} onChange={setLinkSource} placeholder="Select Source Node..." />
              </div>
              <div style={{ position: 'relative', zIndex: 10 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' }}>Target Node</label>
                <SearchableSelect nodes={nodes} value={linkTarget} onChange={setLinkTarget} placeholder="Select Target Node..." />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsLinkingModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '8px', background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Cancel</button>
                <button type="submit" disabled={isLinking || !linkSource || !linkTarget} style={{ padding: '8px 18px', borderRadius: '8px', background: (isLinking || !linkSource || !linkTarget) ? '#e5e7eb' : '#15803d', color: (isLinking || !linkSource || !linkTarget) ? '#9ca3af' : '#ffffff', border: 'none', cursor: (isLinking || !linkSource || !linkTarget) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px' }}>Create Link</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: How It Works */}
      {showHowItWorks && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.35)', backdropFilter: 'blur(4px)'
        }}>
          <div style={{ width: '460px', padding: '28px', borderRadius: '16px', background: '#ffffff', border: '1px solid #cce8d2', boxShadow: '0 20px 48px rgba(0, 40, 20, 0.15)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HelpCircle size={20} color="#15803d" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f2d24' }}>
                  How Rootlink Works
                </h3>
              </div>
              <button onClick={() => setShowHowItWorks(false)} style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>1</span>
                <div><strong>Browse the Web:</strong> Install the Rootlink Chrome Extension and click the Capture Orb on any webpage or YouTube video.</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>2</span>
                <div><strong>Automated Extraction:</strong> Rootlink analyzes the source, scores trust provenance, extracts key concepts, formulas, and sections.</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>3</span>
                <div><strong>Graph &amp; Mind Maps:</strong> Explore the interactive Knowledge Graph, manually establish links between concepts, and generate AI hierarchical Mind Maps!</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setShowHowItWorks(false)} style={{ padding: '8px 18px', borderRadius: '8px', background: '#15803d', color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>Got it</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Node Confirmation */}
      {nodeToDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.35)', backdropFilter: 'blur(4px)'
        }}>
          <div style={{ width: '400px', padding: '24px', borderRadius: '16px', background: '#ffffff', border: '1px solid #fecaca', boxShadow: '0 20px 48px rgba(0, 40, 20, 0.15)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626', marginBottom: '8px' }}>Delete Node</h2>
              <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.5 }}>
                Are you sure you want to delete this node? This action will permanently remove it and all of its connections.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setNodeToDelete(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', background: '#f3f4f6', color: '#374151', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteNode}
                disabled={isDeleting}
                style={{ padding: '8px 18px', borderRadius: '8px', background: '#dc2626', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '13px', cursor: isDeleting ? 'not-allowed' : 'pointer' }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 3000,
          background: '#ffffff', border: '1px solid #86efac', borderRadius: '8px',
          padding: '10px 16px', boxShadow: '0 8px 24px rgba(0, 30, 15, 0.1)',
          display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontWeight: 700, fontSize: '13px'
        }}>
          {toast}
        </div>
      )}

    </div>
  );
}
