/**
 * TruthScan Isolated Badge & Popup Card Overlay (Shadow DOM)
 * Renders lightweight, non-disruptive circular badges and anchored popup cards.
 */

// Singleton portal root for popups to escape overflow:hidden containers
let truthScanPortalRoot = null;
let activePopupInstance = null;

/**
 * Initializes the top-level portal container attached to document.body
 */
export function getPortalRoot() {
  if (!truthScanPortalRoot || !document.body.contains(truthScanPortalRoot)) {
    truthScanPortalRoot = document.createElement('div');
    truthScanPortalRoot.id = 'truthscan-portal-root';
    truthScanPortalRoot.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 0;
      z-index: 2147483647;
      pointer-events: none;
    `;
    document.body.appendChild(truthScanPortalRoot);

    // Global click listener to close popup when clicking outside
    document.addEventListener('click', (e) => {
      if (activePopupInstance) {
        const path = e.composedPath();
        const clickedInside = path.some(node => 
          node === activePopupInstance.card || 
          node === activePopupInstance.badge ||
          (node.classList && node.classList.contains('ts-badge-host'))
        );
        if (!clickedInside) {
          closeActivePopup();
        }
      }
    }, true);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activePopupInstance) {
        closeActivePopup();
      }
    });

    // Close on window resize or reposition on scroll
    window.addEventListener('resize', () => {
      if (activePopupInstance) {
        repositionActivePopup();
      }
    });

    window.addEventListener('scroll', () => {
      if (activePopupInstance) {
        repositionActivePopup();
      }
    }, { passive: true });
  }
  return truthScanPortalRoot;
}

/**
 * Closes currently open popup card with smooth exit animation
 */
export function closeActivePopup() {
  if (!activePopupInstance) return;
  const { card } = activePopupInstance;
  card.style.opacity = '0';
  card.style.transform = 'scale(0.96) translateY(-4px)';
  setTimeout(() => {
    if (card.parentNode) {
      card.parentNode.removeChild(card);
    }
  }, 160);
  activePopupInstance = null;
}

/**
 * Recalculates position for the active popup
 */
function repositionActivePopup() {
  if (!activePopupInstance) return;
  const { card, badge } = activePopupInstance;
  const badgeRect = badge.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const cardWidth = 310;
  const cardHeight = cardRect.height || 360;

  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;

  // Horizontal position: align to right of badge, clamp to screen bounds
  let left = badgeRect.right - cardWidth;
  if (left < 12) {
    left = Math.max(12, badgeRect.left);
  }
  if (left + cardWidth > window.innerWidth - 12) {
    left = window.innerWidth - cardWidth - 12;
  }

  // Vertical position: prefer below, flip above if close to bottom
  let top = badgeRect.bottom + 8;
  let flipped = false;
  if (badgeRect.bottom + cardHeight + 16 > window.innerHeight && badgeRect.top - cardHeight - 8 > 0) {
    top = badgeRect.top - cardHeight - 8;
    flipped = true;
  }

  card.style.left = `${left + scrollX}px`;
  card.style.top = `${top + scrollY}px`;
  card.setAttribute('data-flipped', flipped ? 'true' : 'false');
}

/**
 * Creates and attaches an isolated circular badge to target element
 * @param {HTMLElement} targetEl - element to badge
 * @param {Object} initialData - initial state or null for loading
 * @returns {Object} badge controller
 */
export function createBadgeOverlay(targetEl, initialData = null) {
  // Container host element for Shadow DOM
  const host = document.createElement('div');
  host.className = 'ts-badge-host';
  host.setAttribute('role', 'region');
  host.setAttribute('aria-label', 'TruthScan Credibility Indicator');
  
  // Ensure host styles do not interfere
  host.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 9999;
    pointer-events: auto;
    width: auto;
    height: auto;
    margin: 0;
    padding: 0;
    border: none;
    line-height: normal;
  `;

  // Attach Shadow DOM for complete CSS style encapsulation
  const shadow = host.attachShadow({ mode: 'open' });

  // Add styles inside Shadow DOM
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    :host {
      all: initial;
      display: inline-block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      user-select: none;
    }

    .ts-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      height: 26px;
      min-width: 26px;
      padding: 0 7px;
      border-radius: 999px;
      background: #8E8E93;
      color: #FFFFFF;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16), 0 1px 2px rgba(0, 0, 0, 0.08);
      transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), 
                  box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1), 
                  background-color 0.25s ease;
      position: relative;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: -0.2px;
      outline: none;
      border: 1px solid rgba(255, 255, 255, 0.25);
    }

    .ts-badge:hover {
      transform: scale(1.08) translateY(-1px);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.22), 0 2px 4px rgba(0, 0, 0, 0.12);
    }

    .ts-badge:active {
      transform: scale(0.96);
    }

    .ts-badge-icon {
      width: 13px;
      height: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .ts-badge-icon svg {
      width: 100%;
      height: 100%;
      stroke: currentColor;
      fill: none;
    }

    .ts-badge-score {
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }

    /* Pulsing loading state */
    .ts-badge.is-loading {
      background: #64748B;
      min-width: 24px;
      height: 24px;
      padding: 0 6px;
    }

    .ts-pulse-dot {
      width: 8px;
      height: 8px;
      background: #FFFFFF;
      border-radius: 50%;
      animation: tsPulse 1.4s infinite ease-in-out;
    }

    @keyframes tsPulse {
      0% {
        transform: scale(0.7);
        opacity: 0.5;
      }
      50% {
        transform: scale(1.15);
        opacity: 1;
      }
      100% {
        transform: scale(0.7);
        opacity: 0.5;
      }
    }
  `;
  shadow.appendChild(styleEl);

  const badgeBtn = document.createElement('button');
  badgeBtn.className = 'ts-badge is-loading';
  badgeBtn.setAttribute('title', 'TruthScan: Analyzing credibility...');
  badgeBtn.innerHTML = `<div class="ts-pulse-dot"></div>`;
  shadow.appendChild(badgeBtn);

  let currentResult = initialData;

  // Update badge UI when result is ready
  function update(result) {
    currentResult = result;
    badgeBtn.classList.remove('is-loading');

    if (!result || result.status === 'unverified') {
      badgeBtn.style.backgroundColor = '#8E8E93';
      badgeBtn.setAttribute('title', 'TruthScan: Unverified (No definitive source)');
      badgeBtn.innerHTML = `
        <span class="ts-badge-icon">
          <svg viewBox="0 0 24 24" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </span>
        <span class="ts-badge-score">?</span>
      `;
      return;
    }

    // Set traffic light color
    badgeBtn.style.backgroundColor = result.color;
    badgeBtn.setAttribute('title', `TruthScan: ${result.headline} (${result.score}%)`);

    let iconSvg = '';
    if (result.status === 'verified') {
      iconSvg = `<svg viewBox="0 0 24 24" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (result.status === 'needs_context') {
      iconSvg = `<svg viewBox="0 0 24 24" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else {
      // misleading or manipulated
      iconSvg = `<svg viewBox="0 0 24 24" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    }

    badgeBtn.innerHTML = `
      <span class="ts-badge-icon">${iconSvg}</span>
      <span class="ts-badge-score">${result.score}%</span>
    `;
  }

  // Click handler to open anchored popup card
  badgeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (activePopupInstance && activePopupInstance.badge === badgeBtn) {
      closeActivePopup();
      return;
    }

    closeActivePopup();
    openPopupCard(badgeBtn, currentResult);
  });

  // Attach to target
  // Ensure target element can host absolute children without displacing page layout
  const computedStyle = window.getComputedStyle(targetEl);
  if (computedStyle.position === 'static') {
    targetEl.style.position = 'relative';
    targetEl.setAttribute('data-ts-position-modified', 'true');
  }

  // For <img> or <video>, wrap or append to parent if necessary
  if (targetEl.tagName === 'IMG' || targetEl.tagName === 'VIDEO') {
    // If parent is already a wrapper, position inside parent
    const parent = targetEl.parentElement;
    if (parent && window.getComputedStyle(parent).position !== 'static') {
      parent.appendChild(host);
    } else {
      targetEl.insertAdjacentElement('beforebegin', host);
      // Synchronize position to image coordinates
      syncAbsolutePosition(host, targetEl);
      window.addEventListener('resize', () => syncAbsolutePosition(host, targetEl));
      window.addEventListener('scroll', () => syncAbsolutePosition(host, targetEl), { passive: true });
    }
  } else {
    targetEl.appendChild(host);
  }

  if (initialData) {
    update(initialData);
  }

  return {
    host,
    update,
    destroy() {
      if (host.parentNode) host.parentNode.removeChild(host);
      if (targetEl.getAttribute('data-ts-position-modified') === 'true') {
        targetEl.style.position = '';
        targetEl.removeAttribute('data-ts-position-modified');
      }
    }
  };
}

/**
 * Pinned coordinate synchronization for void media elements (IMG, VIDEO)
 */
function syncAbsolutePosition(hostEl, targetEl) {
  const rect = targetEl.getBoundingClientRect();
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;

  hostEl.style.position = 'absolute';
  hostEl.style.top = `${rect.top + scrollY + 8}px`;
  hostEl.style.left = `${rect.right + scrollX - 60}px`;
}

/**
 * Opens anchored popup card for the given badge and result data
 */
function openPopupCard(badgeEl, result) {
  const portal = getPortalRoot();

  // Create isolated container for popup card
  const cardHost = document.createElement('div');
  cardHost.className = 'ts-popup-card-host';
  cardHost.style.cssText = `
    position: absolute;
    z-index: 2147483647;
    pointer-events: auto;
    width: 310px;
    opacity: 0;
    transform: scale(0.96) translateY(4px);
    transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), 
                transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  const shadow = cardHost.attachShadow({ mode: 'open' });

  // Build card styles
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      box-sizing: border-box;
      color: #0F172A;
      display: block;
    }
    *, *::before, *::after {
      box-sizing: inherit;
    }

    .ts-card {
      background: #FFFFFF;
      border: 1px solid rgba(15, 23, 42, 0.1);
      border-radius: 14px;
      box-shadow: 0 14px 34px -4px rgba(15, 23, 42, 0.18), 
                  0 4px 12px -2px rgba(15, 23, 42, 0.08);
      padding: 16px;
      width: 100%;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* Header */
    .ts-card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }

    .ts-verdict-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: -0.1px;
      color: #FFFFFF;
      background: #8E8E93;
    }

    .ts-verdict-title {
      font-size: 14px;
      font-weight: 700;
      color: #0F172A;
      margin-top: 4px;
      line-height: 1.25;
    }

    .ts-close-btn {
      background: #F1F5F9;
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #64748B;
      padding: 0;
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
    }

    .ts-close-btn:hover {
      background: #E2E8F0;
      color: #0F172A;
    }

    .ts-close-btn svg {
      width: 14px;
      height: 14px;
      stroke: currentColor;
      stroke-width: 2.5;
    }

    /* Score Bar */
    .ts-score-section {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .ts-score-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      font-weight: 600;
      color: #64748B;
    }

    .ts-score-value {
      font-weight: 800;
      font-size: 13px;
      color: #0F172A;
    }

    .ts-progress-track {
      width: 100%;
      height: 6px;
      background: #E2E8F0;
      border-radius: 999px;
      overflow: hidden;
      position: relative;
    }

    .ts-progress-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.4s ease-out;
    }

    /* Explanation */
    .ts-explanation {
      font-size: 12.5px;
      line-height: 1.45;
      color: #334155;
      background: #F8FAFC;
      border-radius: 8px;
      padding: 10px;
      border-left: 3px solid #CBD5E1;
    }

    /* Source Section */
    .ts-source-box {
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .ts-source-header {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748B;
    }

    .ts-source-header.is-verified {
      color: #30A46C;
    }

    .ts-source-link {
      color: #2563EB;
      text-decoration: none;
      font-size: 12px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      word-break: break-word;
    }

    .ts-source-link:hover {
      text-decoration: underline;
    }

    .ts-source-notes {
      font-size: 11px;
      color: #64748B;
      line-height: 1.35;
    }

    /* Checked Against */
    .ts-checked-against {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .ts-checked-label {
      font-size: 10.5px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .ts-sources-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .ts-source-chip {
      background: #F1F5F9;
      color: #1E293B;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid #E2E8F0;
      transition: background 0.15s;
    }

    .ts-source-chip:hover {
      background: #E2E8F0;
    }

    /* Footer */
    .ts-card-footer {
      border-top: 1px solid #F1F5F9;
      padding-top: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .ts-brand {
      display: flex;
      align-items: center;
      gap: 5px;
      text-decoration: none;
      color: #475569;
      font-size: 11.5px;
      font-weight: 700;
    }

    .ts-brand:hover {
      color: #0F172A;
    }

    .ts-brand-icon {
      width: 15px;
      height: 15px;
      fill: #30A46C;
    }

    .ts-action-link {
      font-size: 11px;
      color: #64748B;
      text-decoration: none;
      cursor: pointer;
    }

    .ts-action-link:hover {
      color: #2563EB;
      text-decoration: underline;
    }
  `;
  shadow.appendChild(style);

  // Data mapping
  const isUnverified = !result || result.status === 'unverified';
  const color = isUnverified ? '#8E8E93' : result.color;
  const headline = result ? result.headline : 'Unverified — no source data';
  const score = result && result.score !== null ? result.score : null;
  const scoreText = score !== null ? `${score}%` : 'Inconclusive';
  const scoreWidth = score !== null ? `${score}%` : '15%';
  const explanation = result ? result.explanation : 'No verified fact-check records match this content.';
  const source = result && result.originalSource ? result.originalSource : null;
  const checkedAgainst = result && result.checkedAgainst ? result.checkedAgainst : [
    { name: 'Reuters', url: 'https://www.reuters.com' },
    { name: 'AP News', url: 'https://apnews.com' }
  ];

  const card = document.createElement('div');
  card.className = 'ts-card';

  card.innerHTML = `
    <!-- Header -->
    <div class="ts-card-header">
      <div>
        <div class="ts-verdict-tag" style="background-color: ${color}">
          <span>●</span>
          <span>${isUnverified ? 'UNVERIFIED' : result.status.toUpperCase().replace('_', ' ')}</span>
        </div>
        <div class="ts-verdict-title">${headline}</div>
      </div>
      <button class="ts-close-btn" aria-label="Close">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <!-- Score Bar -->
    <div class="ts-score-section">
      <div class="ts-score-meta">
        <span>Truth Confidence</span>
        <span class="ts-score-value" style="color: ${color}">${scoreText}</span>
      </div>
      <div class="ts-progress-track">
        <div class="ts-progress-fill" style="width: ${scoreWidth}; background-color: ${color}"></div>
      </div>
    </div>

    <!-- Plain language rationale -->
    <div class="ts-explanation" style="border-left-color: ${color}">
      ${explanation}
    </div>

    <!-- Original Source / Real Source Check -->
    ${source ? `
      <div class="ts-source-box">
        <div class="ts-source-header ${result && result.isRealSourceCheck ? 'is-verified' : ''}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <span>${result && result.isRealSourceCheck ? 'Real Source Check' : 'Original Source'}</span>
        </div>
        <a href="${source.url}" target="_blank" rel="noopener noreferrer" class="ts-source-link">
          <span>${source.title || source.publisher || 'View primary document'}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
        ${source.publishDate ? `<div class="ts-source-notes">Published: ${source.publishDate} • ${source.publisher || ''}</div>` : ''}
        ${source.credibilityNotes ? `<div class="ts-source-notes">${source.credibilityNotes}</div>` : ''}
      </div>
    ` : ''}

    <!-- Checked Against -->
    <div class="ts-checked-against">
      <div class="ts-checked-label">Checked Against</div>
      <div class="ts-sources-list">
        ${checkedAgainst.map(item => `
          <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="ts-source-chip">
            <span>${item.name}</span>
          </a>
        `).join('')}
      </div>
    </div>

    <!-- Footer -->
    <div class="ts-card-footer">
      <a href="#" class="ts-brand" id="ts-learn-more">
        <svg class="ts-brand-icon" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
        <span>TruthScan</span>
      </a>
      <span class="ts-action-link" id="ts-open-settings">Settings</span>
    </div>
  `;

  shadow.appendChild(card);
  portal.appendChild(cardHost);

  // Close button listener
  shadow.querySelector('.ts-close-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    closeActivePopup();
  });

  // Learn more / Settings links
  shadow.querySelector('#ts-learn-more').addEventListener('click', (e) => {
    e.preventDefault();
    if (chrome && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });

  shadow.querySelector('#ts-open-settings').addEventListener('click', (e) => {
    e.preventDefault();
    if (chrome && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });

  activePopupInstance = {
    card: cardHost,
    badge: badgeEl
  };

  // Position and animate entrance
  repositionActivePopup();

  requestAnimationFrame(() => {
    cardHost.style.opacity = '1';
    cardHost.style.transform = 'scale(1) translateY(0)';
  });
}
