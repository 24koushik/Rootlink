'use client';
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { MindMapData } from '../lib/mindmap';

interface MindMapVizProps {
  mindMap: MindMapData | null;
}

export default function MindMapViz({ mindMap: data }: MindMapVizProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // D3 persistent refs
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const zoomGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const boundsRef = useRef<{ x0: number, x1: number, y0: number, y1: number } | null>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const lastDataHashRef = useRef<string>('');

  const [zoomLevel, setZoomLevel] = useState(1);

  // 1. Initialize Zoom System ONCE
  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;
    
    if (!zoomBehaviorRef.current) {
      const svg = d3.select(svgRef.current);
      
      let zoomGroup = svg.select<SVGGElement>('g.zoom-group');
      if (zoomGroup.empty()) {
        zoomGroup = svg.append('g').attr('class', 'zoom-group');
      }
      zoomGroupRef.current = zoomGroup;

      const zoom = d3.zoom<SVGGElement, unknown>()
        .scaleExtent([0.15, 3.5])
        .on('zoom', (event) => {
          transformRef.current = event.transform;
          zoomGroup.attr('transform', event.transform.toString());
          setZoomLevel(event.transform.k);
        });

      svg.call(zoom as any);
      zoomBehaviorRef.current = zoom as any;
    }
  }, []);

  // 2. Render Map Data ONLY when genuinely changed
  useEffect(() => {
    if (!data || !data.root || !svgRef.current || !wrapperRef.current || !zoomGroupRef.current || !zoomBehaviorRef.current) return;

    const dataHash = JSON.stringify(data);
    if (lastDataHashRef.current === dataHash) {
      return;
    }
    lastDataHashRef.current = dataHash;

    const zoomGroup = zoomGroupRef.current;
    zoomGroup.selectAll('*').remove();

    const rootData = data.root;
    if (!rootData.children) rootData.children = [];
    const root = d3.hierarchy(rootData, (d: any) => d.children || []);

    const quadrants: any[][] = [[], [], [], []]; 
    if (root.children) {
      const num = root.children.length;
      root.children.forEach((child, i) => {
        if (num === 1) quadrants[0].push(child);
        else if (num === 2) { if (i === 0) quadrants[0].push(child); else quadrants[2].push(child); }
        else if (num === 3) { if (i === 0) quadrants[0].push(child); else if (i === 1) quadrants[2].push(child); else quadrants[1].push(child); }
        else if (num === 4) quadrants[i].push(child);
        else quadrants[i % 4].push(child);
      });
    }

    const nodesMap = new Map();
    nodesMap.set(rootData.id || rootData.title, { data: rootData, x: 0, y: 0, depth: 0 }); 

    const processQuadrant = (children: any[], dir: 'right'|'bottom'|'left'|'top') => {
      if (children.length === 0) return;
      const qRoot = d3.hierarchy({ ...rootData, children: children.map(c => c.data) }, (d: any) => d.children);
      
      if (dir === 'right' || dir === 'left') {
        d3.tree().nodeSize([110, 1])(qRoot as any);
      } else {
        d3.tree().nodeSize([240, 1])(qRoot as any);
      }

      qRoot.each((d: any) => {
        if (d.depth > 0) {
          let finalX = 0;
          let finalY = 0;
          if (dir === 'right') { finalX = d.depth === 1 ? 180 : 180 + (d.depth - 1) * 240; finalY = d.x; }
          else if (dir === 'left') { finalX = d.depth === 1 ? -180 : -180 - (d.depth - 1) * 240; finalY = d.x; }
          else if (dir === 'bottom') { finalX = d.x; finalY = d.depth === 1 ? 160 : 160 + (d.depth - 1) * 160; }
          else if (dir === 'top') { finalX = d.x; finalY = d.depth === 1 ? -160 : -160 - (d.depth - 1) * 160; }
          nodesMap.set(d.data.id || d.data.title, { ...d, x: finalX, y: finalY, dir });
        }
      });
    };

    processQuadrant(quadrants[0], 'right');
    processQuadrant(quadrants[1], 'bottom');
    processQuadrant(quadrants[2], 'left');
    processQuadrant(quadrants[3], 'top');

    const mergedNodes = Array.from(nodesMap.values());
    const mergedLinks: any[] = [];
    
    mergedNodes.forEach(node => {
      if (node.data.children) {
        node.data.children.forEach((childData: any) => {
          const target = nodesMap.get(childData.id || childData.title);
          if (target) mergedLinks.push({ source: node, target: target });
        });
      }
    });

    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    mergedNodes.forEach((d: any) => {
      const cardW = d.depth === 0 ? 260 : 220;
      const cardH = d.depth === 0 ? 100 : 90;
      let left = d.x, right = d.x, top = d.y, bottom = d.y;
      
      if (d.depth === 0) { left = d.x - cardW/2; right = d.x + cardW/2; top = d.y - cardH/2; bottom = d.y + cardH/2; }
      else if (d.dir === 'right') { left = d.x + 10; right = d.x + 10 + cardW; top = d.y - cardH/2; bottom = d.y + cardH/2; }
      else if (d.dir === 'left') { left = d.x - 10 - cardW; right = d.x - 10; top = d.y - cardH/2; bottom = d.y + cardH/2; }
      else if (d.dir === 'bottom') { left = d.x - cardW/2; right = d.x + cardW/2; top = d.y + 10; bottom = d.y + 10 + cardH; }
      else if (d.dir === 'top') { left = d.x - cardW/2; right = d.x + cardW/2; top = d.y - 10 - cardH; bottom = d.y - 10; }
      
      if (left < x0) x0 = left; if (right > x1) x1 = right;
      if (top < y0) y0 = top; if (bottom > y1) y1 = bottom;
    });

    x0 -= 60; x1 += 60; y0 -= 60; y1 += 60;
    boundsRef.current = { x0, x1, y0, y1 };

    doFitToView(0);

    // 4. Render SVG Elements (Curved Green Lines)
    zoomGroup.append('g').selectAll('path').data(mergedLinks).join('path').attr('d', (d: any) => {
      const s = d.source; const t = d.target;
      let sx = s.x, sy = s.y; let tx = t.x, ty = t.y;

      if (s.depth === 0) {
        if (t.dir === 'right') sx += 130; else if (t.dir === 'left') sx -= 130; else if (t.dir === 'bottom') sy += 50; else if (t.dir === 'top') sy -= 50;
      } else {
        if (s.dir === 'right') sx += 230; else if (s.dir === 'left') sx -= 230; else if (s.dir === 'bottom') sy += 90; else if (s.dir === 'top') sy -= 90;
      }
      if (t.dir === 'right' || t.dir === 'left') return `M${sx},${sy} C${(sx + tx)/2},${sy} ${(sx + tx)/2},${ty} ${tx},${ty}`;
      else return `M${sx},${sy} C${sx},${(sy + ty)/2} ${tx},${(sy + ty)/2} ${tx},${ty}`;
    }).attr('fill', 'none').attr('stroke', '#86efac').attr('stroke-width', (d: any) => Math.max(1.5, 3 - d.target.depth)).attr('stroke-linecap', 'round');

    const nodesG = zoomGroup.append('g').selectAll('g').data(mergedNodes).join('g').attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    nodesG.append('foreignObject').attr('x', (d: any) => {
      if (d.depth === 0) return -130;
      if (d.dir === 'right') return 10;
      if (d.dir === 'left') return -230; 
      if (d.dir === 'bottom' || d.dir === 'top') return -110;
      return 0;
    }).attr('y', (d: any) => {
      if (d.depth === 0) return -50;
      if (d.dir === 'right' || d.dir === 'left') return -45;
      if (d.dir === 'bottom') return 10;
      if (d.dir === 'top') return -100;
      return 0;
    }).attr('width', (d: any) => d.depth === 0 ? 260 : 220).attr('height', 180).style('overflow', 'visible').html((d: any) => {
      const item = d.data;
      const titleStr = String(item.title || '');
      const descStr = item.description ? String(item.description) : '';
      if (d.depth === 0) {
        // Deep emerald green root node (Image 4)
        return `<div style="width: 260px; padding: 14px 18px; background: #136c4b; border: 1.5px solid #0e563b; border-radius: 10px; box-shadow: 0 4px 16px rgba(19, 108, 75, 0.25); text-align: center; color: white;">
          <h3 style="margin: 0; font-size: 13px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">${titleStr}</h3>
          ${descStr ? `<p style="margin: 6px 0 0 0; font-size: 11px; opacity: 0.9; line-height: 1.4;">${descStr}</p>` : ''}
        </div>`;
      } else {
        // Soft mint branch card (Image 4)
        return `<div style="width: 220px; padding: 10px 14px; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; box-shadow: 0 2px 8px rgba(0, 40, 20, 0.04); text-align: center; color: #1f2937;">
          <div style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; margin: 0 auto 6px auto;"></div>
          <h4 style="margin: 0 0 4px 0; font-size: 11px; font-weight: 800; color: #14532d; letter-spacing: 0.02em; text-transform: uppercase;">${titleStr}</h4>
          ${descStr ? `<p style="margin: 0; font-size: 10px; color: #374151; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${descStr}</p>` : ''}
        </div>`;
      }
    });

  }, [data]);

  const doFitToView = (duration: number = 750) => {
    if (!wrapperRef.current || !zoomBehaviorRef.current || !boundsRef.current || !svgRef.current) return;
    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;
    if (width === 0 || height === 0) return;
    
    const gW = boundsRef.current.x1 - boundsRef.current.x0;
    const gH = boundsRef.current.y1 - boundsRef.current.y0;
    
    const scale = Math.max(0.15, Math.min(width / gW, height / gH, 1.2) * 0.85);
    const tx = width / 2 - ((boundsRef.current.x0 + boundsRef.current.x1) / 2) * scale;
    const ty = height / 2 - ((boundsRef.current.y0 + boundsRef.current.y1) / 2) * scale;

    const svg = d3.select(svgRef.current);
    if (duration > 0) {
      svg.transition().duration(duration).call(
        zoomBehaviorRef.current.transform as any, 
        d3.zoomIdentity.translate(tx, ty).scale(scale)
      );
    } else {
      svg.call(
        zoomBehaviorRef.current.transform as any, 
        d3.zoomIdentity.translate(tx, ty).scale(scale)
      );
    }
  };

  const handleZoom = (increment: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(
      zoomBehaviorRef.current.scaleBy as any, 
      increment > 0 ? 1.3 : 0.7
    );
  };

  const handleFitToView = (e: React.MouseEvent) => {
    e.stopPropagation();
    doFitToView(750);
  };

  if (!data || !data.root) return <div style={{ color: '#6b7280', fontSize: '13px' }}>Invalid mind map data.</div>;

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#f9fdfa' }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }} />
      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', gap: '6px', background: '#ffffff', padding: '4px', borderRadius: '8px', border: '1px solid #d1d5db', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#f3f4f6', borderRadius: '6px', overflow: 'hidden' }}>
          <button onClick={(e) => { e.stopPropagation(); handleZoom(-1); }} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#111827', cursor: 'pointer', fontSize: 16, opacity: zoomLevel <= 0.15 ? 0.3 : 1 }} disabled={zoomLevel <= 0.15}>
            -
          </button>
          <div style={{ width: '36px', textAlign: 'center', fontSize: '11px', color: '#4b5563', fontFamily: 'monospace', fontWeight: 600 }}>
            {Math.round(zoomLevel * 100)}%
          </div>
          <button onClick={(e) => { e.stopPropagation(); handleZoom(1); }} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#111827', cursor: 'pointer', fontSize: 16, opacity: zoomLevel >= 3.5 ? 0.3 : 1 }} disabled={zoomLevel >= 3.5}>
            +
          </button>
          <div style={{ width: 1, height: 14, background: '#d1d5db', margin: '0 2px' }} />
          <button onClick={handleFitToView} style={{ padding: '0 8px', height: 28, borderRadius: '6px', background: 'transparent', border: 'none', color: '#15803d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
            FIT
          </button>
        </div>
      </div>
    </div>
  );
}
