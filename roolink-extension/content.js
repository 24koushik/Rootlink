// content.js

async function getYouTubeInitialPlayerResponse() {
  try {
    const url = window.location.href;
    const response = await fetch(url);
    const text = await response.text();
    
    const searchString = 'var ytInitialPlayerResponse = {';
    const startIndex = text.indexOf(searchString);
    if (startIndex !== -1) {
      const jsonStart = startIndex + searchString.length - 1; // points to the '{'
      let braceCount = 0;
      let inString = false;
      let escape = false;
      for (let i = jsonStart; i < text.length; i++) {
        const char = text[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\') escape = true;
        else if (char === '"') inString = !inString;
        else if (!inString) {
          if (char === '{') braceCount++;
          else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              const jsonStr = text.substring(jsonStart, i + 1);
              return JSON.parse(jsonStr);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch/parse ytInitialPlayerResponse from HTML:', e);
  }
  return null;
}

async function extractYouTubeData() {
  const url = window.location.href;
  const videoIdMatch = url.match(/(?:v=|v\/|embed\/|youtu\.be\/)([^&?]+)/);
  const videoId = videoIdMatch ? videoIdMatch[1] : null;

  let title = document.title.replace(' - YouTube', '');
  let channelName = document.querySelector('#owner-name a')?.textContent || 'Unknown Channel';
  let durationSeconds = 0;
  
  // Try to find the duration
  const durationMatch = document.querySelector('.ytp-time-duration')?.textContent;
  if (durationMatch) {
    const parts = durationMatch.split(':').map(Number);
    if (parts.length === 3) durationSeconds = parts[0]*3600 + parts[1]*60 + parts[2];
    if (parts.length === 2) durationSeconds = parts[0]*60 + parts[1];
  }

  let transcriptSource = 'unavailable';
  let transcriptSegments = [];

  try {
    console.log("[CAPTURE:EXTRACT] Bridging into MAIN world to read ytInitialPlayerResponse...");
    const data = await getYouTubeInitialPlayerResponse();
    
    if (!data) {
      throw new Error("ytInitialPlayerResponse was null or undefined in the page context.");
    }

    const captionTracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    if (captionTracks.length === 0) {
      console.warn("[CAPTURE:EXTRACT] No caption tracks found for this video.");
    } else {
      // Prefer manual captions, fallback to auto-generated
      let track = captionTracks.find(t => t.kind !== 'asr' && t.languageCode === 'en') || 
                  captionTracks.find(t => t.languageCode === 'en') || 
                  captionTracks[0];
      
      if (track) {
        transcriptSource = track.kind === 'asr' ? 'auto-generated' : 'manual';
        console.log(`[CAPTURE:EXTRACT] Requesting transcript fetch from background for URL: ${track.baseUrl.substring(0, 60)}...`);
        
        const xmlText = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'FETCH_TRANSCRIPT', url: track.baseUrl }, response => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (!response || response.status === 'error') reject(new Error(response?.message || "Failed to fetch transcript"));
            else resolve(response.data);
          });
        });

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const texts = Array.from(xmlDoc.getElementsByTagName('text'));
        
        transcriptSegments = texts.map(node => ({
          text: node.textContent,
          startSeconds: parseFloat(node.getAttribute('start') || '0'),
          durationSeconds: parseFloat(node.getAttribute('dur') || '0')
        })).filter(s => s.text && s.text.trim().length > 0);
        
        console.log(`[CAPTURE:EXTRACT] Successfully extracted ${transcriptSegments.length} transcript segments.`);
      }
    }
  } catch (e) {
    console.error("[CAPTURE:EXTRACT] YouTube transcript extraction failed:", e);
    // DO NOT THROW. We still want to capture the video's title, URL, and channel even if the transcript fails!
    transcriptSegments = [];
  }

  return {
    isYouTube: true,
    url,
    title,
    videoId,
    channelName,
    durationSeconds,
    transcriptSource,
    transcriptSegments,
    rawContent: "", // We use transcripts instead
    formulas: [], 
    workedProblems: []
  };
}

async function extractPageContent() {
  const url = window.location.href;
  
  if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
    const textContainer = document.querySelector('.roolink-text-container');
    if (textContainer) textContainer.innerText = 'Transcribing...';
    return await extractYouTubeData();
  }

  let title = document.title;
  let rawContent = "";

  const article = document.querySelector('article') || document.querySelector('main') || document.querySelector('.post-content');
  if (article) {
    rawContent = article.innerText;
  } else {
    const paragraphs = Array.from(document.querySelectorAll('p')).map(p => p.innerText);
    rawContent = paragraphs.join('\n\n');
  }

  if (!rawContent || rawContent.length < 50) {
    rawContent = document.body?.innerText?.substring(0, 50000) || ""; 
  }

  if (!rawContent.trim()) {
    throw new Error("No readable text content found on this page.");
  }

  if (!title || !title.trim()) {
    title = url;
  }

  // Truncate early to prevent 413 Payload Too Large and prevent catastrophic regex backtracking on massive pages like Wikipedia
  rawContent = rawContent.substring(0, 50000);

  // --- Math & Formula Extraction ---
  const formulas = [];
  
  // 1. KaTeX
  document.querySelectorAll('span.katex').forEach(el => {
    const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
    if (annotation) {
      formulas.push({ type: 'katex', latex: annotation.textContent, surroundingContext: (el.parentElement?.textContent || '').substring(0, 100) });
    }
  });

  // 2. MathJax (script tags)
  document.querySelectorAll('script[type="math/tex"], script[type="math/tex; mode=display"]').forEach(el => {
    formulas.push({ type: 'mathjax', latex: el.textContent, surroundingContext: (el.parentElement?.textContent || '').substring(0, 100) });
  });

  // 3. MathML
  document.querySelectorAll('math').forEach(el => {
    if (!el.closest('span.katex')) { // avoid double counting
      formulas.push({ type: 'mathml', latex: el.outerHTML, surroundingContext: (el.parentElement?.textContent || '').substring(0, 100) });
    }
  });

  // 4. Inline Delimiters
  const regex = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g;
  let match;
  while ((match = regex.exec(rawContent)) !== null) {
    const latex = match[1] || match[2] || match[3];
    if (latex && latex.trim().length > 2) {
      formulas.push({ type: 'inline', latex: latex.trim(), surroundingContext: rawContent.substring(Math.max(0, match.index - 50), match.index + 50) });
    }
  }

  const uniqueFormulas = [];
  const seen = new Set();
  formulas.forEach(f => {
    if (f.latex && !seen.has(f.latex.trim())) {
      seen.add(f.latex.trim());
      uniqueFormulas.push(f);
    }
  });

  // --- Worked Problems Extraction ---
  const workedProblems = [];
  const problemRegex = /(?:Problem|Example)\s*\d*[:\.]([\s\S]{10,500}?)(?:Solution|Answer)[:\.]([\s\S]{10,1000}?)(?=(?:Problem|Example)\s*\d*[:\.]|$)/ig;
  while ((match = problemRegex.exec(rawContent)) !== null) {
    workedProblems.push({
      problemStatement: match[1].trim(),
      givenValues: 'Extracted from statement',
      solutionSteps: [match[2].trim()],
      finalAnswer: 'See solution steps'
    });
  }

  // Cap formulas and worked problems to avoid massive payloads (e.g. thousands of MathML tags on Wikipedia)
  const finalFormulas = uniqueFormulas.slice(0, 15);
  const finalProblems = workedProblems.slice(0, 5);

  return { url, title, rawContent, formulas: finalFormulas, workedProblems: finalProblems };
}

function injectUI() {
  if (document.getElementById('roolink-widget-root')) return;

  const root = document.createElement('div');
  root.id = 'roolink-widget-root';
  Object.assign(root.style, {
    position: 'fixed',
    top: '0px',
    left: '0px',
    zIndex: '2147483647',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    display: 'flex',
    width: '0px',
    height: '0px',
  });

  const networkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <line x1="4" y1="4" x2="9" y2="10" stroke="#0A1931" stroke-width="2.5" />
    <line x1="3" y1="16" x2="9" y2="10" stroke="#0A1931" stroke-width="2.5" />
    <path fill-rule="evenodd" clip-rule="evenodd" d="M 9 2 L 16 2 C 19.8 2 23 5.2 23 9 C 23 11.7 21.4 14.1 19 15.2 L 23 22 L 17.5 22 L 14.5 16 L 9 16 L 9 12 L 16 12 C 17.6 12 19 10.6 19 9 C 19 7.4 17.6 6 16 6 L 13 6 L 13 8 L 9 8 L 9 2 Z" fill="#0A1931" />
    <circle cx="4" cy="4" r="2.5" fill="#4A72FF" />
    <circle cx="9" cy="10" r="2.5" fill="#9D50FF" />
    <circle cx="3" cy="16" r="2.5" fill="#FF5E99" />
  </svg>`;
  const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'roolink-orb roolink-idle';
  Object.assign(toggleBtn.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    transform: 'translate(-50%, -50%)',
  });

  const iconContainer = document.createElement('div');
  iconContainer.className = 'roolink-icon';
  iconContainer.innerHTML = networkIcon;

  const textContainer = document.createElement('div');
  textContainer.className = 'roolink-text';
  textContainer.innerText = 'Capture this page';

  const closeBtn = document.createElement('div');
  closeBtn.className = 'roolink-close';
  closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  toggleBtn.appendChild(iconContainer);
  toggleBtn.appendChild(textContainer);
  toggleBtn.appendChild(closeBtn);
  root.appendChild(toggleBtn);
  document.body.appendChild(root);

  let isExpanded = false;
  let isDragging = false;
  let hasDragged = false;
  let isCapturing = false;
  let autoCollapseTimeout = null;

  let startX = 0, startY = 0;
  let dragStartX = 0, dragStartY = 0;
  let currentX = window.innerWidth - 40;
  let currentY = window.innerHeight - 40;

  const clampPosition = (x, y) => {
    const minX = 24, maxX = window.innerWidth - 24;
    const minY = 24, maxY = window.innerHeight - 24;
    return {
      x: Math.max(minX, Math.min(x, maxX)),
      y: Math.max(minY, Math.min(y, maxY))
    };
  };

  const updateRootPosition = () => {
    root.style.transform = `translate(${currentX}px, ${currentY}px)`;
    
    if (isExpanded) {
      let offsetX = 0;
      const halfWidth = 100; // Increased to 100 to account for the wider 205px width
      if (currentX - halfWidth < 8) offsetX = (halfWidth + 8) - currentX;
      else if (currentX + halfWidth > window.innerWidth - 8) offsetX = (window.innerWidth - 8) - (currentX + halfWidth);
      
      toggleBtn.style.setProperty('--offset-x', `${offsetX}px`);
    } else {
      toggleBtn.style.setProperty('--offset-x', `0px`);
    }
  };

  chrome.storage.local.get(['roolinkOrbX', 'roolinkOrbY'], (result) => {
    if (result.roolinkOrbX !== undefined && result.roolinkOrbY !== undefined) {
      currentX = result.roolinkOrbX * window.innerWidth;
      currentY = result.roolinkOrbY * window.innerHeight;
    }
    const clamped = clampPosition(currentX, currentY);
    currentX = clamped.x; currentY = clamped.y;
    updateRootPosition();
  });

  window.addEventListener('resize', () => {
    const clamped = clampPosition(currentX, currentY);
    currentX = clamped.x; currentY = clamped.y;
    updateRootPosition();
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && !isDragging) {
      if (changes.roolinkOrbX && changes.roolinkOrbY) {
        currentX = changes.roolinkOrbX.newValue * window.innerWidth;
        currentY = changes.roolinkOrbY.newValue * window.innerHeight;
        const clamped = clampPosition(currentX, currentY);
        currentX = clamped.x; currentY = clamped.y;
        updateRootPosition();
      }
    }
  });

  const resetAutoCollapse = () => {
    if (autoCollapseTimeout) clearTimeout(autoCollapseTimeout);
    if (isExpanded && !isCapturing) {
      autoCollapseTimeout = setTimeout(() => {
        if (isExpanded) contractOrb();
      }, 3500);
    }
  };

  const expandOrb = () => {
    isExpanded = true;
    toggleBtn.classList.remove('roolink-idle');
    toggleBtn.classList.add('roolink-expanded');
    textContainer.innerHTML = 'Capture this page';
    updateRootPosition();
    resetAutoCollapse();
  };

  const contractOrb = () => {
    isExpanded = false;
    toggleBtn.classList.remove('roolink-expanded');
    setTimeout(() => {
      if (!isExpanded && !isDragging && !isCapturing) toggleBtn.classList.add('roolink-idle');
    }, 400);
    updateRootPosition();
  };

  const onDragStart = (e) => {
    if (e.button !== 0) return; // Only allow left click. We want it to be draggable even if expanded or capturing.
    isDragging = true;
    hasDragged = false;
    startX = e.clientX - currentX;
    startY = e.clientY - currentY;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    toggleBtn.classList.remove('roolink-idle');
    toggleBtn.classList.add('roolink-dragging');
  };

  const onDragMove = (e) => {
    if (!isDragging) return;
    const targetX = e.clientX - startX;
    const targetY = e.clientY - startY;
    if (Math.abs(e.clientX - dragStartX) > 5 || Math.abs(e.clientY - dragStartY) > 5) hasDragged = true;

    const clamped = clampPosition(targetX, targetY);
    currentX += (clamped.x - currentX) * 0.4;
    currentY += (clamped.y - currentY) * 0.4;
    
    updateRootPosition();
  };

  const onDragEnd = () => {
    if (isDragging) {
      isDragging = false;
      toggleBtn.classList.remove('roolink-dragging');
      if (!isExpanded && !isCapturing) toggleBtn.classList.add('roolink-idle');
      
      try {
        if (chrome.runtime?.id) {
          chrome.storage.local.set({ 
            roolinkOrbX: currentX / window.innerWidth, 
            roolinkOrbY: currentY / window.innerHeight 
          });
        }
      } catch(e) {}
    }
  };

  toggleBtn.addEventListener('mousedown', onDragStart);
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);

  window.addEventListener('mousedown', (e) => {
    if (isExpanded && !toggleBtn.contains(e.target)) {
      contractOrb();
    }
  });

  closeBtn.onmousedown = (e) => {
    e.stopPropagation(); // prevent drag
  };
  
  closeBtn.onclick = (e) => {
    e.stopPropagation(); // prevent triggering the capture
    if (isExpanded) { // removed !isCapturing check so you can close it anytime
      contractOrb();
    }
  };

  toggleBtn.onclick = async (e) => {
    if (hasDragged || isCapturing) return;
    
    if (!isExpanded) {
      expandOrb();
    } else {
      isCapturing = true;
      if (autoCollapseTimeout) clearTimeout(autoCollapseTimeout);
      
      const captureMessages = [
        'CAPTURING',
        'EXTRACTING CONTENT',
        'ANALYZING',
        'BUILDING KNOWLEDGE',
        'GENERATING SUMMARY',
        'BUILDING MIND MAP'
      ];
      let msgIndex = 0;
      textContainer.innerText = captureMessages[0];
      const captureInterval = setInterval(() => {
        if (!isCapturing) {
          clearInterval(captureInterval);
          return;
        }
        msgIndex = Math.min(msgIndex + 1, captureMessages.length - 1);
        textContainer.innerText = captureMessages[msgIndex];
      }, 800);

      // Safety timeout to reset isCapturing if extension background hangs
      const safetyTimeout = setTimeout(() => {
        if (isCapturing) {
          console.warn("[CAPTURE:STATE] Capture timed out, resetting state.");
          textContainer.innerText = 'Timeout error';
          isCapturing = false;
          setTimeout(() => contractOrb(), 2000);
        }
      }, 90000); // 90s timeout

      try {
        console.log("[CAPTURE:EXTRACT] Starting extraction...");
        const payload = await extractPageContent();

        if (!chrome.runtime?.id) throw new Error('Context Invalidated');
        
        console.log("[CAPTURE:NETWORK] Sending payload to background...");
        chrome.runtime.sendMessage({ type: 'CREATE_NODE', payload }, (response) => {
          clearTimeout(safetyTimeout);
          if (chrome.runtime.lastError) {
            console.error("[CAPTURE:NETWORK] Extension error:", chrome.runtime.lastError);
            textContainer.innerText = 'Extension Error';
            isCapturing = false;
            setTimeout(() => contractOrb(), 2500);
            return;
          }
          
          if (!response || response.status === 'error') {
            const errorMsg = response?.message || 'Unknown server error';
            console.error("[CAPTURE:STATE] Server returned error:", errorMsg);
            textContainer.innerText = 'Capture failed. Check console.';
            isCapturing = false;
            setTimeout(() => contractOrb(), 3000);
            return;
          }

          console.log("[CAPTURE:STATE] Capture successful.");
          toggleBtn.classList.add('roolink-success');
          textContainer.innerHTML = `${checkIcon} COMPLETE`;
          
          showSummaryPanel(response.data.source.aiSummary, currentX, currentY);
          
          setTimeout(() => {
            toggleBtn.classList.remove('roolink-success');
            isCapturing = false;
            contractOrb();
          }, 1800);
        });
      } catch (e) {
        clearTimeout(safetyTimeout);
        console.error("[CAPTURE:EXTRACT] Extraction completely failed:", e);
        if (e.message.includes('Context Invalidated')) {
          textContainer.innerText = 'Please refresh page';
        } else {
          textContainer.innerText = `Error: ${e.message.substring(0, 20)}...`;
        }
        isCapturing = false;
        setTimeout(() => contractOrb(), 3500);
      }
    }
  };
}

function showSummaryPanel(summaryText, x, y) {
  let panel = document.getElementById('Roolink-summary-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'Roolink-summary-panel';
    Object.assign(panel.style, {
      position: 'fixed',
      width: '320px',
      padding: '24px',
      background: 'rgba(15, 15, 25, 0.8)',
      backdropFilter: 'blur(32px)',
      WebkitBackdropFilter: 'blur(32px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
      borderRadius: '24px',
      color: '#A6A3C2',
      fontFamily: '"Inter", "Segoe UI", sans-serif',
      fontSize: '14px',
      lineHeight: '1.6',
      zIndex: '2147483647',
      opacity: '0',
      pointerEvents: 'none', // Allow clicking through to the button or page
      transform: 'scale(0.95)',
      transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)'
    });
    document.body.appendChild(panel);
  }
  
  const isLeft = x < window.innerWidth / 2;
  const isTop = y < window.innerHeight / 2;
  
  panel.style.top = isTop ? `${y + 32}px` : 'auto';
  panel.style.bottom = isTop ? 'auto' : `${window.innerHeight - y + 32}px`;
  panel.style.left = isLeft ? `${x - 160}px` : 'auto';
  panel.style.right = isLeft ? 'auto' : `${window.innerWidth - x - 160}px`;
  panel.style.transformOrigin = `${isTop ? 'top' : 'bottom'} center`;

  panel.innerHTML = `
    <div style="font-weight: 700; margin-bottom: 16px; color: #D946EF; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; display: flex; align-items: center; gap: 8px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
      AI Summary Generated
    </div>
    <div style="color: #F1F0F7;">${parseMarkdown(summaryText)}</div>
  `;

  requestAnimationFrame(() => {
    panel.style.opacity = '1';
    panel.style.transform = 'scale(1)';
  });

  setTimeout(() => {
    panel.style.opacity = '0';
    panel.style.transform = 'scale(0.95)';
    setTimeout(() => {
      if (panel.parentNode) panel.parentNode.removeChild(panel);
    }, 400);
  }, 6000);
}

const EXCLUDED_HOSTS = [
  'localhost:3000',
  '127.0.0.1:3000',
  'localhost',
];

function shouldInject() {
  if (document.documentElement.nodeName.toLowerCase() !== 'html') return false;
  
  const currentHost = window.location.host;
  const currentHostname = window.location.hostname;
  
  if (EXCLUDED_HOSTS.includes(currentHost) || EXCLUDED_HOSTS.includes(currentHostname)) {
    return false;
  }
  
  return true;
}

if (shouldInject()) {
  const tryInject = () => {
    if (document.body) {
      injectUI();
    } else {
      setTimeout(tryInject, 100);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInject);
  } else {
    tryInject();
  }
}

function parseMarkdown(text) {
  if (!text) return '';
  
  // Clean up excessive newlines
  let html = text.replace(/\n{3,}/g, '\n\n');

  html = html
    .replace(/^### (.*$)/gim, '<h3 style="font-size: 13px; font-weight: 700; color: #8B5CF6; margin-top: 12px; margin-bottom: 4px;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="font-size: 14px; font-weight: 700; color: #D946EF; margin-top: 14px; margin-bottom: 6px;">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #F1F0F7;">$1</strong>')
    .replace(/(?<!^)(\s)\*(.*?)\*/g, '$1<em>$2</em>') // Match italics only if not start of line
    .replace(/^(?:-|\*)\s+(.*$)/gim, '<li style="margin-left: 20px; margin-bottom: 4px; list-style-type: disc; color: #A6A3C2;">$1</li>')
    .replace(/^\d+\.\s+(.*$)/gim, '<li style="margin-left: 20px; margin-bottom: 4px; list-style-type: decimal; color: #A6A3C2;">$1</li>')
    .replace(/`(.*?)`/g, '<code style="background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 4px;">$1</code>')
    .replace(/\n/g, '<br/>');
    
  html = html.replace(/<\/h3><br\/>/g, '</h3>');
  html = html.replace(/<\/h2><br\/>/g, '</h2>');
  html = html.replace(/<\/li><br\/>/g, '</li>');
  
  // Remove consecutive brs
  html = html.replace(/(<br\/>){3,}/g, '<br/><br/>');
  
  return html;
}
