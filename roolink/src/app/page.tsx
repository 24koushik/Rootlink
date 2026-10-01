'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import MindMapViz from '@/components/MindMapViz';
import { normalizeMindMap, MindMapData } from '@/lib/mindmap';
import GraphViz from '@/components/GraphViz';
import { TrustNode, TrustEdge } from '@/lib/graph';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { InlineMath, BlockMath } from 'react-katex';
import {
  Network, Link as LinkIcon, RefreshCw, FileText,
  ExternalLink, Shield, GitBranch, Search, X,
  PlaySquare, Clock, PlayCircle, Trash2
, Info} from "lucide-react";

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
function useThrottledGraphState(rawNodes: TrustNode[], rawEdges: TrustEdge[], delayMs = 1000) {
  const [nodes, setNodes] = useState(rawNodes);
  const [edges, setEdges] = useState(rawEdges);
  const lastUpdate = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
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

// Custom Searchable Select Component (Dark Liquid Glass)
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

  const filtered = nodes.filter(n => n.canonicalName.toLowerCase().includes(search.toLowerCase()));
  const selectedNode = nodes.find(n => n.id === value);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger Button */}
      <div 
        onClick={() => setOpen(!open)}
        className="liquid-glass liquid-glass-md"
        style={{
          width: '100%', height: '48px', fontSize: '14px', padding: '0 var(--space-2)',
          color: selectedNode ? 'var(--text-heading)' : 'var(--text-disabled)',
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: open ? '0 0 0 1px var(--primary), 0 8px 32px rgba(139, 92, 246, 0.2)' : 'var(--glass-shadow), inset 0 1px 0 var(--glass-highlight)',
          transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedNode ? selectedNode.canonicalName : placeholder}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-disabled)', display: 'flex', alignItems: 'center', width: '24px', justifyContent: 'flex-end', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </div>
      
      {/* Floating Popover Overlay */}
      {open && (
        <div style={{
          position: 'absolute', 
          [direction === 'down' ? 'top' : 'bottom']: 'calc(100% + var(--space-1))',
          left: 0, right: 0, zIndex: 9999,
          display: 'flex', flexDirection: 'column',
          background: 'rgba(15, 15, 25, 0.95)', // Solid/blurred glass to prevent bleed
          backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.15)',
          overflow: 'hidden',
          animation: direction === 'down' ? 'dropdown-pop-down 0.2s cubic-bezier(0.22, 1, 0.36, 1) forwards' : 'dropdown-pop-up 0.2s cubic-bezier(0.22, 1, 0.36, 1) forwards',
          transformOrigin: direction === 'down' ? 'top center' : 'bottom center'
        }}>
          {/* Search Input */}
          <input
            autoFocus
            type="text"
            placeholder="Search nodes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              height: '48px', padding: '0 var(--space-2)', 
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              background: 'transparent', outline: 'none', fontSize: '14px', color: 'var(--text-heading)',
              width: '100%', flexShrink: 0
            }}
          />
          {/* Results List */}
          <div style={{ overflowY: 'auto', maxHeight: '240px', padding: 'var(--space-1) 0' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 'var(--space-3) var(--space-2)', fontSize: '14px', color: 'var(--text-disabled)', textAlign: 'center' }}>
                No matches found
              </div>
            ) : null}
            {filtered.map(n => (
              <div 
                key={n.id}
                onClick={() => { onChange(n.id); setOpen(false); setSearch(''); }}
                style={{
                  padding: '10px var(--space-2)', fontSize: '14px', color: 'var(--text-body)', cursor: 'pointer',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  transition: 'background 0.15s ease, color 0.15s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)'; e.currentTarget.style.color = 'var(--text-heading)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-body)'; }}
              >
                {n.canonicalName}
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
  
  // Normalize points -> keyPoints for the fallback object
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
  const [rawNodes, setRawNodes] = useState<TrustNode[]>([]);
  const [rawEdges, setRawEdges] = useState<TrustEdge[]>([]);
  const { nodes, edges } = useThrottledGraphState(rawNodes, rawEdges, 1000);
  
  const [selectedNode, setSelectedNode] = useState<TrustNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<TrustEdge | null>(null);
  const canonicalSummary = selectedNode ? normalizeStructuredSummary(selectedNode) : { overview: "", sections: [], keyTakeaways: [] };
  const [activeTab, setActiveTab] = useState<'summary' | 'mindmap' | 'sources'>('summary');
  const [isGeneratingMindMap, setIsGeneratingMindMap] = useState(false);
  const [mindMapError, setMindMapError] = useState<string | null>(null);
  const [globalSummary, setGlobalSummary] = useState<any>(null);
  const [loadingGlobalSummary, setLoadingGlobalSummary] = useState(false);
  const prevGraphHash = useRef('');
  const [linkSource, setLinkSource] = useState('');
  const [linkTarget, setLinkTarget] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [nodeToDelete, setNodeToDelete] = useState<string | null>(null);
  const lastKnownNodeIds = useRef<Set<string>>(new Set());
  
  // Loading states for actions
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
    
    console.log(`[MINDMAP] Selected node ID: ${selectedNode.id}`);
    console.log(`[MINDMAP] Selected node title: ${selectedNode.canonicalName}`);
    console.log(`[MINDMAP] Calling /api/mindmap/ for node ID: ${selectedNode.id}`);

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
      // Re-fetch the graph to get the updated node
      await fetchGraph();
      // Update selected node locally so UI updates immediately
      setSelectedNode((prev: any) => prev?.id === selectedNode.id ? { 
        ...prev, 
        mindMap: data.mindMap || prev.mindMap,
        structuredSummary: data.summary || prev.structuredSummary
      } : prev);
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
      
      const normalizedNodes = Array.isArray(data?.nodes) ? data.nodes : (Array.isArray(data) ? data : []);
      const normalizedEdges = Array.isArray(data?.edges) ? data.edges : [];
      
      if (normalizedNodes.length > 0) {
        setRawNodes(normalizedNodes);
        setRawEdges(normalizedEdges);

        // Auto-select newly captured node
        if (lastKnownNodeIds.current.size > 0) {
          const newIds = normalizedNodes.filter((n: any) => !lastKnownNodeIds.current.has(n.id));
          if (newIds.length > 0) {
            // Found a newly captured node! Auto-select the first one.
            const newlyCaptured = newIds[newIds.length - 1]; // pick the most recent if multiple
            handleNodeSelect(newlyCaptured);
            // Ensure graph mode is normal so we see the summary
            setGraphMode('normal');
          }
        }
        
        // Update known IDs
        lastKnownNodeIds.current = new Set(normalizedNodes.map((n: any) => n.id));
      }
    } catch (error) {
      console.error('Failed to fetch graph:', error);
    }
  };

  useEffect(() => {
    fetchGraph();
    const interval = setInterval(fetchGraph, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleEdgeSelect = (edge: TrustEdge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    setGraphMode('expanded');
  };

  const handleNodeSelect = async (node: TrustNode) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    
    setActiveTab('summary');
    
  };

  const handleLinkNodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkSource || !linkTarget || linkSource === linkTarget) return;
    setIsLinking(true);
    try {
      const res = await fetch('/api/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: linkSource, targetId: linkTarget }),
      });
      if (res.ok) {
        const updatedData = await res.json();
        
        const normalizedNodes = Array.isArray(updatedData?.nodes) ? updatedData.nodes : (Array.isArray(updatedData) ? updatedData : []);
        const normalizedEdges = Array.isArray(updatedData?.edges) ? updatedData.edges : [];
        
        setRawNodes(normalizedNodes);
        setRawEdges(normalizedEdges);
        setLinkSource('');
        setLinkTarget('');
        showToast('\u2713 Trust link established successfully');
      } else {
        showToast('\u2717 Failed to link \u2014 possible cycle detected');
      }
    } catch {
      showToast('\u2717 Error linking nodes');
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
    if (!selectedNode) return;
    const unlinkKey = `${sourceId}-${targetId}`;
    setUnlinkingId(unlinkKey);
    try {
      const res = await fetch('/api/link', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, targetId }),
      });
      if (res.ok) {
        const updatedData = await res.json();
        
        const normalizedNodes = Array.isArray(updatedData?.nodes) ? updatedData.nodes : (Array.isArray(updatedData) ? updatedData : []);
        const normalizedEdges = Array.isArray(updatedData?.edges) ? updatedData.edges : [];
        
        setRawNodes(normalizedNodes);
        setRawEdges(normalizedEdges);
        showToast('✓ Link removed successfully');
      } else {
        showToast('✗ Failed to remove link');
      }
    } catch {
      showToast('✗ Error removing link');
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

  return (
    <div className="h-screen w-full overflow-hidden" style={{ display: 'flex', flexDirection: 'row', background: 'transparent', gap: '24px', padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
      
      {/* PRIMARY WORKSPACE: Summary / Mind Map */}
      <aside 
        className="flex flex-col z-20 liquid-glass flex-shrink-0 transition-all duration-300" 
        style={{ 
          height: '100%', 
          flex: graphMode === 'hidden' ? '1' : graphMode === 'expanded' ? '0' : '7.2',
          display: graphMode === 'expanded' ? 'none' : 'flex'
        }}
      >
        
        {/* Header/Logo */}
        <div className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 24px 24px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="rootlink-brand" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="rootlink-logo" style={{ position: 'relative', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {/* Ambient Background Glow */}
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)', animation: 'pulse-glow 3s ease-in-out infinite' }} />

              {/* Outer Slow Dashed Ring (Clockwise) */}
              <svg style={{ position: 'absolute', inset: -4, width: 'calc(100% + 8px)', height: 'calc(100% + 8px)', animation: 'orbit-spin 20s linear infinite' }} viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="1" strokeDasharray="4,8" />
              </svg>

              {/* Inner Fast Dotted Ring (Clockwise) */}
              <svg style={{ position: 'absolute', inset: 4, width: 'calc(100% - 8px)', height: 'calc(100% - 8px)', animation: 'orbit-spin 6s linear infinite' }} viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="1.5" strokeDasharray="1,4" />
              </svg>

              {/* Main Orbit Ring with Glowing Nodes (Counter-Clockwise) */}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', animation: 'orbit-spin-reverse 12s linear infinite', filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.3)) drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))' }} viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="orbit-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="44" fill="none" stroke="url(#orbit-gradient)" strokeWidth="2" />
                
                {/* Nodes on the ring with volumetric bloom glow */}
                <circle cx="50" cy="6" r="4.5" fill="#cffafe" style={{ filter: 'drop-shadow(0 0 4px #06b6d4) drop-shadow(0 0 10px #06b6d4)' }} />
                <circle cx="81.1" cy="18.9" r="3" fill="#93c5fd" style={{ filter: 'drop-shadow(0 0 6px #3b82f6)' }} />
                <circle cx="94" cy="50" r="5" fill="#f3e8ff" style={{ filter: 'drop-shadow(0 0 4px #a855f7) drop-shadow(0 0 10px #a855f7)' }} />
                <circle cx="81.1" cy="81.1" r="3.5" fill="#e9d5ff" style={{ filter: 'drop-shadow(0 0 6px #c084fc)' }} />
                <circle cx="50" cy="94" r="4.5" fill="#fae8ff" style={{ filter: 'drop-shadow(0 0 4px #f0abfc) drop-shadow(0 0 10px #f0abfc)' }} />
                <circle cx="18.9" cy="81.1" r="3" fill="#ddd6fe" style={{ filter: 'drop-shadow(0 0 6px #8b5cf6)' }} />
                <circle cx="6" cy="50" r="5" fill="#cffafe" style={{ filter: 'drop-shadow(0 0 4px #06b6d4) drop-shadow(0 0 10px #06b6d4)' }} />
                <circle cx="18.9" cy="18.9" r="3.5" fill="#bfdbfe" style={{ filter: 'drop-shadow(0 0 6px #3b82f6)' }} />
              </svg>
              
              {/* The "R" Text with intense pulsing glow */}
              <div style={{
                position: 'relative',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.4)) drop-shadow(0 0 10px rgba(168, 85, 247, 0.8)) drop-shadow(0 0 20px rgba(59, 130, 246, 0.6))',
                animation: 'pulse-glow 3s ease-in-out infinite'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #67e8f9, #60a5fa, #d8b4fe)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  color: 'transparent',
                  fontSize: '36px',
                  fontWeight: 900,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  lineHeight: 1
                }}>
                  R
                </div>
              </div>
            </div>
            <span className="rootlink-wordmark heading-style" style={{ display: 'flex', alignItems: 'center', fontSize: '32px', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', margin: 0 }}>Rootlink</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <a href="/rootlink-extension.zip" download style={{
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
              color: 'white',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Get Extension
            </a>
            {graphMode === 'hidden' ? (
               <button onClick={() => setGraphMode('normal')} style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'var(--primary)', border: '1px solid rgba(59,130,246,0.4)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Show Graph &gt;</button>
            ) : graphMode === 'normal' ? (
               <button onClick={() => setGraphMode('hidden')} style={{ background: 'rgba(0,0,0,0.4)', color: 'var(--text-disabled)', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>&lt; Hide Graph</button>
            ) : null}
          </div>
        </div>

        {/* Content Reader / Node Detail */}
        <div className="flex-1 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column' }}>

          {/* OVERALL KNOWLEDGE (GLOBAL SUMMARY) */}
          <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Overall Knowledge
              {loadingGlobalSummary && <span style={{ color: 'var(--primary)', animation: 'pulse-glow 1.5s infinite' }}>Updating...</span>}
            </h3>
            
            {!globalSummary ? (
              <div style={{ color: 'var(--text-disabled)', fontSize: '14px', fontStyle: 'italic' }}>
                {nodes.length > 0 ? "Analyzing knowledge base..." : "No knowledge captured yet. Capture webpages or videos to start building your knowledge base."}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-body)' }}>
                  {globalSummary.overview}
                </div>
                
                {globalSummary.majorTopics && globalSummary.majorTopics.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>Major Topics</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {globalSummary.majorTopics.map((t: any, i: number) => (
                        <span key={i} style={{ padding: '4px 8px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '6px', fontSize: '12px', color: 'var(--accent)' }}>
                          {t.topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {globalSummary.commonConcepts && globalSummary.commonConcepts.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>Common Concepts</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {globalSummary.commonConcepts.map((c: string, i: number) => (
                        <span key={i} style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                          {c}{i < globalSummary.commonConcepts.length - 1 ? ' � ' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: '12px', color: 'var(--text-disabled)', fontWeight: 600 }}>
                  Sources: {globalSummary.sourceCount || nodes.length}
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", flex: 1 }}>
            {selectedNode ? (
            <div className="animate-fade-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              
              <div>
                <h2 className="heading-style" style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1.3, marginBottom: 'var(--space-2)' }}>
                  {selectedNode.type === 'youtube_video' && <PlaySquare size={24} style={{ display: 'inline', color: '#ff0000', marginRight: 8, verticalAlign: 'text-bottom' }} />}
                  {selectedNode.canonicalName}
                </h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '4px 12px', fontSize: 12, fontWeight: 800, borderRadius: 100, letterSpacing: '0.04em',
                    background: selectedNode.trustScore >= 0.75 ? 'rgba(46, 230, 166, 0.15)' : selectedNode.trustScore >= 0.5 ? 'rgba(255, 184, 77, 0.15)' : 'rgba(255, 92, 122, 0.15)',
                    color: selectedNode.trustScore >= 0.75 ? 'var(--primary)' : selectedNode.trustScore >= 0.5 ? 'var(--trust-med)' : 'var(--trust-low)',
                    boxShadow: `0 0 12px ${selectedNode.trustScore >= 0.75 ? 'rgba(46, 230, 166, 0.2)' : selectedNode.trustScore >= 0.5 ? 'rgba(255, 184, 77, 0.2)' : 'rgba(255, 92, 122, 0.2)'}`
                  }}>
                    {(selectedNode.trustScore * 100).toFixed(0)}% TRUST
                  </span>
                  {selectedNode.sourceUrl && (
                    <a href={selectedNode.sourceUrl} target="_blank" rel="noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 13, color: 'var(--secondary)', textDecoration: 'none', wordBreak: 'break-all', fontWeight: 500,
                      textShadow: '0 0 8px rgba(56, 189, 248, 0.3)'
                    }}>
                      <ExternalLink size={14} />
                      {selectedNode.sourceUrl.substring(0, 40)}{selectedNode.sourceUrl.length > 40 ? '...' : ''}
                    </a>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--text-disabled)', fontWeight: 600 }}>
                    Mentioned {selectedNode.mentionCount} times
                  </span>
                </div>
                
                {selectedNode.type === 'youtube_video' && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-disabled)', alignItems: 'center' }}>
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

              
              {/* TABS */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px', marginBottom: '32px' }}>
                <button onClick={() => setActiveTab('summary')} style={{ padding: '8px 24px', background: activeTab === 'summary' ? 'rgba(53, 214, 199, 0.10)' : 'transparent', border: activeTab === 'summary' ? '1px solid rgba(53, 214, 199, 0.25)' : '1px solid transparent', color: activeTab === 'summary' ? 'var(--primary)' : 'var(--text-disabled)', borderRadius: '100px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s' }}>Summary</button>
                <button onClick={() => setActiveTab('mindmap')} style={{ padding: '8px 24px', background: activeTab === 'mindmap' ? 'rgba(53, 214, 199, 0.10)' : 'transparent', border: activeTab === 'mindmap' ? '1px solid rgba(53, 214, 199, 0.25)' : '1px solid transparent', color: activeTab === 'mindmap' ? 'var(--primary)' : 'var(--text-disabled)', borderRadius: '100px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s' }}>Mind Map</button>
                <button onClick={() => setActiveTab('sources')} style={{ padding: '8px 24px', background: activeTab === 'sources' ? 'rgba(53, 214, 199, 0.10)' : 'transparent', border: activeTab === 'sources' ? '1px solid rgba(53, 214, 199, 0.25)' : '1px solid transparent', color: activeTab === 'sources' ? 'var(--primary)' : 'var(--text-disabled)', borderRadius: '100px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s' }}>Sources</button>
              </div>

              {activeTab === 'summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* LOCAL SUMMARY */}
                  {canonicalSummary.overview && (
                    <div className="card-shell" style={{ padding: '20px', background: 'transparent' }}>
                      <h3 style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 12 }}>Local summary</h3>
                      <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-body)' }}>{canonicalSummary.overview}</p>
                    </div>
                  )}
                  
                  
                    {/* RELATED KNOWLEDGE (SEMANTIC LINKS) */}
                    <div className="card-shell" style={{ padding: '20px', background: 'transparent', marginTop: 16 }}>
                      <h3 style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 16 }}>Related Knowledge</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {edges.filter((e: any) => e.sourceId === selectedNode.id || e.targetId === selectedNode.id).map((edge: any) => {
                          const otherId = edge.sourceId === selectedNode.id ? edge.targetId : edge.sourceId;
                          const otherNode = nodes.find((n: any) => n.id === otherId);
                          if (!otherNode) return null;
                          return (
                            <div key={edge.id} style={{ display: 'flex', alignItems: 'center', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleNodeSelect(otherNode as TrustNode)}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, color: 'white', fontWeight: 600 }}>{otherNode.canonicalName}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 4 }}>
                                  {Math.round(edge.confidence * 100)}% &bull; <span style={{ textTransform: 'capitalize' }}>{edge.origin}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {edges.filter((e: any) => e.sourceId === selectedNode.id || e.targetId === selectedNode.id).length === 0 && (
                          <div style={{ fontSize: 13, color: 'var(--text-disabled)', fontStyle: 'italic' }}>No related knowledge found yet.</div>
                        )}
                      </div>
                    </div>

                    {/* MAIN CONCEPTS & SECTIONS */}
                  {canonicalSummary.sections.length > 0 && (
                    <div className="card-shell" style={{ padding: '20px', isolation: 'isolate', overflow: 'hidden' }}>
                      <h3 style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 12 }}>Main Concepts & Sections</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {canonicalSummary.sections.map((sec: any, i: number) => (
                          <div key={i} style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                            <strong style={{ color: 'white', fontSize: 14, display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>{sec.title || sec.heading}</strong>
                            <p style={{ fontSize: 13, color: 'var(--text-disabled)', marginBottom: (sec.keyPoints?.length > 0) ? 12 : 0, lineHeight: 1.5 }}>{sec.explanation}</p>
                            {sec.keyPoints && sec.keyPoints.length > 0 && (
                              <ul style={{ listStyle: 'circle', marginLeft: 20, color: 'var(--text-body)', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {sec.keyPoints.map((kp: string, j: number) => (
                                  <li key={j}>{kp}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* KEY INSIGHTS */}
                  {canonicalSummary.keyTakeaways.length > 0 && (
                    <div className="card-shell" style={{ padding: '20px 24px', isolation: 'isolate', overflow: 'hidden' }}>
                      <h3 style={{
                        fontSize: 12, fontWeight: 800, color: 'var(--primary)',
                        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <FileText size={16} /> Key Insights
                      </h3>
                      <ul style={{ listStyle: 'disc', marginLeft: 16, color: 'var(--text-heading)', fontSize: 14, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {canonicalSummary.keyTakeaways.map((insight: string, idx: number) => (
                          <li key={idx}>
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{insight}</ReactMarkdown>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                    </div>
                  )}


              {/* Related Knowledge Section */}
              {(() => {
                const semanticLinks = edges.filter(e => (e.sourceId === selectedNode.id || e.targetId === selectedNode.id) && e.origin === 'automatic');
                if (semanticLinks.length === 0) return null;
                return (
                  <div style={{ marginTop: 24, borderTop: '1px solid var(--border-glass)', paddingTop: 16 }}>
                    <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                      Related Knowledge
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {semanticLinks.map(link => {
                        const isOutgoing = link.sourceId === selectedNode.id;
                        const relatedNodeId = isOutgoing ? link.targetId : link.sourceId;
                        const relatedNode = nodes.find(n => n.id === relatedNodeId);
                        if (!relatedNode) return null;
                        return (
                          <div key={link.id} className="card-shell" style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', cursor: 'pointer' }} title={link.relationshipType}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 13, color: 'var(--text-heading)', fontWeight: 500 }}>◉ {relatedNode.canonicalName}</span>
                              <span style={{ fontSize: 11, color: 'var(--primary)' }}>{Math.round(link.confidence * 100)}% related</span>
                            </div>
                            {link.reason && (
                              <p style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 8, lineHeight: 1.4 }}>
                                <strong>Why Connected?</strong><br/>
                                {link.reason}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Old Sections Block Removed to prevent crash and redundancy */}

              {/* YouTube Key Moments */}
              {selectedNode.type === 'youtube_video' && selectedNode.keyMoments && selectedNode.keyMoments.length > 0 && (
                <div className="card-shell" style={{ padding: '20px 24px', marginTop: '16px', background: 'rgba(255, 0, 0, 0.05)', borderColor: 'rgba(255, 0, 0, 0.15)' }}>
                  <h3 style={{
                    fontSize: 11, fontWeight: 700, color: '#ff4444',
                    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <PlayCircle size={14} /> Key Moments
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {selectedNode.keyMoments.map((moment: any, idx: number) => (
                      <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: '8px', borderLeft: '3px solid #ff4444' }}>
                        <a 
                          href={`https://youtube.com/watch?v=${selectedNode.videoId}&t=${moment.timestampSeconds}s`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', marginBottom: '8px' }}
                        >
                          <PlayCircle size={12} /> {moment.timestampFormatted}
                        </a>
                        <p style={{ fontSize: '13px', color: 'var(--text-heading)', fontWeight: 600, marginBottom: '6px' }}>{moment.insight}</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-disabled)', fontStyle: 'italic', paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                          "{moment.transcriptExcerpt}"
                        </p>
                      </div>
                    ))}
                  </div>
  
              

              </div>
              )}

              {/* Formulas Liquid Glass Card */}
              {((selectedNode.structuredSummary?.formulas && selectedNode.structuredSummary.formulas.length > 0) || (selectedNode.formulas && selectedNode.formulas.length > 0)) && (
                <div className="card-shell" style={{ padding: '20px 24px', marginTop: '16px', background: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.2)' }}>
                  <h3 style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    Formulas on this page
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {(selectedNode.structuredSummary?.formulas || selectedNode.formulas || []).map((f: any, i: number) => (
                      <div key={i} style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 12 }}>
                          {f.label || f.type || 'Formula'}
                        </div>
                        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
                          <BlockMath math={f.latex} />
                        </div>
                        {f.context && (
                          <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 8, fontStyle: 'italic' }}>
                            {f.context}
                          </div>
                        )}
                        {!f.context && f.surroundingContext && (
                          <div style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 8, fontStyle: 'italic' }}>
                            {f.surroundingContext}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
  
              

              </div>
              )}

              {/* Worked Problems Liquid Glass Card */}
              {selectedNode.workedProblems && selectedNode.workedProblems.length > 0 && (
                <div className="card-shell" style={{ padding: '20px 24px', marginTop: '16px', background: 'rgba(217, 70, 239, 0.08)', borderColor: 'rgba(217, 70, 239, 0.2)' }}>
                  <h3 style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    Worked Problems
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {selectedNode.workedProblems.map((p, i) => (
                      <div key={i} style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '8px' }}>Problem</h4>
                        <p style={{ fontSize: '13px', color: 'var(--text-body)', marginBottom: '12px' }}>{p.problemStatement}</p>
                        
                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '8px' }}>Solution Steps</h4>
                        <div style={{ fontSize: '13px', color: 'var(--text-body)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {p.solutionSteps.map((step, si) => (
                            <ReactMarkdown key={si} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{step}</ReactMarkdown>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
  
              

              </div>
              )}

              {/* Meta Badges */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span className="card-shell" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  fontSize: 12, color: 'var(--text-heading)', fontWeight: 500,
                  padding: '8px 14px', borderRadius: 12
                }}>
                  <Shield size={14} color="var(--primary)" /> {edges.filter(e => e.targetId === selectedNode.id).length} incoming
                </span>
                <span className="card-shell" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  fontSize: 12, color: 'var(--text-heading)', fontWeight: 500,
                  padding: '8px 14px', borderRadius: 12
                }}>
                  <GitBranch size={14} color="var(--secondary)" /> {edges.filter(e => e.sourceId === selectedNode.id).length} outgoing
                </span>
              </div>

              {/* Context Snippets (Muted, Collapsible) */}
              {selectedNode.sourceReferences && selectedNode.sourceReferences.length > 0 && (
                <details style={{ marginTop: 16, cursor: 'pointer', outline: 'none' }}>
                  <summary style={{ 
                    fontSize: 11, fontWeight: 700, color: 'var(--text-disabled)', 
                    textTransform: 'uppercase', letterSpacing: '0.1em', 
                    padding: '8px 12px', background: 'rgba(0,0,0,0.1)', borderRadius: 8,
                    userSelect: 'none', listStyle: 'none', display: 'inline-flex', alignItems: 'center', gap: 6
                  }}>
                    <span style={{ fontSize: '10px' }}>▼</span> Raw Context Snippets
                  </summary>
                  <div className="card-shell" style={{ padding: '16px', marginTop: 8, opacity: 0.7, background: 'rgba(0,0,0,0.1)' }}>
                    <div className="text-[12px] text-[var(--text-disabled)] leading-relaxed" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {selectedNode.sourceReferences[0]?.contextSnippet || 'No snippet available.'}
                    </div>
                  </div>
                </details>
              )}



              
              {activeTab === 'mindmap' && (() => {
                const finalMindMap = normalizeMindMap((selectedNode as any).mindMap);
                
                if (finalMindMap) {
                  return (
                    <div style={{ flex: 1, minHeight: '650px', width: '100%', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column' }}>
                       
                       <MindMapViz mindMap={finalMindMap} />
                    </div>
                  );
                } else {
                  return (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-disabled)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      <Network size={48} style={{ opacity: 0.2 }} />
                      
                      {mindMapError ? (
                        <div style={{ color: '#ef4444' }}>
                           Mind map generation failed: {mindMapError}<br/>
                        </div>
                      ) : (
                        <div>
                           No mind map generated yet.<br/>
                           <span style={{ fontSize: '12px', opacity: 0.7 }}>Click below to generate a hierarchical conceptual map using AI.</span>
                        </div>
                      )}
                      
                      <button onClick={generateMindMap} disabled={isGeneratingMindMap} style={{ background: 'var(--primary)', color: 'black', padding: '10px 20px', borderRadius: '100px', border: 'none', fontWeight: 600, cursor: isGeneratingMindMap ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <RefreshCw size={16} className={isGeneratingMindMap ? "animate-spin" : ""} />
                        {isGeneratingMindMap ? 'Generating AI Mind Map...' : 'Generate AI Mind Map'}
                      </button>
                    </div>
                  );
                }
              })()}
              
{activeTab === 'sources' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {selectedNode.sourceReferences?.map((ref: any, idx: number) => (
                    <div key={idx} className="card-shell" style={{ padding: '16px', background: 'rgba(0,0,0,0.1)' }}>
                      <a href={ref.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', wordBreak: 'break-all' }}>{ref.url}</a>
                      <p style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 8, fontFamily: 'monospace' }}>{ref.contextSnippet}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Connections List */}
              <div style={{ marginTop: 24 }}>
                <h3 style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--text-disabled)',
                  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <LinkIcon size={14} /> Connections
                </h3>
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
                    return <div style={{ fontSize: 13, color: 'var(--text-disabled)', fontStyle: 'italic' }}>No connections yet.</div>;
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {connections.map(c => (
                        <div key={c.edgeId} className="card-shell" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.1)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-body)' }}>
                            {c.isOutgoing ? <Shield size={12} color="var(--secondary)" /> : <Shield size={12} color="var(--primary)" />}
                            <span style={{ maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.node?.canonicalName}</span>
                          </div>
                          <button 
                            onClick={() => handleUnlinkNode(c.sourceId, c.realTargetId)}
                            disabled={unlinkingId === `${c.sourceId}-${c.realTargetId}`}
                            style={{ background: 'transparent', border: 'none', color: unlinkingId === `${c.sourceId}-${c.realTargetId}` ? 'var(--text-disabled)' : 'var(--danger, #ef4444)', cursor: unlinkingId === `${c.sourceId}-${c.realTargetId}` ? 'not-allowed' : 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                            title="Unlink"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Delete Node Button */}
              <div style={{ marginTop: 32, padding: '16px 0', borderTop: '1px solid var(--border-glass)' }}>
                <button
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 600, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                >
                  <Trash2 size={16} /> Delete Node
                </button>
              </div>
            </div>
          ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-disabled)', fontSize: '14px', fontStyle: 'italic' }}>
                Select a source from the graph to view details.
              </div>
            )}
            </div>
        </div>

        </aside>

                  {/* SECONDARY WORKSPACE: Knowledge Graph */}
      <main 
        className="relative flex flex-col transition-all duration-300" 
        style={{ 
          height: '100%', 
          flex: graphMode === 'expanded' ? '1' : graphMode === 'hidden' ? '0' : '2.8',
          display: graphMode === 'hidden' ? 'none' : 'flex',
          overflow: 'hidden',
          background: 'var(--glass-fill)',
          borderLeft: '1px solid var(--border-glass)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.2)'
        }}
      >
        {/* Graph Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
           <div>
             <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Knowledge Graph</h2>
           </div>
           <div style={{ display: 'flex', gap: 8 }}>
             {graphMode === 'expanded' ? (
                <button onClick={() => setGraphMode('normal')} style={{ background: 'rgba(0,0,0,0.4)', border: 'none', color: 'white', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Shrink Graph</button>
             ) : (
                <button onClick={() => setGraphMode('expanded')} style={{ background: 'rgba(0,0,0,0.4)', border: 'none', color: 'white', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>⛶ Expand</button>
             )}
           </div>
        </div>

        {/* Graph Search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.15)', flexShrink: 0 }}>
          <Search size={16} color="var(--text-disabled)" />
          <input 
            type="text"
            placeholder="Search knowledge..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '14px' }}
          />
          {searchQuery && <X size={16} color="var(--text-disabled)" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />}
        </div>
        
        {/* Graph Canvas */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
          {nodes.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-disabled)', flexDirection: 'column', gap: '16px' }}>
              <Network size={48} style={{ opacity: 0.2 }} />
              <div style={{ fontSize: '13px', textAlign: 'center', lineHeight: 1.6 }}>
                No knowledge yet<br/>
                Capture a webpage or video to start building Rootlink.
              </div>
            </div>
          ) : (
            <GraphViz nodes={nodes} edges={edges} onNodeSelect={handleNodeSelect} onEdgeSelect={handleEdgeSelect} selectedNodeId={selectedNode?.id} searchQuery={searchQuery} />
          )}
        </div>

        {/* Recent Nodes */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)', flexShrink: 0 }}>
          <h3 style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Recent Nodes</h3>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[...nodes].sort((a, b) => (b.firstSeen || 0) - (a.firstSeen || 0)).slice(0, 5).map(node => (
              <button 
                key={node.id} 
                onClick={() => handleNodeSelect(node)}
                style={{ 
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
                  padding: '4px 10px', borderRadius: '100px', color: 'var(--text-body)', 
                  fontSize: '12px', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-body)'; }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: node.trustScore >= 0.75 ? 'var(--primary)' : node.trustScore >= 0.5 ? 'var(--trust-med)' : 'var(--trust-low)' }} />
                {node.canonicalName}
              </button>
            ))}
          </div>
        </div>

        {/* Graph Stats */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)' }}>{nodes.length}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nodes</div>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-glass)', borderRight: '1px solid var(--border-glass)' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)' }}>{edges.length}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Links</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-heading)' }}>{Math.round(nodes.length ? (nodes.reduce((sum, n) => sum + n.trustScore, 0) / nodes.length * 100) : 0)}%</div>
              <div style={{ fontSize: '10px', color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Avg Trust</div>
            </div>
          </div>
        </div>
        
        {/* Establish Link Action */}
        <div style={{ padding: '12px 16px 16px 16px', flexShrink: 0 }}>
          <button 
            onClick={() => setIsLinkingModalOpen(true)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <LinkIcon size={16} /> Establish Link
          </button>
        </div>
      </main>

      
      {/* Link Nodes Modal */}
      {isLinkingModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(10px)'
        }}>
          <div className="card-shell" style={{ width: '400px', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'visible' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-heading)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Establish Knowledge Link</h3>
              <button onClick={() => setIsLinkingModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-disabled)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={(e) => { handleLinkNodes(e); setIsLinkingModalOpen(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SearchableSelect nodes={nodes} value={linkSource} onChange={setLinkSource} placeholder="Select Source Node..." />
              <SearchableSelect nodes={nodes} value={linkTarget} onChange={setLinkTarget} placeholder="Select Target Node..." />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsLinkingModalOpen(false)} style={{ padding: '10px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isLinking || !linkSource || !linkTarget} style={{ padding: '10px 16px', borderRadius: '8px', background: (isLinking || !linkSource || !linkTarget) ? 'var(--border-glass)' : 'var(--primary)', color: 'white', border: 'none', cursor: (isLinking || !linkSource || !linkTarget) ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Create Link</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {nodeToDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="card-shell" style={{
            width: '100%', maxWidth: '400px', padding: '32px',
            display: 'flex', flexDirection: 'column', gap: '24px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px var(--border-glass)',
            animation: 'fade-slide 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
          }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '8px' }}>Delete Node</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-body)', lineHeight: 1.6 }}>
                Are you sure you want to delete this node? This action will remove it and all of its connections from the current session permanently.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setNodeToDelete(null)}
                style={{
                  padding: '10px 20px', borderRadius: 'var(--radius-md)',
                  background: 'transparent', color: 'var(--text-body)', border: '1px solid var(--border-glass)',
                  fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-heading)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-body)'; }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteNode}
                disabled={isDeleting}
                style={{
                  padding: '10px 20px', borderRadius: 'var(--radius-md)',
                  background: isDeleting ? 'var(--border-glass)' : 'linear-gradient(135deg, #ef4444, #dc2626)', color: isDeleting ? 'var(--text-disabled)' : 'white', border: 'none',
                  fontWeight: 600, fontSize: '14px', cursor: isDeleting ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease',
                  boxShadow: isDeleting ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.3)'
                }}
                onMouseEnter={e => { if(!isDeleting) { e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                onMouseLeave={e => { if(!isDeleting) { e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)'; e.currentTarget.style.transform = 'none'; } }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="card-shell" style={{ position: 'fixed', top: 'var(--space-4)', right: 'var(--space-4)', zIndex: 100, display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-2) var(--space-3)', animation: 'fade-slide 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-heading)' }}>{toast}</span>
        </div>
      )}
    </div>
  );
}
