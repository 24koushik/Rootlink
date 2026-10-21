'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { TrustNode, TrustEdge } from '@/lib/graph';

interface GraphVizProps {
  nodes: TrustNode[];
  edges?: TrustEdge[];
  onNodeSelect: (node: TrustNode) => void;
  onEdgeSelect?: (edge: TrustEdge) => void;
  selectedNodeId?: string | null;
  searchQuery?: string;
}

interface TooltipData {
  node: TrustNode;
  x: number;
  y: number;
}

function getNodeColor(node: TrustNode): string {
  if (node.trustScore === 0) return '#ef4444';
  if (node.trustScore >= 0.75) return '#10b981';
  if (node.trustScore >= 0.50) return '#f59e0b';
  return '#94a3b8';
}

function getNodeRadius(node: TrustNode, incomingEdges: number): number {
  const baseRadius = 20;
  const connectionBonus = Math.min(incomingEdges * 3.5, 18);
  return baseRadius + connectionBonus;
}

function getRingCount(node: TrustNode, incomingEdges: number, outgoingEdges: number): number {
  if (node.trustScore >= 0.85 && incomingEdges >= 2) return 3;
  if (outgoingEdges >= 1 && node.trustScore >= 0.6) return 2;
  return 1;
}

function truncateLabel(title: string, maxLen: number = 22): string {
  if (!title) return '';
  if (title.length <= maxLen) return title;
  return title.substring(0, maxLen) + '…';
}

export default function GraphViz({ nodes: rawNodes, edges: rawEdges = [], onNodeSelect, onEdgeSelect, selectedNodeId, searchQuery = '' }: GraphVizProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const callbacksRef = useRef({ onNodeSelect, onEdgeSelect, setTooltip });
  useEffect(() => {
    callbacksRef.current.onNodeSelect = onNodeSelect;
    callbacksRef.current.setTooltip = setTooltip;
  }, [onNodeSelect, setTooltip]);

  const { links, incomingCounts, outgoingCounts } = useMemo(() => {
    const edgeList = rawEdges.map(e => ({ ...e, source: e.sourceId, target: e.targetId }));
    const inCount = new Map<string, number>();
    const outCount = new Map<string, number>();
    
    rawNodes.forEach(node => {
      inCount.set(node.id, 0);
      outCount.set(node.id, 0);
    });

    edgeList.forEach(e => {
      outCount.set(e.source, (outCount.get(e.source) || 0) + 1);
      inCount.set(e.target, (inCount.get(e.target) || 0) + 1);
    });

    return { links: edgeList, incomingCounts: inCount, outgoingCounts: outCount };
  }, [rawNodes, rawEdges]);

  const graphRefs = useRef({
    initialized: false,
    simulation: null as d3.Simulation<any, any> | null,
    g: null as d3.Selection<SVGGElement, any, any, any> | null,
    linkGroup: null as d3.Selection<SVGGElement, any, any, any> | null,
    pulseGroup: null as d3.Selection<SVGGElement, any, any, any> | null,
    nodeGroup: null as d3.Selection<SVGGElement, any, any, any> | null,
    mmg: null as d3.Selection<SVGGElement, any, any, any> | null,
    mmViewport: null as d3.Selection<SVGRectElement, any, any, any> | null,
    width: 0,
    height: 0,
    previousNodeIds: new Set<string>(),
    previousLinkIds: new Set<string>(),
    zoom: null as d3.ZoomBehavior<SVGSVGElement, unknown> | null,
  });

  useEffect(() => {
    if (!containerRef.current || !minimapRef.current) return;
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 700;

    if (!graphRefs.current.initialized) {
      containerRef.current.querySelectorAll('.main-graph-svg').forEach(el => el.remove());
      minimapRef.current.innerHTML = '';

      const svg = d3.select(containerRef.current)
        .append('svg')
        .attr('class', 'main-graph-svg absolute inset-0')
        .attr('width', width)
        .attr('height', height)
        .style('background', 'transparent')
        .on('click', () => callbacksRef.current.setTooltip(null));

      const defs = svg.append('defs');
      
      defs.append('marker')
        .attr('id', 'arrow-default')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 38)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L8,0L0,4')
        .attr('fill', 'rgba(16, 185, 129, 0.4)');

      // Grid Pattern (Soft Mint Lines)
      const pattern = defs.append('pattern').attr('id', 'radar-grid').attr('width', 60).attr('height', 60).attr('patternUnits', 'userSpaceOnUse');
      pattern.append('path').attr('d', 'M 60 0 L 0 0 0 60').attr('fill', 'none').attr('stroke', 'rgba(16, 185, 129, 0.08)').attr('stroke-width', 1);
      const gridRect = svg.append('rect').attr('width', '100%').attr('height', '100%').attr('fill', 'url(#radar-grid)');

      const g = svg.append('g');

      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.15, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
          gridRect.attr('transform', `translate(${event.transform.x % 60}, ${event.transform.y % 60}) scale(${event.transform.k})`);
          if (graphRefs.current.mmViewport) {
            graphRefs.current.mmViewport
              .attr('x', -event.transform.x / event.transform.k)
              .attr('y', -event.transform.y / event.transform.k)
              .attr('width', width / event.transform.k)
              .attr('height', height / event.transform.k);
          }
        });
      svg.call(zoom);
      graphRefs.current.zoom = zoom;

      // 3D Marble Gradients
      ['#10b981', '#f59e0b', '#ef4444', '#94a3b8'].forEach(color => {
        const safeId = color.replace(/[^a-zA-Z0-9-]/g, '');
        const grad = defs.append('radialGradient').attr('id', `marble-${safeId}`).attr('cx', '35%').attr('cy', '35%').attr('r', '65%');
        grad.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.9);
        grad.append('stop').attr('offset', '35%').attr('stop-color', color).attr('stop-opacity', 0.95);
        grad.append('stop').attr('offset', '100%').attr('stop-color', '#064e3b').attr('stop-opacity', 0.9);
      });

      const shadowFilter = defs.append('filter').attr('id', 'shadow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      shadowFilter.append('feDropShadow').attr('dx', '0').attr('dy', '4').attr('stdDeviation', '6').attr('flood-color', 'rgba(16, 185, 129, 0.25)');

      const blurFilter = defs.append('filter').attr('id', 'glow-blur').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      blurFilter.append('feGaussianBlur').attr('stdDeviation', '14');

      const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id((d: any) => d.id).distance(160).strength(0.6))
        .force('charge', d3.forceManyBody().strength(-450).distanceMax(800))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('x', d3.forceX(width / 2).strength(0.06))
        .force('y', d3.forceY(height / 2).strength(0.06))
        .force('collide', d3.forceCollide().radius((d: any) => d.radius + 40).iterations(3))
        .on('tick', () => {
          if (graphRefs.current.linkGroup && graphRefs.current.pulseGroup) {
            const linkPath = (d: any) => {
              if (d.source.x === undefined || d.target.x === undefined) return '';
              const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y, dr = Math.sqrt(dx * dx + dy * dy) * 1.2;
              return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
            };
            graphRefs.current.linkGroup.selectAll('path').attr('d', linkPath);
            graphRefs.current.pulseGroup.selectAll('path').attr('d', linkPath);
            
            // Calculate label coordinates based on bezier curve
            graphRefs.current.linkGroup.selectAll('text.edge-label')
              .attr('x', (d: any) => {
                 if (d.source.x === undefined || d.target.x === undefined) return 0;
                 const dx = d.target.x - d.source.x;
                 return d.source.x + dx / 2;
              })
              .attr('y', (d: any) => {
                 if (d.source.y === undefined || d.target.y === undefined) return 0;
                 const dx = d.target.x - d.source.x;
                 const dy = d.target.y - d.source.y;
                 return d.source.y + dy / 2 - 10;
              });
          }
          if (graphRefs.current.nodeGroup) {
            graphRefs.current.nodeGroup.selectAll('.graph-node').attr('transform', function(d: any) {
              const currentTransform = d3.select(this).attr('transform') || '';
              const scaleMatch = currentTransform.match(/scale\(([^)]+)\)/);
              const scale = scaleMatch ? scaleMatch[1] : 1;
              return `translate(${d.x},${d.y}) scale(${scale})`;
            });
          }
          if (graphRefs.current.mmg) {
            graphRefs.current.mmg.selectAll('circle')
              .attr('cx', (d: any) => d.x)
              .attr('cy', (d: any) => d.y);
          }
        });

      const mmSvg = d3.select(minimapRef.current)
        .attr('width', 80)
        .attr('height', 55)
        .attr('viewBox', `0 0 ${width} ${height}`);

      graphRefs.current = {
        initialized: true,
        simulation,
        g,
        linkGroup: g.append('g'),
        pulseGroup: g.append('g'),
        nodeGroup: g.append('g'),
        mmg: mmSvg.append('g').attr('class', 'minimap-nodes'),
        mmViewport: mmSvg.append('rect').attr('class', 'minimap-viewport').attr('fill', 'rgba(16, 185, 129, 0.12)').attr('stroke', '#10b981').attr('stroke-width', 8).attr('rx', 16),
        width,
        height,
        previousNodeIds: new Set(),
        previousLinkIds: new Set(),
        zoom,
      };
    }

    // --- Update Phase ---
    const uniqueNodesMap = new Map<string, TrustNode>();
    rawNodes.forEach(n => uniqueNodesMap.set(n.id, n));
    const uniqueRawNodes = Array.from(uniqueNodesMap.values());

    const d3Nodes = uniqueRawNodes.map((n) => {
      const inC = incomingCounts.get(n.id) || 0;
      const outC = outgoingCounts.get(n.id) || 0;
      return {
        ...n,
        radius: getNodeRadius(n, inC),
        rings: getRingCount(n, inC, outC),
        color: getNodeColor(n),
      };
    });

    const validNodeIds = new Set(d3Nodes.map(n => n.id));
    const validLinks = links.filter(l => {
      const sId = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const tId = typeof l.target === 'string' ? l.target : (l.target as any).id;
      return validNodeIds.has(sId) && validNodeIds.has(tId);
    });

    const currentNodeIds = new Set(d3Nodes.map(n => n.id));
    const currentLinkIds = new Set(validLinks.map(l => (l as any).id));

    // Check Topology changes
    let topologyChanged = false;
    if (currentNodeIds.size !== graphRefs.current.previousNodeIds.size || currentLinkIds.size !== graphRefs.current.previousLinkIds.size) {
      topologyChanged = true;
    } else {
      for (let id of currentNodeIds) if (!graphRefs.current.previousNodeIds.has(id)) { topologyChanged = true; break; }
      for (let id of currentLinkIds) if (!graphRefs.current.previousLinkIds.has(id)) { topologyChanged = true; break; }
    }

    graphRefs.current.previousNodeIds = currentNodeIds;
    graphRefs.current.previousLinkIds = currentLinkIds;

    const { simulation, linkGroup, pulseGroup, nodeGroup, mmg } = graphRefs.current;

    // Preserve existing D3 coordinates for nodes
    const existingNodesMap = new Map();
    simulation!.nodes().forEach((n: any) => existingNodesMap.set(n.id, n));
    d3Nodes.forEach((n: any) => {
      if (existingNodesMap.has(n.id)) {
        const existing = existingNodesMap.get(n.id);
        n.x = existing.x;
        n.y = existing.y;
        n.vx = existing.vx;
        n.vy = existing.vy;
        n.fx = existing.fx;
        n.fy = existing.fy;
      }
    });

    // Update Links
    linkGroup!.selectAll('path')
      .data(validLinks, (d: any) => (d as any).id)
      .join('path')
      .attr('class', 'edge-path')
      .style('cursor', 'pointer')
      .on('click', (event, d) => { event.stopPropagation(); if(callbacksRef.current.onEdgeSelect) callbacksRef.current.onEdgeSelect(d as unknown as TrustEdge); })
      .attr('fill', 'none')
      .attr('stroke', (d: any) => (d as any).origin === 'automatic' ? 'rgba(16, 185, 129, 0.35)' : (d as any).origin === 'manual' ? 'rgba(21, 128, 61, 0.7)' : 'rgba(148, 163, 184, 0.4)')
      .attr('stroke-width', (d: any) => (d as any).origin === 'manual' ? 2.5 : 1.5)
      .attr('stroke-dasharray', (d: any) => (d as any).origin === 'automatic' ? '4,4' : 'none')
      .attr('marker-end', 'url(#arrow-default)');
      
    // Add Labels for Links
    linkGroup!.selectAll('text.edge-label')
      .data(validLinks, (d: any) => `label-${(d as any).id}`)
      .join('text')
      .attr('class', 'edge-label')
      .attr('fill', (d: any) => (d as any).origin === 'automatic' ? '#059669' : '#15803d')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .text((d: any) => (d as any).origin === 'automatic' ? 'AI' : (d as any).origin === 'manual' ? 'MANUAL' : '');

    pulseGroup!.selectAll('path')
      .data(validLinks, (d: any) => `pulse-${(d as any).id}`)
      .join('path')
      .attr('class', 'edge-pulse edge-flow')
      .attr('fill', 'none')
      .attr('stroke', (d: any) => {
        const sourceColor = getNodeColor(d.source as TrustNode || d3Nodes.find(n => n.id === d.source) as TrustNode);
        return sourceColor;
      })
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')
      .attr('stroke-opacity', 0.6);

    // Update Nodes
    const nodeJoin = nodeGroup!.selectAll('.graph-node')
      .data(d3Nodes, (d: any) => d.id)
      .join(
        enter => {
          const g = enter.append('g')
            .attr('class', 'graph-node')
            .attr('cursor', 'pointer')
            .style('transform-origin', 'center')
            .attr('transform', (d: any) => `translate(${d.x || width/2},${d.y || height/2}) scale(0)`);

          g.on('click', (event, d) => {
            event.stopPropagation();
            callbacksRef.current.onNodeSelect(d as TrustNode);
          })
          .on('mouseenter', (event, d) => {
            const [mx, my] = d3.pointer(event, containerRef.current);
            callbacksRef.current.setTooltip({ node: d as TrustNode, x: mx, y: my });
            d3.select(event.currentTarget).select('.node-visuals').transition().duration(300).ease(d3.easeElasticOut).attr('transform', 'scale(1.15)');
          })
          .on('mouseleave', (event) => {
            callbacksRef.current.setTooltip(null);
            d3.select(event.currentTarget).select('.node-visuals').transition().duration(300).ease(d3.easeElasticOut).attr('transform', 'scale(1)');
          })
          .call(d3.drag<SVGGElement, any>()
            .on('start', function(event, d) {
              if (!event.active) simulation!.alphaTarget(0.3).restart();
              d.fx = d.x; d.fy = d.y;
              callbacksRef.current.setTooltip(null);
              d3.select(this).classed('graph-dragging', true);
            })
            .on('drag', function(event, d) { 
              d.fx = event.x; d.fy = event.y;
            })
            .on('end', function(event, d) {
              if (!event.active) simulation!.alphaTarget(0);
              d3.select(this).classed('graph-dragging', false);
            }) as any
          );

          const visuals = g.append('g')
            .attr('class', 'node-visuals');

          visuals.append('circle').attr('class', 'node-glow');
          visuals.append('g').attr('class', 'rings-container');
          visuals.append('circle').attr('class', 'main-circle').attr('stroke', 'rgba(255,255,255,0.8)').attr('stroke-width', 2).attr('filter', 'url(#shadow)');
          
          visuals.append('text').attr('class', 'node-label')
            .attr('y', 4).attr('font-size', '13px').attr('fill', '#0f2d24')
            .attr('font-weight', '700').attr('letter-spacing', '-0.01em')
            .attr('font-family', 'Inter, system-ui, sans-serif').attr('pointer-events', 'none')
            .style('text-shadow', '0 1px 3px rgba(255,255,255,0.9), 0 0 2px #ffffff');

          visuals.append('text').attr('class', 'node-score')
            .attr('x', 0).attr('text-anchor', 'middle').attr('font-size', '11px').attr('fill', '#15803d')
            .attr('font-weight', '800').attr('font-family', 'Inter, system-ui, sans-serif').attr('pointer-events', 'none');

          g.transition().duration(800).ease(d3.easeElasticOut)
            .attr('transform', (d: any) => `translate(${d.x || width/2},${d.y || height/2}) scale(1)`);
            
          return g;
        },
        update => update,
        exit => exit.transition().duration(300).attr('transform', (d: any) => `translate(${d.x},${d.y}) scale(0)`).remove()
      );

    // Update node visual attributes
    nodeJoin.select('.node-glow')
      .transition().duration(400)
      .attr('r', (d: any) => d.radius + 18)
      .attr('fill', (d: any) => d.color)
      .attr('opacity', 0.28)
      .attr('filter', 'url(#glow-blur)')
      .attr('pointer-events', 'none');

    nodeJoin.select('.main-circle')
      .transition().duration(400)
      .attr('r', (d: any) => d.radius)
      .attr('fill', (d: any) => `url(#marble-${d.color.replace(/[^a-zA-Z0-9-]/g, '')})`);

    nodeJoin.select('.node-label')
      .text((d: any) => truncateLabel(d.canonicalName))
      .transition().duration(400)
      .attr('x', (d: any) => d.radius + 14);

    nodeJoin.select('.node-score')
      .text((d: any) => `${Math.round(d.trustScore * 100)}%`)
      .transition().duration(400)
      .attr('y', (d: any) => d.radius + 18);

    // Update rings safely
    nodeJoin.select('.rings-container').each(function(d: any) {
      const g = d3.select(this);
      const ringData = Array.from({length: d.rings}, (_, i) => i + 1);
      g.selectAll('circle').data(ringData).join('circle')
        .attr('fill', 'none')
        .attr('stroke', d.color)
        .attr('pointer-events', 'none')
        .attr('stroke-dasharray', i => i > 1 ? '3,4' : 'none')
        .transition().duration(400)
        .attr('r', i => d.radius + i * 7)
        .attr('stroke-width', 1.2)
        .attr('stroke-opacity', 0.35);
    });

    mmg!.selectAll('circle')
      .data(d3Nodes, (d: any) => d.id)
      .join('circle')
      .transition().duration(400)
      .attr('r', (d: any) => d.radius * 2)
      .attr('fill', (d: any) => d.color);

    // Feed updated data to simulation
    simulation!.nodes(d3Nodes as any);
    (simulation!.force('link') as d3.ForceLink<any, any>).links(validLinks);

    if (topologyChanged) {
      simulation!.alpha(0.3).restart();
    } else {
      simulation!.tick();
    }

  }, [rawNodes, rawEdges, incomingCounts, outgoingCounts, links]); 

  // --- External Highlights ---
  useEffect(() => {
    if (!graphRefs.current.initialized) return;
    const { linkGroup, pulseGroup, nodeGroup } = graphRefs.current;
    if (!linkGroup || !pulseGroup || !nodeGroup) return;

    let focusNodes = new Set<string>();
    let focusLinks = new Set<string>();

    if (selectedNodeId) {
      focusNodes.add(selectedNodeId);
      links.forEach(l => {
        const sourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
        const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
        
        if (sourceId === selectedNodeId) {
          focusNodes.add(targetId);
          focusLinks.add(`${sourceId}-${targetId}`);
        }
        if (targetId === selectedNodeId) {
          focusNodes.add(sourceId);
          focusLinks.add(`${sourceId}-${targetId}`);
        }
      });
    }

    nodeGroup.selectAll('.graph-node').attr('class', (d: any) => {
      let classes = 'graph-node';
      if (selectedNodeId) {
        if (d.id === selectedNodeId) {
          classes += ' graph-selected graph-focus';
        } else if (focusNodes.has(d.id)) {
          classes += ' graph-connected graph-focus';
        } else {
          classes += ' graph-visible';
        }
      }
      if (searchQuery && !d.canonicalName?.toLowerCase().includes(searchQuery.toLowerCase())) {
         classes += ' graph-search-dimmed';
      }
      return classes;
    });

    linkGroup.selectAll('path').attr('class', function(d: any) {
      let classes = 'edge-path';
      const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
      const targetId = typeof d.target === 'string' ? d.target : d.target.id;
      if (selectedNodeId && focusLinks.has(`${sourceId}-${targetId}`)) {
        classes += ' edge-highlighted';
      }
      return classes;
    });

    pulseGroup.selectAll('path').attr('class', function(d: any) {
      let classes = 'edge-pulse edge-flow';
      const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
      const targetId = typeof d.target === 'string' ? d.target : d.target.id;
      if (selectedNodeId && focusLinks.has(`${sourceId}-${targetId}`)) {
        classes += ' edge-highlighted';
      }
      return classes;
    });

  }, [selectedNodeId, searchQuery, links]);

  const handleResetView = useCallback(() => {
    if (!graphRefs.current.initialized || !graphRefs.current.simulation) return;
    
    // Unpin nodes
    graphRefs.current.simulation.nodes().forEach((n: any) => {
      n.fx = null;
      n.fy = null;
    });
    graphRefs.current.simulation.alpha(1).restart();
    
    // Reset zoom
    const svg = d3.select(containerRef.current).select('svg.main-graph-svg');
    if (svg.node() && graphRefs.current.zoom) {
      svg.transition().duration(750).call(graphRefs.current.zoom.transform as any, d3.zoomIdentity);
    }
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative" style={{ background: 'transparent' }}>
      {tooltip && (
        <div className="node-tooltip" style={{ left: tooltip.x + 16, top: tooltip.y - 12 }}>
          <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f2d24', marginBottom: '4px' }}>
            {tooltip.node.canonicalName}
          </div>
          <div style={{ fontSize: '12px', color: '#4b5563', marginBottom: '8px', lineHeight: 1.5 }}>
            {tooltip.node.sourceReferences?.[0]?.contextSnippet?.substring(0, 100) || 'No summary available.'}...
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>
            <span style={{ color: getNodeColor(tooltip.node) }}>Trust: {Math.round(tooltip.node.trustScore * 100)}%</span>
            <span>{tooltip.node.sourceReferences?.[0]?.timestamp ? new Date(tooltip.node.sourceReferences[0].timestamp).toLocaleDateString() : ''}</span>
          </div>
        </div>
      )}

      {/* Minimap in top-right corner */}
      <div 
        style={{ 
          position: 'absolute', 
          width: '80px', 
          height: '55px', 
          top: '12px', 
          right: '12px', 
          border: '1px solid #d1fae5', 
          background: '#f0fdf4',
          borderRadius: '8px',
          overflow: 'hidden',
          zIndex: 10
        }}
      >
        <svg ref={minimapRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Recenter Nodes Button */}
      <button
        onClick={handleResetView}
        style={{
          position: 'absolute', 
          top: '74px', 
          right: '12px', 
          zIndex: 10,
          padding: '4px 8px', 
          color: '#111827', 
          fontWeight: 600, 
          fontSize: '10px',
          cursor: 'pointer', 
          border: '1px solid #d1d5db', 
          background: '#ffffff',
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px', 
          borderRadius: '6px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        Recenter Nodes
      </button>
    </div>
  );
}
