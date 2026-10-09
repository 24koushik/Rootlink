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
  if (node.trustScore === 0) return 'var(--trust-low)';
  if (node.trustScore >= 0.75) return 'var(--trust-high)';
  if (node.trustScore >= 0.50) return 'var(--trust-med)';
  return 'var(--trust-unverified)';
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
        .attr('fill', 'rgba(255,255,255,0.3)');

      // Grid
      const pattern = defs.append('pattern').attr('id', 'radar-grid').attr('width', 80).attr('height', 80).attr('patternUnits', 'userSpaceOnUse');
      pattern.append('path').attr('d', 'M 80 0 L 0 0 0 80').attr('fill', 'none').attr('stroke', 'rgba(255,255,255,0.03)').attr('stroke-width', 1);
      const gridRect = svg.append('rect').attr('width', '100%').attr('height', '100%').attr('fill', 'url(#radar-grid)');

      const g = svg.append('g');

      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.15, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
          gridRect.attr('transform', `translate(${event.transform.x % 80}, ${event.transform.y % 80}) scale(${event.transform.k})`);
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

      // Gradients & Filters
      ['var(--trust-high)', 'var(--trust-med)', 'var(--trust-low)', 'var(--trust-unverified)'].forEach(color => {
        const safeId = color.replace(/[^a-zA-Z0-9-]/g, '');
        const grad = defs.append('radialGradient').attr('id', `marble-${safeId}`).attr('cx', '30%').attr('cy', '30%').attr('r', '70%');
        grad.append('stop').attr('offset', '0%').attr('stop-color', '#fff').attr('stop-opacity', 0.8);
        grad.append('stop').attr('offset', '20%').attr('stop-color', color).attr('stop-opacity', 0.9);
        grad.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0.2);
      });

      const filter = defs.append('filter').attr('id', 'glitch-filter');
      filter.append('feTurbulence').attr('type', 'fractalNoise').attr('baseFrequency', '0.1 0.05').attr('numOctaves', '2').attr('result', 'noise');
      filter.append('feDisplacementMap').attr('in', 'SourceGraphic').attr('in2', 'noise').attr('scale', '5').attr('xChannelSelector', 'R').attr('yChannelSelector', 'G');

      const shadowFilter = defs.append('filter').attr('id', 'shadow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      shadowFilter.append('feDropShadow').attr('dx', '0').attr('dy', '8').attr('stdDeviation', '12').attr('flood-color', 'rgba(0,0,0,0.6)');

      const blurFilter = defs.append('filter').attr('id', 'glow-blur').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      blurFilter.append('feGaussianBlur').attr('stdDeviation', '16');

      const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id((d: any) => d.id).distance(180).strength(0.6))
        .force('charge', d3.forceManyBody().strength(-800).distanceMax(1000))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collide', d3.forceCollide().radius((d: any) => d.radius + 50).iterations(4))
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
                 return d.source.x + dx / 2; // Midpoint
              })
              .attr('y', (d: any) => {
                 if (d.source.y === undefined || d.target.y === undefined) return 0;
                 const dx = d.target.x - d.source.x;
                 const dy = d.target.y - d.source.y;
                 return d.source.y + dy / 2 - 10; // Slightly above midpoint
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
        .attr('width', 220)
        .attr('height', 150)
        .attr('viewBox', `0 0 ${width} ${height}`);

      graphRefs.current = {
        initialized: true,
        simulation,
        g,
        linkGroup: g.append('g'),
        pulseGroup: g.append('g'),
        nodeGroup: g.append('g'),
        mmg: mmSvg.append('g').attr('class', 'minimap-nodes'),
        mmViewport: mmSvg.append('rect').attr('class', 'minimap-viewport').attr('fill', 'rgba(217, 70, 239, 0.1)').attr('stroke', 'var(--primary-light)').attr('stroke-width', 16).attr('rx', 32),
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
      .attr('stroke', (d: any) => (d as any).origin === 'automatic' ? 'rgba(59, 130, 246, 0.4)' : (d as any).origin === 'manual' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255,255,255,0.06)')
      .attr('stroke-width', (d: any) => (d as any).origin === 'manual' ? 3 : (d as any).origin === 'automatic' ? 2 : 2)
      .attr('stroke-dasharray', (d: any) => (d as any).origin === 'automatic' ? '4,4' : 'none')
      .attr('marker-end', 'url(#arrow-default)');
      
    // Add Labels for Links (Semantic AI vs Manual)
    const linkLabelJoin = linkGroup!.selectAll('text.edge-label')
      .data(validLinks, (d: any) => `label-${(d as any).id}`)
      .join('text')
      .attr('class', 'edge-label')
      .attr('fill', (d: any) => (d as any).origin === 'automatic' ? 'rgba(59, 130, 246, 0.6)' : (d as any).origin === 'manual' ? 'rgba(53, 214, 199, 0.8)' : 'none')
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
        return sourceColor === 'var(--trust-low)' ? 'var(--trust-low)' : 'var(--primary-light)';
      })
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')
      .attr('filter', 'drop-shadow(0 0 6px var(--primary))');

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
            d3.select(event.currentTarget).select('.node-visuals').transition().duration(400).ease(d3.easeElasticOut).attr('transform', 'scale(1.2)');
          })
          .on('mouseleave', (event) => {
            callbacksRef.current.setTooltip(null);
            d3.select(event.currentTarget).select('.node-visuals').transition().duration(400).ease(d3.easeElasticOut).attr('transform', 'scale(1)');
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
              // Nodes stay pinned where dropped to allow manual arrangement
              d3.select(this).classed('graph-dragging', false);
            }) as any
          );

          const visuals = g.append('g')
            .attr('class', 'node-visuals')
            .style('animation', () => `float-organic ${3 + Math.random() * 2}s ease-in-out infinite alternate`)
            .style('animation-delay', () => `-${Math.random() * 3}s`)
            .attr('filter', (d: any) => d.trustScore === 0 ? 'url(#glitch-filter)' : 'none');

          visuals.append('circle').attr('class', 'node-glow');
          visuals.append('g').attr('class', 'rings-container');
          visuals.append('circle').attr('class', 'main-circle').attr('stroke', 'rgba(255,255,255,0.4)').attr('stroke-width', 1.5).attr('filter', 'url(#shadow)');
          
          visuals.append('text').attr('class', 'node-label')
            .attr('y', 5).attr('font-size', '14px').attr('fill', 'var(--text-heading)')
            .attr('font-weight', '700').attr('letter-spacing', '-0.01em')
            .attr('font-family', 'Inter, system-ui, sans-serif').attr('pointer-events', 'none')
            .attr('opacity', 0.95).style('text-shadow', '0 2px 10px rgba(0,0,0,0.8)');

          visuals.append('text').attr('class', 'node-score')
            .attr('x', 0).attr('text-anchor', 'middle').attr('font-size', '12px').attr('fill', 'var(--text-disabled)')
            .attr('font-weight', '800').attr('font-family', 'Sora, system-ui, sans-serif').attr('pointer-events', 'none');

          g.transition().duration(800).ease(d3.easeElasticOut)
            .attr('transform', (d: any) => `translate(${d.x || width/2},${d.y || height/2}) scale(1)`);
            
          return g;
        },
        update => update,
        exit => exit.transition().duration(300).attr('transform', (d: any) => `translate(${d.x},${d.y}) scale(0)`).remove()
      );

    // Update node visual attributes (for both enter and update!)
    nodeJoin.select('.node-visuals').attr('filter', (d: any) => d.trustScore === 0 ? 'url(#glitch-filter)' : 'none');
    
    nodeJoin.select('.node-glow')
      .transition().duration(400)
      .attr('r', (d: any) => d.radius + 20)
      .attr('fill', (d: any) => d.color)
      .attr('opacity', 0.25)
      .attr('filter', 'url(#glow-blur)')
      .attr('pointer-events', 'none');

    nodeJoin.select('.main-circle')
      .transition().duration(400)
      .attr('r', (d: any) => d.radius)
      .attr('fill', (d: any) => `url(#marble-${d.color.replace(/[^a-zA-Z0-9-]/g, '')})`);

    nodeJoin.select('.node-label')
      .text((d: any) => truncateLabel(d.canonicalName))
      .transition().duration(400)
      .attr('x', (d: any) => d.radius + 16);

    nodeJoin.select('.node-score')
      .text((d: any) => `${Math.round(d.trustScore * 100)}%`)
      .transition().duration(400)
      .attr('y', (d: any) => d.radius + 24);

    // Update rings safely
    nodeJoin.select('.rings-container').each(function(d: any) {
      const g = d3.select(this);
      const ringData = Array.from({length: d.rings}, (_, i) => i + 1);
      g.selectAll('circle').data(ringData).join('circle')
        .attr('fill', 'none')
        .attr('stroke', d.color)
        .attr('pointer-events', 'none')
        .attr('stroke-dasharray', i => i > 1 ? '4,6' : 'none')
        .style('animation', i => i > 1 ? 'spin-gradient 12s linear infinite' : 'none')
        .transition().duration(400)
        .attr('r', i => d.radius + i * 8)
        .attr('stroke-width', i => i === d.rings && d.rings >= 3 ? 2 : 1)
        .attr('stroke-opacity', i => d.rings >= 3 ? 0.5 : 0.2);
    });

    mmg!.selectAll('circle')
      .data(d3Nodes, (d: any) => d.id)
      .join('circle')
      .transition().duration(400)
      .attr('r', (d: any) => d.radius * 2.5)
      .attr('fill', (d: any) => d.color);

    // Feed updated data to simulation
    simulation!.nodes(d3Nodes as any);
    (simulation!.force('link') as d3.ForceLink<any, any>).links(validLinks);

    if (topologyChanged) {
      // Reheat slightly to accommodate new nodes/edges
      simulation!.alpha(0.3).restart();
    } else {
      // If we only updated properties (trust score, names), run the tick manually once to update paths without reheating alpha
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
        if (focusNodes.has(d.id)) classes += ' graph-focus';
        else classes += ' graph-dimmed';
      }
      if (searchQuery && !d.canonicalName?.toLowerCase().includes(searchQuery.toLowerCase())) {
         classes += ' graph-dimmed';
      } else if (searchQuery) {
         classes += ' graph-focus';
      }
      return classes;
    });

    linkGroup.selectAll('path').attr('class', function(d: any) {
      let classes = 'edge-path';
      const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
      const targetId = typeof d.target === 'string' ? d.target : d.target.id;
      if (selectedNodeId && !focusLinks.has(`${sourceId}-${targetId}`)) classes += ' graph-dimmed';
      return classes;
    });

    pulseGroup.selectAll('path').attr('class', function(d: any) {
      let classes = 'edge-pulse edge-flow';
      const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
      const targetId = typeof d.target === 'string' ? d.target : d.target.id;
      if (selectedNodeId && !focusLinks.has(`${sourceId}-${targetId}`)) classes += ' graph-dimmed';
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
        <div className="node-tooltip liquid-glass" style={{ left: tooltip.x + 20, top: tooltip.y - 15 }}>
          <div className="heading-style" style={{ fontWeight: 800, fontSize: '15px', marginBottom: 'var(--space-1)', textShadow: 'none' }}>
            {tooltip.node.canonicalName}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-body)', marginBottom: 'var(--space-2)', lineHeight: 1.5 }}>
            {tooltip.node.sourceReferences?.[0]?.contextSnippet?.substring(0, 110) || 'No summary available.'}...
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', fontSize: '12px', color: 'var(--text-disabled)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
            <span style={{ color: getNodeColor(tooltip.node) }}>Trust: {Math.round(tooltip.node.trustScore * 100)}%</span>
            <span>{tooltip.node.sourceReferences?.[0]?.timestamp ? new Date(tooltip.node.sourceReferences[0].timestamp).toLocaleDateString() : ''}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleResetView}
        className="liquid-glass"
        style={{
          position: 'absolute', top: '114px', right: '16px', zIndex: 10,
          padding: '6px 12px', color: 'var(--text-heading)', fontWeight: 600, fontSize: '11px',
          cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px'
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4 12H2"/><path d="M22 12h-2"/></svg>
        Recenter Nodes
      </button>
      {/* Minimap */}
      <div className="liquid-glass p-1 rounded-[var(--radius-md)] z-10" style={{ position: 'absolute', width: '140px', height: '90px', top: '16px', right: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(0,0,0,0.4)' }}>
        <svg ref={minimapRef} style={{ width: '100%', height: '100%', borderRadius: '4px', overflow: 'hidden' }} />
      </div>
    </div>
  );
}
