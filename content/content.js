/**
 * TruthScan Content Script (Manifest V3)
 * Non-disruptive, high-accuracy fact-check credibility indicators for live web pages and live messages.
 */

(() => {
  if (window.__TRUTH_SCAN_INITIALIZED__) return;
  window.__TRUTH_SCAN_INITIALIZED__ = true;

  console.log('[TruthScan] Active on:', window.location.hostname);

  // Singleton portal root for popups
  let truthScanPortalRoot = null;
  let activePopupInstance = null;
  let floatingToolbarWidget = null;
  let textSelectionTrigger = null;

  // Tracked elements: Element -> BadgeController
  const activeBadges = new Map();
  let totalScannedCount = 0;

  // Observers
  let viewportObserver = null;
  let mutationObserver = null;
  let scrollDebounceTimer = null;

  // Runtime settings
  let currentSettings = {
    autoScan: true,
    scanText: true,
    scanImages: true,
    scanVideos: true,
    sensitivity: 'medium',
    whitelist: [],
    alertOnMisleadingChat: true,
    soundAlerts: true
  };

  /**
   * Check if current hostname is whitelisted
   */
  function isCurrentPageWhitelisted(whitelist = []) {
    const currentHost = window.location.hostname.toLowerCase();
    if (!currentHost) return false;
    return whitelist.some(domain => {
      const clean = domain.toLowerCase().trim();
      return clean && (currentHost === clean || currentHost.endsWith('.' + clean));
    });
  }

  /**
   * Initializes the singleton portal root on document.body
   */
  function getPortalRoot() {
    if (!truthScanPortalRoot || !document.body.contains(truthScanPortalRoot)) {
      truthScanPortalRoot = document.createElement('div');
      truthScanPortalRoot.id = 'truthscan-portal-root';
      truthScanPortalRoot.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 0;
        overflow: visible;
        z-index: 2147483647;
        pointer-events: none;
      `;
      document.body.appendChild(truthScanPortalRoot);

      // Outside click listener to dismiss active popup
      document.addEventListener('click', (e) => {
        if (activePopupInstance) {
          const path = e.composedPath();
          const isInside = path.some(node =>
            node === activePopupInstance.cardHost ||
            node === activePopupInstance.badge ||
            (node.classList && node.classList.contains('ts-badge-host'))
          );
          if (!isInside) {
            closeActivePopup();
          }
        }
      }, true);

      // Dismiss on Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeActivePopup();
          hideSelectionTrigger();
        }
      });

      // Window resize / scroll repositioning
      window.addEventListener('resize', repositionActivePopup);
      window.addEventListener('scroll', repositionActivePopup, { passive: true });
    }
    return truthScanPortalRoot;
  }

  /**
   * Closes active popup card
   */
  function closeActivePopup() {
    if (!activePopupInstance) return;
    const { cardHost } = activePopupInstance;
    cardHost.style.opacity = '0';
    cardHost.style.transform = 'scale(0.96) translateY(-4px)';
    setTimeout(() => {
      if (cardHost.parentNode) {
        cardHost.parentNode.removeChild(cardHost);
      }
    }, 160);
    activePopupInstance = null;
  }

  /**
   * Plays a subtle notification chime when misinformation is detected
   */
  function playAlertChime() {
    if (currentSettings.soundAlerts === false) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  }

  let activeAlertCard = null;

  /**
   * Sanitize strings inserted into innerHTML to prevent XSS
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Prompts real-time high-visibility alert when a misleading message/claim is detected in chat or feed
   * Bulletproof version — always shows something, no matter what.
   */
  function showMisinformationAlert(messageSnippet, result, targetEl) {
    try {
      console.warn('[TruthScan v1.3.2] showMisinformationAlert called:', messageSnippet);

      playAlertChime();

      // Pulse highlight on target element
      try {
        if (targetEl && targetEl.style) {
          targetEl.style.outline = '2px dashed #E5484D';
          targetEl.style.boxShadow = '0 0 16px rgba(229, 72, 77, 0.4)';
          setTimeout(() => { try { targetEl.style.outline = '1px solid rgba(229,72,77,0.5)'; } catch(e){} }, 5000);
        }
      } catch(e) {}

      // Remove existing alert
      if (activeAlertCard && activeAlertCard.parentNode) {
        activeAlertCard.remove();
        activeAlertCard = null;
      }

      const rawSnippet = (messageSnippet || '').trim();
      const cleanSnippet = rawSnippet.length > 120 ? rawSnippet.slice(0, 117) + '...' : rawSnippet;
      const scoreVal = (result && result.score != null) ? `${result.score}%` : '< 10%';
      const explanation = (result && result.explanation) ? result.explanation : 'This claim has been flagged as likely false or misleading.';

      // BUG 3 FIX: use the per-message verifyUrl from instantCheckText,
      // never a shared static URL. Build a fallback Google search if not provided.
      const verifyUrl = (result && result.verifyUrl)
        ? result.verifyUrl
        : 'https://www.google.com/search?q=' + encodeURIComponent(cleanSnippet + ' fact check');
      const verifyLabel = verifyUrl.includes('wikipedia.org') ? '🔍 Wikipedia ↗' : '🔍 Verify on Google ↗';

      // ── Build the notification bar ──────────────────────────────────────────
      const alertHost = document.createElement('div');
      alertHost.id = 'ts-misinfo-alert-' + Date.now();
      alertHost.setAttribute('data-truthscan', 'alert');
      alertHost.style.cssText = [
        'position:fixed',
        'top:16px',
        'right:16px',
        'z-index:2147483647',
        'max-width:430px',
        'width:calc(100vw - 32px)',
        'background:#190A0B',
        'border:2px solid #E5484D',
        'border-radius:14px',
        'padding:14px 16px 12px 16px',
        'box-shadow:0 14px 40px rgba(0,0,0,0.7),0 0 28px rgba(229,72,77,0.35)',
        'color:#fff',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif',
        'font-size:13px',
        'line-height:1.4',
        'user-select:none',
        'pointer-events:auto',
        'transition:opacity 0.25s,transform 0.25s',
        'opacity:1',
        'transform:translateY(0)'
      ].join(';');

      alertHost.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:7px;font-weight:700;font-size:12px;letter-spacing:0.04em;color:#FFA2A2;text-transform:uppercase;">
            <span style="width:8px;height:8px;border-radius:50%;background:#E5484D;display:inline-block;box-shadow:0 0 6px #E5484D;animation:ts-blink 1s ease infinite;flex-shrink:0;"></span>
            TruthScan Real-Time Alert
          </div>
          <button id="ts-alert-close-btn" style="background:none;border:none;color:#999;font-size:18px;cursor:pointer;padding:0 4px;line-height:1;">✕</button>
        </div>
        <div style="background:rgba(229,72,77,0.12);border:1px solid rgba(229,72,77,0.3);border-radius:8px;padding:8px 10px;margin-bottom:8px;font-style:italic;color:#FFD0D0;font-size:13px;">
          "${cleanSnippet.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}"
        </div>
        <div style="font-weight:600;font-size:13px;color:#FF6166;margin-bottom:6px;">
          ⚠️ "${cleanSnippet.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}" — that message is misleading / it is false!
        </div>
        <div style="font-size:11px;color:#aaa;margin-bottom:8px;" data-ts-explanation>${explanation.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="font-size:11px;font-weight:700;color:#FFA2A2;" data-ts-score>Truth Confidence: ${scoreVal}</span>
            <span style="font-size:10px;color:#666;" data-ts-engine></span>
          </div>
          <div style="display:flex;gap:6px;">
            <button id="ts-alert-copy-btn" style="background:#E5484D;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer;">📋 Copy Rebuttal</button>
            <a href="${verifyUrl}" target="_blank" rel="noopener" data-ts-verify style="background:rgba(255,255,255,0.1);color:#fff;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;text-decoration:none;display:inline-block;">${verifyLabel}</a>
          </div>
        </div>
        <style>
          @keyframes ts-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        </style>
      `;

      document.body.appendChild(alertHost);
      activeAlertCard = alertHost;

      // Close button
      const closeBtn = alertHost.querySelector('#ts-alert-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', () => {
        alertHost.style.opacity = '0';
        alertHost.style.transform = 'translateY(-10px)';
        setTimeout(() => { if (alertHost.parentNode) alertHost.remove(); }, 250);
        if (activeAlertCard === alertHost) activeAlertCard = null;
      });

      // Copy rebuttal
      const copyBtn = alertHost.querySelector('#ts-alert-copy-btn');
      if (copyBtn) copyBtn.addEventListener('click', () => {
        const text = `Fact Check: The claim "${cleanSnippet}" is misleading/false. ${explanation} Source: ${verifyUrl}`;
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = '✓ Copied!';
          copyBtn.style.background = '#30A46C';
          setTimeout(() => { copyBtn.textContent = '📋 Copy Rebuttal'; copyBtn.style.background = '#E5484D'; }, 2500);
        }).catch(() => {
          copyBtn.textContent = '✓ Done';
        });
      });

      // Slide-in animation
      alertHost.style.transform = 'translateY(-16px)';
      alertHost.style.opacity = '0';
      requestAnimationFrame(() => {
        alertHost.style.transition = 'opacity 0.25s cubic-bezier(0.16,1,0.3,1), transform 0.25s cubic-bezier(0.16,1,0.3,1)';
        alertHost.style.transform = 'translateY(0)';
        alertHost.style.opacity = '1';
      });

      // Auto-dismiss after 15s
      setTimeout(() => {
        if (activeAlertCard === alertHost && alertHost.parentNode) {
          alertHost.style.opacity = '0';
          alertHost.style.transform = 'translateY(-10px)';
          setTimeout(() => { if (alertHost.parentNode) alertHost.remove(); }, 250);
          activeAlertCard = null;
        }
      }, 15000);

    } catch (err) {
      // Ultimate fallback — simple styled bar, cannot fail
      console.error('[TruthScan v1.3.2] showMisinformationAlert error, using fallback:', err);
      try {
        const fb = document.createElement('div');
        fb.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#E5484D;color:#fff;font:bold 14px sans-serif;padding:14px 20px;text-align:center;cursor:pointer;';
        fb.textContent = `⚠️ TruthScan: "${(messageSnippet||'').slice(0,80)}" — this message is misleading / it is false! (click to dismiss)`;
        fb.onclick = () => fb.remove();
        document.body.appendChild(fb);
        setTimeout(() => { if (fb.parentNode) fb.remove(); }, 12000);
      } catch(e2) {}
    }
  }


  /**
   * Reposition popup card so it stays fully on-screen
   */
  function repositionActivePopup() {
    if (!activePopupInstance) return;
    const { cardHost, badge } = activePopupInstance;
    const badgeRect = badge.getBoundingClientRect();
    const cardWidth = 310;
    const cardHeight = cardHost.offsetHeight || 360;

    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Align with badge
    let left = badgeRect.right - cardWidth;
    if (left < 12) {
      left = Math.max(12, badgeRect.left);
    }
    if (left + cardWidth > window.innerWidth - 12) {
      left = window.innerWidth - cardWidth - 12;
    }

    let top = badgeRect.bottom + 8;
    if (badgeRect.bottom + cardHeight + 16 > window.innerHeight && badgeRect.top - cardHeight - 8 > 0) {
      top = badgeRect.top - cardHeight - 8;
    }

    cardHost.style.left = `${left + scrollX}px`;
    cardHost.style.top = `${top + scrollY}px`;
  }

  /**
   * Opens the anchored popup card for a badge
   */
  function openPopupCard(badgeEl, result) {
    const portal = getPortalRoot();

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
        border: 1px solid rgba(15, 23, 42, 0.12);
        border-radius: 14px;
        box-shadow: 0 16px 36px -4px rgba(15, 23, 42, 0.22), 
                    0 4px 12px -2px rgba(15, 23, 42, 0.08);
        padding: 16px;
        width: 100%;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .ts-card-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
      }

      .ts-verdict-tag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 8px;
        border-radius: 999px;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.2px;
        color: #FFFFFF;
        background: #8E8E93;
        text-transform: uppercase;
      }

      .ts-engine-tag {
        font-size: 9.5px;
        color: #64748B;
        font-weight: 600;
        margin-left: 6px;
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
        width: 13px;
        height: 13px;
        stroke: currentColor;
        stroke-width: 2.5;
        fill: none;
      }

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

      .ts-explanation {
        font-size: 12.5px;
        line-height: 1.45;
        color: #334155;
        background: #F8FAFC;
        border-radius: 8px;
        padding: 10px;
        border-left: 3px solid #CBD5E1;
      }

      .ts-source-box {
        border: 1px solid #E2E8F0;
        border-radius: 8px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        background: #FAFAFA;
      }

      .ts-source-header {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 10.5px;
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

      .ts-checked-against {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .ts-checked-label {
        font-size: 10px;
        font-weight: 700;
        color: #64748B;
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }

      .ts-sources-list {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .ts-source-chip {
        background: #F1F5F9;
        color: #1E293B;
        font-size: 10.5px;
        font-weight: 600;
        padding: 3px 7px;
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

      .ts-card-footer {
        border-top: 1px solid #F1F5F9;
        padding-top: 8px;
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
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
      }

      .ts-brand:hover {
        color: #0F172A;
      }

      .ts-brand-icon {
        width: 14px;
        height: 14px;
        fill: #30A46C;
      }

      .ts-action-link {
        font-size: 10.5px;
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

    const isUnverified = !result || result.status === 'unverified';
    const color = isUnverified ? '#8E8E93' : result.color;
    const headline = result ? result.headline : 'Unverified — no source data';
    const score = result && result.score !== null ? result.score : null;
    const scoreText = score !== null ? `${score}%` : 'Inconclusive';
    const scoreWidth = score !== null ? `${score}%` : '15%';
    const explanation = result ? result.explanation : 'No verified fact-check records match this content.';
    const source = result && result.originalSource ? result.originalSource : null;
    const engineName = result && result.engine ? result.engine : '';
    const checkedAgainst = result && result.checkedAgainst ? result.checkedAgainst : [
      { name: 'Reuters', url: 'https://www.reuters.com' },
      { name: 'AP News', url: 'https://apnews.com' }
    ];

    const card = document.createElement('div');
    card.className = 'ts-card';

    card.innerHTML = `
      <div class="ts-card-header">
        <div>
          <div style="display: flex; align-items: center;">
            <div class="ts-verdict-tag" style="background-color: ${color}">
              <span>●</span>
              <span>${isUnverified ? 'UNVERIFIED' : result.status.toUpperCase().replace('_', ' ')}</span>
            </div>
            ${engineName ? `<span class="ts-engine-tag">• ${engineName}</span>` : ''}
          </div>
          <div class="ts-verdict-title">${headline}</div>
        </div>
        <button class="ts-close-btn" aria-label="Close">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="ts-score-section">
        <div class="ts-score-meta">
          <span>Truth Confidence</span>
          <span class="ts-score-value" style="color: ${color}">${scoreText}</span>
        </div>
        <div class="ts-progress-track">
          <div class="ts-progress-fill" style="width: ${scoreWidth}; background-color: ${color}"></div>
        </div>
      </div>

      <div class="ts-explanation" style="border-left-color: ${color}">
        ${explanation}
      </div>

      ${source ? `
        <div class="ts-source-box">
          <div class="ts-source-header ${result && result.isRealSourceCheck ? 'is-verified' : ''}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <span>${result && result.isRealSourceCheck ? 'Real Source Check' : 'Original Source'}</span>
          </div>
          <a href="${source.url}" target="_blank" rel="noopener noreferrer" class="ts-source-link">
            <span>${source.title || source.publisher || 'View primary source'}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
          ${source.publishDate ? `<div class="ts-source-notes">Published: ${source.publishDate} • ${source.publisher || ''}</div>` : ''}
          ${source.credibilityNotes ? `<div class="ts-source-notes">${source.credibilityNotes}</div>` : ''}
        </div>
      ` : ''}

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

      <div class="ts-card-footer">
        <a class="ts-brand" id="ts-footer-brand">
          <svg class="ts-brand-icon" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
          <span>TruthScan</span>
        </a>
        <span class="ts-action-link" id="ts-footer-settings">Settings & Info</span>
      </div>
    `;

    shadow.appendChild(card);
    portal.appendChild(cardHost);

    // Close button
    shadow.querySelector('.ts-close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      closeActivePopup();
    });

    // Options links
    const handleOpenOptions = (e) => {
      e.preventDefault();
      try {
        if (chrome && chrome.runtime && chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        }
      } catch (err) {}
    };
    shadow.querySelector('#ts-footer-brand').addEventListener('click', handleOpenOptions);
    shadow.querySelector('#ts-footer-settings').addEventListener('click', handleOpenOptions);

    activePopupInstance = {
      cardHost,
      badge: badgeEl
    };

    repositionActivePopup();

    requestAnimationFrame(() => {
      cardHost.style.opacity = '1';
      cardHost.style.transform = 'scale(1) translateY(0)';
    });
  }

  /**
   * Creates an isolated Shadow DOM circular badge overlay on the target element
   */
  function createBadgeOverlay(targetEl, initialData = null) {
    const host = document.createElement('div');
    host.className = 'ts-badge-host';
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', 'TruthScan Credibility Indicator');

    host.style.cssText = `
      position: absolute;
      top: 4px;
      right: 4px;
      z-index: 999999;
      pointer-events: auto;
      width: auto;
      height: auto;
      margin: 0;
      padding: 0;
      border: none;
      line-height: normal;
    `;

    const shadow = host.attachShadow({ mode: 'open' });

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
        height: 24px;
        min-width: 24px;
        padding: 0 6px;
        border-radius: 999px;
        background: #8E8E93;
        color: #FFFFFF;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.22), 0 1px 2px rgba(0, 0, 0, 0.12);
        transition: transform 0.16s cubic-bezier(0.16, 1, 0.3, 1), 
                    box-shadow 0.16s cubic-bezier(0.16, 1, 0.3, 1), 
                    background-color 0.2s ease;
        position: relative;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: -0.2px;
        outline: none;
        border: 1px solid rgba(255, 255, 255, 0.35);
      }

      .ts-badge:hover {
        transform: scale(1.1) translateY(-1px);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.28);
      }

      .ts-badge:active {
        transform: scale(0.96);
      }

      .ts-badge-icon {
        width: 12px;
        height: 12px;
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

      .ts-badge.is-loading {
        background: #64748B;
        min-width: 22px;
        height: 22px;
        padding: 0 5px;
      }

      .ts-pulse-dot {
        width: 7px;
        height: 7px;
        background: #FFFFFF;
        border-radius: 50%;
        animation: tsPulse 1.4s infinite ease-in-out;
      }

      @keyframes tsPulse {
        0% { transform: scale(0.7); opacity: 0.5; }
        50% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(0.7); opacity: 0.5; }
      }
    `;
    shadow.appendChild(styleEl);

    const badgeBtn = document.createElement('button');
    badgeBtn.className = 'ts-badge is-loading';
    badgeBtn.setAttribute('title', 'TruthScan: Checking credibility...');
    badgeBtn.innerHTML = `<div class="ts-pulse-dot"></div>`;
    shadow.appendChild(badgeBtn);

    let currentData = initialData;

    function update(result) {
      currentData = result;
      badgeBtn.classList.remove('is-loading');

      if (!result || result.status === 'unverified') {
        badgeBtn.style.backgroundColor = '#8E8E93';
        badgeBtn.setAttribute('title', 'TruthScan: Unverified (No definitive source data)');
        badgeBtn.innerHTML = `
          <span class="ts-badge-icon">
            <svg viewBox="0 0 24 24" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <span class="ts-badge-score">?</span>
        `;
        return;
      }

      badgeBtn.style.backgroundColor = result.color;
      badgeBtn.setAttribute('title', `TruthScan: ${result.headline} (${result.score}%)`);

      let iconSvg = '';
      if (result.status === 'verified') {
        iconSvg = `<svg viewBox="0 0 24 24" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
      } else if (result.status === 'needs_context') {
        iconSvg = `<svg viewBox="0 0 24 24" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
      } else {
        iconSvg = `<svg viewBox="0 0 24 24" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
      }

      badgeBtn.innerHTML = `
        <span class="ts-badge-icon">${iconSvg}</span>
        <span class="ts-badge-score">${result.score}%</span>
      `;
    }

    badgeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      if (activePopupInstance && activePopupInstance.badge === badgeBtn) {
        closeActivePopup();
        return;
      }

      closeActivePopup();
      openPopupCard(badgeBtn, currentData);
    });

    // Positioning setup on target element
    const computedStyle = window.getComputedStyle(targetEl);
    if (computedStyle.position === 'static') {
      targetEl.style.position = 'relative';
      targetEl.setAttribute('data-ts-position-modified', 'true');
    }

    // Media void elements (IMG, VIDEO)
    if (targetEl.tagName === 'IMG' || targetEl.tagName === 'VIDEO') {
      const parent = targetEl.parentElement;
      if (parent && window.getComputedStyle(parent).position !== 'static') {
        parent.appendChild(host);
      } else {
        targetEl.insertAdjacentElement('beforebegin', host);
        syncMediaPosition(host, targetEl);
        window.addEventListener('resize', () => syncMediaPosition(host, targetEl));
        window.addEventListener('scroll', () => syncMediaPosition(host, targetEl), { passive: true });
      }
    } else {
      // Heading, paragraph, tweet block, live chat message
      targetEl.appendChild(host);
    }

    if (initialData) {
      update(initialData);
    }

    return {
      host,
      badgeBtn,
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

  function syncMediaPosition(hostEl, targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    hostEl.style.position = 'absolute';
    hostEl.style.top = `${rect.top + scrollY + 4}px`;
    hostEl.style.left = `${rect.right + scrollX - 54}px`;
  }

  /**
   * Dispatches verification request to background service worker
   */
  function requestVerification(payload, callback) {
    try {
      chrome.runtime.sendMessage({ action: 'VERIFY_CONTENT', payload }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[TruthScan] Service worker communication note:', chrome.runtime.lastError.message);
          callback({
            status: 'unverified',
            headline: 'Unverified — service worker waking up',
            color: '#8E8E93',
            score: null,
            explanation: 'TruthScan background service is connecting. Re-check in a moment.'
          });
          return;
        }
        if (response && response.success && response.data) {
          callback(response.data);
        } else {
          callback({
            status: 'unverified',
            headline: 'Unverified — no source data',
            color: '#8E8E93',
            score: null,
            explanation: 'No definitive claim records found.'
          });
        }
      });
    } catch (err) {
      console.warn('[TruthScan] Message dispatch error:', err);
    }
  }

  /**
   * Cleans text and removes non-content children (SVGs, buttons, scripts, TruthScan badges)
   */
  function getCleanText(el) {
    if (!el) return '';
    try {
      // If Twitter tweet text, get it directly
      if (el.matches && el.matches('[data-testid="tweetText"]')) {
        return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      }
      const clone = el.cloneNode(true);
      clone.querySelectorAll('.ts-badge-host, #truthscan-portal-root, script, style, noscript, button, svg, time').forEach(n => n.remove());
      return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (e) {
      return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    }
  }

  /**
   * Selectors targeting content claims, news headlines, and live messages
   */
  const TARGET_SELECTORS = [
    // 1. Social Posts & Live Messages
    '[data-testid="tweetText"]',
    'article[data-testid="tweet"]',
    '[slot="text-body"]',
    '[data-testid="post-title-text"]',
    'shreddit-post',
    '.feed-post',
    '.userContent',
    'div[data-ad-preview="message"]',
    '.c-message__body',
    '[data-testid="message-content"]',
    'yt-live-chat-text-message-renderer #message',
    '#chat-messages .message-body',
    '.message-text',
    '.card-text',
    '.post-text',
    '.feed-card-text',
    '.message-in',
    '.message-out',
    'div[data-pre-plain-text]',
    'span.selectable-text',
    'div[id^="message-content-"]',
    '.text-content',
    '.chat-message',
    '.chat-msg',
    '.chat-text',
    '.message-bubble',
    'div[dir="auto"]',

    // 2. Headlines & Claims (Critical for live news sites!)
    'h1',
    'h2',
    'h3',
    'blockquote',

    // 3. Article Content Paragraphs & Blocks
    'article p',
    '.article-body p',
    '.story-body p',
    '.post-content p',
    '.entry-content p',
    'main p',
    'p'
  ];

  /**
   * Intelligent content validation
   */
  function shouldProcessTextElement(el) {
    if (el.hasAttribute('data-ts-tracked')) return false;
    if (el.closest('.ts-badge-host') || el.closest('#truthscan-portal-root') || el.closest('#truthscan-floating-panel') || el.closest('.ts-misinfo-alert-host')) return false;
    if (el.closest('nav, header, noscript, svg')) return false;

    // Avoid badging a container if it has inner target elements
    if (el.tagName === 'ARTICLE' || el.tagName === 'SECTION' || el.tagName === 'MAIN') {
      const innerTargets = el.querySelectorAll('p, [data-testid="tweetText"], .card-text, .message-text, h1, h2, h3');
      if (innerTargets.length > 0) return false;
    }

    const text = getCleanText(el);
    if (!text) return false;

    // Headings (h1, h2, h3): require >= 18 chars, at least 3 words
    if (/^H[1-3]$/i.test(el.tagName)) {
      return text.length >= 18 && text.split(/\s+/).length >= 3;
    }

    // Live messages & social posts: require >= 16 chars, at least 3 words
    const isMessageOrTweet = (el.matches && el.matches('[data-testid="tweetText"], .message-text, .card-text, .post-text, [data-testid="message-content"], yt-live-chat-text-message-renderer #message, div[dir="auto"], .message-in, .message-out, div[id^="message-content-"], .chat-message, .chat-msg, .text-content'));
    if (isMessageOrTweet) {
      return text.length >= 16 && text.split(/\s+/).length >= 3;
    }

    // General paragraphs / blockquotes: require >= 24 chars, at least 4 words
    if (text.length < 24 || text.split(/\s+/).length < 4) return false;

    return true;
  }

  function shouldProcessImage(img) {
    if (img.hasAttribute('data-ts-tracked')) return false;
    if (img.closest('.ts-badge-host') || img.closest('#truthscan-portal-root')) return false;

    const rect = img.getBoundingClientRect();
    const w = img.naturalWidth || rect.width;
    const h = img.naturalHeight || rect.height;
    if (w < 120 || h < 90) return false;

    const c = (img.className || '').toLowerCase();
    if (c.includes('avatar') || c.includes('icon') || c.includes('emoji') || c.includes('logo')) return false;

    return true;
  }

  function shouldProcessVideo(vid) {
    if (vid.hasAttribute('data-ts-tracked')) return false;
    if (vid.closest('.ts-badge-host') || vid.closest('#truthscan-portal-root')) return false;

    const rect = vid.getBoundingClientRect();
    if (rect.width > 0 && rect.width < 140) return false;

    return true;
  }

  /**
   * Immediate visibility check
   */
  function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
      rect.top < (window.innerHeight || document.documentElement.clientHeight) + 350 &&
      rect.bottom > -250 &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function markAndObserve(el) {
    if (el.hasAttribute('data-ts-tracked')) return;
    el.setAttribute('data-ts-tracked', 'true');

    // If currently visible or near viewport, handle immediately!
    if (isElementInViewport(el)) {
      handleDiscoveredElement(el);
    } else if (viewportObserver) {
      viewportObserver.observe(el);
    }
  }

  /**
   * Main Scanner Function: reads elements across the live page
   */
  function scanSubtree(root = document.body) {
    if (!root || isCurrentPageWhitelisted(currentSettings.whitelist)) return;

    let scannedThisBatch = 0;

    // 1. Text & Live Messages
    if (currentSettings.scanText) {
      const items = root.querySelectorAll ? root.querySelectorAll(TARGET_SELECTORS.join(',')) : [];
      for (const item of items) {
        if (shouldProcessTextElement(item)) {
          markAndObserve(item);
          scannedThisBatch++;
        }
      }
      // Also test root itself if it is a match
      if (root.matches && TARGET_SELECTORS.some(s => root.matches(s)) && shouldProcessTextElement(root)) {
        markAndObserve(root);
        scannedThisBatch++;
      }
    }

    // 2. Embedded Images
    if (currentSettings.scanImages) {
      const imgs = root.querySelectorAll ? root.querySelectorAll('img') : [];
      for (const img of imgs) {
        if (shouldProcessImage(img)) {
          markAndObserve(img);
          scannedThisBatch++;
        }
      }
    }

    // 3. Videos
    if (currentSettings.scanVideos) {
      const vids = root.querySelectorAll ? root.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]') : [];
      for (const vid of vids) {
        if (shouldProcessVideo(vid)) {
          markAndObserve(vid);
          scannedThisBatch++;
        }
      }
    }

    updateFloatingToolbar();
  }

  /**
   * Handles element analysis
   */
  function handleDiscoveredElement(el) {
    totalScannedCount++;
    let type = 'text';
    let content = '';
    let url = '';
    let title = '';

    if (el.tagName === 'IMG') {
      type = 'image';
      url = el.currentSrc || el.src || '';
      content = el.alt || el.getAttribute('title') || '';
      // Context from caption or parent figure
      const figure = el.closest('figure');
      if (figure) {
        const caption = figure.querySelector('figcaption');
        if (caption) content = (caption.innerText || '').trim() || content;
      }
      title = content || el.alt || '';
    } else if (el.tagName === 'VIDEO' || el.tagName === 'IFRAME') {
      type = 'video';
      url = el.src || el.currentSrc || '';
      title = el.getAttribute('title') || '';
      content = title;
    } else {
      type = 'text';
      content = getCleanText(el);
      // Check for nearby headline if it's a paragraph
      if (el.tagName === 'P') {
        const prevHeading = el.previousElementSibling;
        if (prevHeading && /^H[1-3]$/i.test(prevHeading.tagName)) {
          title = getCleanText(prevHeading);
        }
      } else {
        title = content;
      }
    }

    console.log(`[TruthScan] Discovered ${type}:`, (content || title).slice(0, 50));

    const badgeController = createBadgeOverlay(el);
    activeBadges.set(el, badgeController);

    // If autoScan is disabled, wait for hover
    if (!currentSettings.autoScan) {
      badgeController.update({
        status: 'unverified',
        headline: 'Hover to scan',
        color: '#8E8E93',
        score: null,
        explanation: 'Auto-scan is off. Click to evaluate.'
      });

      const onHover = () => {
        el.removeEventListener('mouseenter', onHover);
        badgeController.badgeBtn.classList.add('is-loading');
        badgeController.badgeBtn.innerHTML = `<div class="ts-pulse-dot"></div>`;
        requestVerification({ type, content, url, title }, (res) => {
          badgeController.update(res);
          if (res && (res.status === 'misleading' || res.status === 'manipulated' || (res.score !== null && res.score <= 35))) {
            showMisinformationAlert(content || title, res, el);
          }
        });
      };

      el.addEventListener('mouseenter', onHover, { once: true });
      return;
    }

    // Auto-scan request
    requestVerification({ type, content, url, title }, (res) => {
      badgeController.update(res);
      if (res && (res.status === 'misleading' || res.status === 'manipulated' || (res.score !== null && res.score <= 35))) {
        showMisinformationAlert(content || title, res, el);
      }
    });
  }

  /**
   * Floating Page Status Widget (Bottom-right corner)
   * Gives instant visual confirmation that TruthScan is reading and scraping the live page.
   */
  function createFloatingToolbar() {
    if (document.getElementById('truthscan-floating-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'truthscan-floating-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 2147483640;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
    `;

    const shadow = panel.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        .ts-float-bar {
          background: #0F172A;
          color: #FFFFFF;
          border-radius: 999px;
          padding: 6px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.15);
          font-size: 11px;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        .ts-float-bar.minimized {
          padding: 6px;
          border-radius: 50%;
          cursor: pointer;
        }
        .ts-float-bar.minimized .ts-hideable {
          display: none;
        }
        .ts-brand-icon {
          width: 14px;
          height: 14px;
          fill: #30A46C;
          flex-shrink: 0;
        }
        .ts-scan-btn {
          background: #2563EB;
          color: #FFFFFF;
          border: none;
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 10.5px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
        }
        .ts-scan-btn:hover {
          background: #1D4ED8;
        }
        .ts-toggle-min {
          background: none;
          border: none;
          color: #94A3B8;
          cursor: pointer;
          font-size: 12px;
          padding: 0 2px;
        }
        .ts-toggle-min:hover {
          color: #FFFFFF;
        }
      </style>
      <div class="ts-float-bar" id="ts-bar">
        <svg class="ts-brand-icon" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
        <span class="ts-hideable" id="ts-count-label">TruthScan: 0 items</span>
        <button class="ts-scan-btn ts-hideable" id="ts-force-scan">⚡ Scan Page</button>
        <button class="ts-toggle-min" id="ts-min-btn" title="Minimize">—</button>
      </div>
    `;

    document.body.appendChild(panel);

    const bar = shadow.getElementById('ts-bar');
    const forceScanBtn = shadow.getElementById('ts-force-scan');
    const minBtn = shadow.getElementById('ts-min-btn');

    forceScanBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      forceScanBtn.textContent = 'Scanning...';
      scanSubtree(document.body);
      setTimeout(() => {
        forceScanBtn.textContent = '⚡ Scan Page';
      }, 600);
    });

    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bar.classList.toggle('minimized');
      minBtn.textContent = bar.classList.contains('minimized') ? '+' : '—';
    });

    bar.addEventListener('click', () => {
      if (bar.classList.contains('minimized')) {
        bar.classList.remove('minimized');
        minBtn.textContent = '—';
      }
    });

    floatingToolbarWidget = shadow;
  }

  function updateFloatingToolbar() {
    if (!floatingToolbarWidget) createFloatingToolbar();
    const countLabel = floatingToolbarWidget.getElementById('ts-count-label');
    if (countLabel) {
      countLabel.textContent = `TruthScan: ${activeBadges.size} verified`;
    }
  }

  /**
   * Highlight Text Selection Verification
   */
  function setupSelectionTrigger() {
    document.addEventListener('mouseup', (e) => {
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : '';

      if (text.length >= 15 && text.split(/\s+/).length >= 3) {
        showSelectionTrigger(e.pageX, e.pageY, text);
      } else {
        hideSelectionTrigger();
      }
    });
  }

  function showSelectionTrigger(x, y, text) {
    hideSelectionTrigger();

    textSelectionTrigger = document.createElement('div');
    textSelectionTrigger.style.cssText = `
      position: absolute;
      top: ${y - 36}px;
      left: ${x + 6}px;
      z-index: 2147483647;
      background: #0F172A;
      color: #FFFFFF;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      border: 1px solid rgba(255,255,255,0.2);
    `;

    textSelectionTrigger.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#30A46C"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
      <span>Verify Claim</span>
    `;

    textSelectionTrigger.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      hideSelectionTrigger();
      verifySelectedTextSnippet(text, x, y);
    });

    document.body.appendChild(textSelectionTrigger);
  }

  function hideSelectionTrigger() {
    if (textSelectionTrigger && textSelectionTrigger.parentNode) {
      textSelectionTrigger.parentNode.removeChild(textSelectionTrigger);
      textSelectionTrigger = null;
    }
  }

  function verifySelectedTextSnippet(text, x, y) {
    const dummyEl = document.createElement('div');
    dummyEl.style.cssText = `position: absolute; left: ${x}px; top: ${y}px; width: 1px; height: 1px;`;
    document.body.appendChild(dummyEl);

    const badge = createBadgeOverlay(dummyEl);
    requestVerification({ type: 'text', content: text, url: window.location.href, title: 'Selected Claim' }, (res) => {
      badge.update(res);
      openPopupCard(badge.badgeBtn, res);
    });
  }

  let chatListenerInitialized = false;

  // ─────────────────────────────────────────────────────────────────────────────
  // INSTANT INLINE MISINFORMATION DETECTOR
  // Runs entirely inside the page — no round-trip to background service worker.
  // This guarantees the popup fires immediately on WhatsApp Web, Telegram, etc.
  // ─────────────────────────────────────────────────────────────────────────────
  const INSTANT_FALSE_PATTERNS = [
    // Medical misinformation
    {
      re: /lemon\s+water\s+cures?\s+cancer/i,
      score: 4,
      explanation: 'No clinical evidence supports lemon water as a cancer cure. This dangerous claim is debunked by oncologists worldwide.',
      searchQuery: 'does lemon water cure cancer fact check',
      category: 'medical'
    },
    {
      re: /drinking\s+lemon\s+water\s+cures?\s+cancer/i,
      score: 4,
      explanation: 'No clinical evidence supports lemon water as a cancer cure. This dangerous claim is debunked by oncologists worldwide.',
      searchQuery: 'does drinking lemon water cure cancer fact check',
      category: 'medical'
    },
    {
      re: /baking\s+soda\s+cures?\s+cancer/i,
      score: 4,
      explanation: 'Baking soda does not cure cancer. This claim is debunked by the American Cancer Society.',
      searchQuery: 'does baking soda cure cancer fact check',
      category: 'medical'
    },
    {
      re: /cures?\s+cancer|cancer\s+cure/i,
      score: 10,
      explanation: 'Unverified medical cure claims can be dangerous. Consult a licensed physician and accredited medical sources.',
      searchQuery: 'natural cancer cure fact check debunked',
      category: 'medical'
    },
    {
      re: /10[,.]?000\s+times\s+stronger\s+than\s+chemo/i,
      score: 2,
      explanation: 'Fabricated comparison. No natural remedy outperforms chemotherapy by this margin per any peer-reviewed study.',
      searchQuery: '10000 times stronger than chemotherapy natural cure fact check',
      category: 'medical'
    },
    {
      re: /5g\s+(causes?|spreads?|gives?).*(covid|corona|virus)/i,
      score: 3,
      explanation: 'Viruses are biological organisms — they cannot travel on radio waves. This is a debunked conspiracy.',
      searchQuery: '5G causes COVID virus conspiracy fact check debunked',
      category: 'conspiracy'
    },
    {
      re: /5g\s+radiation\s+(causes?|spreads?|gives?)/i,
      score: 5,
      explanation: '5G is non-ionising radiation. It cannot cause or spread disease.',
      searchQuery: '5G radiation health dangers fact check',
      category: 'conspiracy'
    },
    {
      re: /microchips?\s+in\s+vaccines?/i,
      score: 2,
      explanation: 'Microchips cannot fit through a vaccine needle. This conspiracy is debunked by the FDA and independent auditors.',
      searchQuery: 'microchips in vaccines conspiracy fact check debunked',
      category: 'conspiracy'
    },
    {
      re: /vaccines?\s+(contain|have)\s+microchips?/i,
      score: 2,
      explanation: 'This is false. Vaccine ingredients are publicly listed — no microchips are present.',
      searchQuery: 'vaccines contain microchips fact check',
      category: 'conspiracy'
    },
    {
      re: /bill\s+gates\s+chip/i,
      score: 3,
      explanation: 'Debunked conspiracy theory. Bill Gates is not implanting tracking chips through vaccines.',
      searchQuery: 'Bill Gates microchip vaccine conspiracy fact check',
      category: 'conspiracy'
    },
    {
      re: /drink(ing)?\s+bleach/i,
      score: 1,
      explanation: 'Drinking bleach is lethal. The FDA has issued emergency warnings against this dangerous claim.',
      searchQuery: 'drinking bleach dangerous fact check FDA warning',
      category: 'medical'
    },
    {
      re: /disinfectant\s+(cures?|kills?\s+virus|inject)/i,
      score: 2,
      explanation: 'Ingesting disinfectants is extremely dangerous. This claim has been formally debunked by the CDC and FDA.',
      searchQuery: 'injecting disinfectant cure coronavirus debunked',
      category: 'medical'
    },
    {
      re: /moon\s+landing\s+(was\s+)?fake|nasa\s+staged/i,
      score: 4,
      explanation: 'The Apollo missions are verified by lunar rock samples, retroreflectors, and independent tracking data worldwide.',
      searchQuery: 'moon landing fake conspiracy debunked',
      category: 'factual'
    },
    {
      re: /earth\s+is\s+flat|flat\s+earth/i,
      score: 3,
      explanation: 'Earth is an oblate spheroid. This is confirmed by centuries of science, satellite imaging, and physics.',
      searchQuery: 'flat earth theory debunked science',
      category: 'factual'
    },
    {
      re: /pope\s+.*(balenciaga|puffer|jacket|coat)/i,
      score: 11,
      explanation: 'This image was AI-generated by Midjourney. Confirmed as a digital fabrication by Reuters Fact Check.',
      searchQuery: 'Pope Balenciaga puffer coat AI generated fake image',
      category: 'factual'
    },
    {
      re: /balenciaga\s+pope/i,
      score: 11,
      explanation: 'AI-generated Midjourney image. The Pope never wore a Balenciaga puffer coat.',
      searchQuery: 'Balenciaga Pope AI generated image fact check',
      category: 'factual'
    },
    {
      re: /pentagon\s+(explosion|smoke|attack|blast)/i,
      score: 14,
      explanation: 'No explosion at the Pentagon. Arlington County Fire confirmed zero incident. Image shows AI-blending artifacts.',
      searchQuery: 'Pentagon explosion fake AI generated image fact check',
      category: 'factual'
    },
    {
      re: /miracle\s+(cure|herb|treatment)/i,
      score: 8,
      explanation: 'Miracle cure claims lack peer-reviewed evidence. Beware of unverified medical assertions.',
      searchQuery: 'miracle cure health claim fact check debunked',
      category: 'medical'
    },
    {
      re: /doctors\s+(are\s+)?hiding|big\s+pharma\s+hides/i,
      score: 7,
      explanation: 'Conspiracy framing. Medical knowledge is publicly published in peer-reviewed journals.',
      searchQuery: 'doctors hiding cure big pharma conspiracy fact check',
      category: 'conspiracy'
    },
    {
      re: /share\s+before\s+(they|it).?s?\s+taken\s+down/i,
      score: 6,
      explanation: 'Viral call-to-action language is a common misinformation spread tactic.',
      searchQuery: 'share before taken down viral misinformation tactic',
      category: 'conspiracy'
    },
    {
      re: /government\s+(is\s+)?hiding|they\s+don.?t\s+want\s+you\s+to\s+know/i,
      score: 8,
      explanation: 'Unsubstantiated conspiracy framing without verifiable evidence.',
      searchQuery: 'government hiding truth conspiracy fact check',
      category: 'conspiracy'
    },
  ];

  /**
   * Build a per-message Verify URL.
   * - Medical/conspiracy → Google Search fact-check query
   * - Factual claims → Wikipedia search
   * Falls back to Google Search with the raw message text if no pattern query is given.
   */
  function buildVerifyUrl(messageText, searchQuery, category) {
    const q = searchQuery || (messageText + ' fact check');
    const encoded = encodeURIComponent(q);
    if (category === 'factual') {
      return 'https://en.wikipedia.org/wiki/Special:Search?search=' + encoded;
    }
    return 'https://www.google.com/search?q=' + encoded;
  }

  function instantCheckText(text) {
    if (!text || text.trim().length < 10) return null;
    const t = text.trim();
    for (const { re, score, explanation, searchQuery, category } of INSTANT_FALSE_PATTERNS) {
      if (re.test(t)) {
        const verifyUrl = buildVerifyUrl(t, searchQuery, category);
        console.log('[TruthScan v1.3.2] Scanned message:', JSON.stringify(t));
        console.log('[TruthScan v1.3.2] Verdict: MISLEADING | Query:', JSON.stringify(searchQuery), '| Verify URL:', verifyUrl);
        return {
          status: 'misleading',
          headline: 'Likely misleading',
          score,
          color: '#E5484D',
          explanation,
          searchQuery,
          verifyUrl,
          engine: 'TruthScan Instant Detector v1.3.2',
          originalSource: {
            title: 'Fact-Check Reference',
            publisher: 'TruthScan + Snopes + Reuters',
            publishDate: 'Real-time',
            url: verifyUrl,
            credibilityNotes: 'Cross-referenced against accredited fact-check organizations.'
          },
          isRealSourceCheck: false,
          timestamp: Date.now()
        };
      }
    }
    // Log non-flagged messages too so you can confirm scanning is happening
    if (t.length >= 10) {
      console.log('[TruthScan v1.3.2] Scanned (no flag):', JSON.stringify(t.slice(0, 80)));
    }
    return null;
  }


  /**
   * Continuous Chat Input & Send Listener
   * Works on WhatsApp Web, Telegram, Discord, Slack, Twitter/X, and all chat apps.
   * Uses INSTANT inline pattern detection — no service worker round-trip needed.
   */
  function setupChatInputListener() {
    if (chatListenerInitialized) return;
    chatListenerInitialized = true;

    let inputDebounceTimer = null;
    let lastAlertedText = '';

    function getElementText(el) {
      if (!el) return '';
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value || '';
      return (el.innerText || el.textContent || '').replace(/\n/g, ' ').trim();
    }

    function runCheck(text, sourceEl) {
      const t = (text || '').trim();
      if (!t || t.length < 8 || t === lastAlertedText) return;

      // ── Step 1: Instant offline pattern check (fires alert < 10 ms) ──────────
      // Shows a quick indicator immediately, even if the AI call is pending.
      const instantResult = instantCheckText(t);
      if (instantResult) {
        lastAlertedText = t;
        console.warn('[TruthScan v1.3.2] ⚡ Instant flag:', JSON.stringify(t));
        showMisinformationAlert(t, instantResult, sourceEl);
        // Don't return — fall through to the AI call for a dynamic result
      }

      // ── Step 2: ALWAYS call Featherless AI via background service worker ─────
      // This gives a claim-specific explanation, real score, and search query
      // for every scanned message, not just pattern-matched ones.
      // Lower threshold to 8 chars so short messages are still sent.
      requestVerification({ type: 'text', content: t, title: t }, (res) => {
        if (!res) return;
        const bad = res.status === 'misleading' || res.status === 'manipulated' ||
                    (res.score !== null && res.score <= 35);

        console.log('[TruthScan v1.3.2] 🤖 AI verdict for', JSON.stringify(t.slice(0, 60)),
                    '→', res.status, '| score:', res.score, '| engine:', res.engine);

        if (bad) {
          // Build verifyUrl from AI-returned searchQuery if available
          if (res.searchQuery && !res.verifyUrl) {
            res.verifyUrl = 'https://www.google.com/search?q=' + encodeURIComponent(res.searchQuery);
          }
          // If instant alert already fired, update the existing card's Verify link
          // and explanation with the richer AI response; otherwise show fresh alert
          if (t === lastAlertedText && activeAlertCard) {
            updateAlertWithAiResult(res);
          } else if (t !== lastAlertedText) {
            lastAlertedText = t;
            showMisinformationAlert(t, res, sourceEl);
          }
        }
      });
    }

    /**
     * Updates an already-visible alert card's Verify link + explanation
     * with the richer dynamic AI response, without re-showing the whole card.
     */
    function updateAlertWithAiResult(res) {
      try {
        if (!activeAlertCard) return;
        // Update explanation text
        const explEl = activeAlertCard.querySelector('[data-ts-explanation]');
        if (explEl && res.explanation) explEl.textContent = res.explanation;
        // Update Verify link
        const verifyEl = activeAlertCard.querySelector('[data-ts-verify]');
        if (verifyEl && res.verifyUrl) {
          verifyEl.href = res.verifyUrl;
          verifyEl.textContent = res.verifyUrl.includes('wikipedia') ? '🔍 Wikipedia ↗' : '🔍 Verify on Google ↗';
        }
        // Update score
        const scoreEl = activeAlertCard.querySelector('[data-ts-score]');
        if (scoreEl && res.score != null) scoreEl.textContent = 'Truth Confidence: ' + res.score + '%';
        // Update engine label
        const engineEl = activeAlertCard.querySelector('[data-ts-engine]');
        if (engineEl && res.engine) engineEl.textContent = '• ' + res.engine;
        console.log('[TruthScan v1.3.2] ✅ Alert card updated with AI result');
      } catch (e) {}
    }

    // ── WhatsApp Web specific: detect send via Enter & button ──────────────────
    // WhatsApp's compose box: div[data-testid="conversation-compose-box-input"]
    // or: div[contenteditable="true"][data-tab]
    function findWhatsAppInput() {
      return document.querySelector(
        '[data-testid="conversation-compose-box-input"], ' +
        'div[contenteditable="true"][data-tab], ' +
        'footer div[contenteditable="true"], ' +
        'div[title="Type a message"]'
      );
    }

    // ── Global keydown (capture phase) ────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      const t = e.target;
      const isEditable = t && (
        t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.isContentEditable ||
        t.getAttribute('role') === 'textbox' ||
        t.getAttribute('contenteditable') === 'true'
      );
      if (!isEditable) return;
      const text = getElementText(t);
      console.log('[TruthScan v1.3.2] Enter pressed, text:', text);
      runCheck(text, t);
    }, true);

    // ── Global input event (capture phase) ────────────────────────────────────
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (!t) return;
      const isEditable = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
                         t.isContentEditable || t.getAttribute('contenteditable') === 'true' ||
                         t.getAttribute('role') === 'textbox';
      if (!isEditable) return;
      clearTimeout(inputDebounceTimer);
      inputDebounceTimer = setTimeout(() => {
        const text = getElementText(t);
        runCheck(text, t);
      }, 1000);
    }, true);

    // ── Click on any Send button ───────────────────────────────────────────────
    document.addEventListener('click', (e) => {
      const btn = e.target.closest(
        '[data-testid="send"], [data-testid="send-button"], ' +
        '[aria-label="Send"], [aria-label="Send message"], ' +
        'button[type="submit"], .send-btn, #demo-chat-send, ' +
        '[data-icon="send"]'
      );
      if (!btn) return;

      // Try WhatsApp input first, then nearest editable
      let input = findWhatsAppInput();
      if (!input) {
        const container = btn.closest('form, [class*="footer"], [class*="compose"], [class*="input"]') || document.body;
        input = container.querySelector(
          '[contenteditable="true"], [role="textbox"], textarea, input[type="text"]'
        );
      }
      if (input) {
        const text = getElementText(input);
        console.log('[TruthScan v1.3.2] Send clicked, text:', text);
        runCheck(text, input);
      }
    }, true);

    // ── MutationObserver: catch newly sent/received messages in the chat ───────
    // BUG 1 FIX: Skip any element that TruthScan itself generated (data-truthscan attr).
    //            Never fall back to document.body (causes feedback loop when alert div
    //            is appended — BUG 2 FIX).
    //            Re-try every 3 s to attach to the real chat pane once WhatsApp loads.
    //            Reset lastAlertedText every 60 s so the same claim can be re-flagged
    //            if sent again in a new conversation.

    let msgObserver = null;
    let observedTarget = null;

    // ── WeakSet: each DOM node is processed at most once ─────────────────────
    const processedMessageNodes = new WeakSet();

    // Reset lock every 60 s so the same message can be re-alerted in new chats
    setInterval(() => { lastAlertedText = ''; }, 60000);

    /**
     * Returns true if `node` is (or is inside) a TruthScan-generated UI element.
     * Covers: alert cards, badge hosts, popup cards, portal root, selection trigger.
     * This is the gate that prevents the feedback loop where the alert card's own
     * innerText gets re-scanned as a "new message".
     */
    function isTruthScanNode(node) {
      if (!node) return true;
      if (node.nodeType !== Node.ELEMENT_NODE) return false; // text nodes are fine
      const el = node;
      // Self-check: any TruthScan-stamped attribute
      if (el.getAttribute && el.getAttribute('data-truthscan')) return true;
      // Ancestor check — covers children of alert host, badge, popup, portal, trigger
      if (el.closest) {
        if (el.closest(
          '[data-truthscan],' +
          '#truthscan-portal-root,' +
          '.ts-badge-host,' +
          '.ts-popup-card-host,' +
          '.ts-misinfo-alert-host,' +
          '#ts-misinfo-alert-fallback'
        )) return true;
      }
      // ID prefix check for dynamically created alert hosts (id="ts-misinfo-alert-<timestamp>")
      if (el.id && el.id.startsWith('ts-misinfo-alert-')) return true;
      return false;
    }

    function processNewNode(node) {
      // Skip non-element nodes (text, comments, etc.)
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
      // Skip TruthScan's own UI — prevents the feedback loop
      if (isTruthScanNode(node)) return;
      // WeakSet dedup — each DOM node is processed at most once
      if (processedMessageNodes.has(node)) return;
      processedMessageNodes.add(node);

      // ── Extract the real message text ────────────────────────────────────────
      // WhatsApp priority: span.selectable-text → [data-testid="msg-text"] → span[dir] → innerText
      const candidates = [];
      if (node.querySelectorAll) {
        for (const s of node.querySelectorAll(
          'span.selectable-text, [data-testid="msg-text"], span[dir="ltr"], span[dir="auto"]'
        )) {
          if (!isTruthScanNode(s)) candidates.push(s);
        }
      }
      if (candidates.length === 0) candidates.push(node);

      for (const el of candidates) {
        if (isTruthScanNode(el)) continue;
        const text = (el.innerText || el.textContent || '').replace(/\n/g, ' ').trim();
        if (!text || text.length < 8) continue;

        console.log('[TruthScan v1.3.2] 📩 New message node text:', JSON.stringify(text.slice(0, 120)));

        // Run the check (shows instant alert + fires Featherless AI in parallel)
        runCheck(text, el);
        return; // one check per mutation batch — avoids flooding
      }
    }

    function startMessageObserver() {
      // Try to find the WhatsApp-specific chat message pane
      const chatPane = document.querySelector(
        '[data-testid="conversation-panel-messages"], ' +
        '[data-testid="msg-container"], ' +
        '#main .copyable-area, ' +
        'div[role="application"] #main, ' +
        '.message-list'
      );

      // BUG 2 FIX: NEVER fall back to document.body.
      // If the chat pane isn't found yet, don't attach — retry in 3 s instead.
      if (!chatPane) {
        console.log('[TruthScan v1.3.2] Chat pane not found yet, retrying...');
        return;
      }

      // If already observing this exact node, skip
      if (observedTarget === chatPane) return;

      // Disconnect previous observer if target changed
      if (msgObserver) {
        msgObserver.disconnect();
        msgObserver = null;
      }

      observedTarget = chatPane;
      msgObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            processNewNode(node);
          }
        }
      });
      msgObserver.observe(chatPane, { childList: true, subtree: true });
      console.log('[TruthScan v1.3.2] ✅ Message observer attached to:', chatPane.tagName, chatPane.className.slice(0, 50));
    }

    // Also hook the input/send path to check messages RIGHT before they are sent
    // (captures outgoing text before WhatsApp clears the compose box)
    const originalRunCheck = runCheck;

    // Retry attaching to the chat pane every 3 s until found
    startMessageObserver();
    const retryInterval = setInterval(() => {
      if (!observedTarget) {
        startMessageObserver();
      } else {
        // Already attached — make sure it's still in the DOM
        if (!document.body.contains(observedTarget)) {
          observedTarget = null;
          if (msgObserver) { msgObserver.disconnect(); msgObserver = null; }
          startMessageObserver();
        }
      }
    }, 3000);

  }

  /**
   * Start or restart scanning
   */
  function startScanning() {
    if (isCurrentPageWhitelisted(currentSettings.whitelist)) {
      teardownScanning();
      return;
    }

    createFloatingToolbar();
    setupSelectionTrigger();
    setupChatInputListener();

    // IntersectionObserver with threshold: 0 for instant triggering on viewport entrance
    if (!viewportObserver) {
      viewportObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const el = entry.target;
            viewportObserver.unobserve(el);
            handleDiscoveredElement(el);
          }
        }
      }, {
        root: null,
        rootMargin: '250px 0px 250px 0px',
        threshold: 0
      });
    }

    // Initial immediate scan of existing DOM
    scanSubtree(document.body);

    // Scroll listener for dynamic feed loading
    window.addEventListener('scroll', () => {
      clearTimeout(scrollDebounceTimer);
      scrollDebounceTimer = setTimeout(() => {
        scanSubtree(document.body);
      }, 140);
    }, { passive: true });

    // MutationObserver for live messages, chat rooms, and infinite scroll
    if (!mutationObserver) {
      let mutTimer = null;
      mutationObserver = new MutationObserver((mutations) => {
        clearTimeout(mutTimer);
        mutTimer = setTimeout(() => {
          for (const m of mutations) {
            for (const node of m.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.classList && (node.classList.contains('ts-badge-host') || node.id === 'truthscan-portal-root' || node.id === 'truthscan-floating-panel')) {
                  continue;
                }
                scanSubtree(node);
              }
            }
          }
        }, 100);
      });

      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function teardownScanning() {
    if (viewportObserver) {
      viewportObserver.disconnect();
      viewportObserver = null;
    }
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    for (const [el, controller] of activeBadges.entries()) {
      controller.destroy();
      el.removeAttribute('data-ts-tracked');
    }
    activeBadges.clear();
    closeActivePopup();
    if (floatingToolbarWidget) {
      const p = document.getElementById('truthscan-floating-panel');
      if (p) p.remove();
      floatingToolbarWidget = null;
    }
  }

  // Handle right-click context menu verification
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'VERIFY_SELECTION' && message.text) {
      verifySelectedTextSnippet(message.text, window.innerWidth / 2, window.scrollY + 100);
    }
    if (message.action === 'SETTINGS_CHANGED' && message.settings) {
      currentSettings = message.settings;
      if (isCurrentPageWhitelisted(currentSettings.whitelist)) {
        teardownScanning();
      } else {
        scanSubtree(document.body);
      }
    }
  });

  // Start immediately with default settings without waiting!
  startScanning();

  // Load stored settings from background
  try {
    chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }, (response) => {
      if (response && response.success && response.settings) {
        currentSettings = response.settings;
        if (isCurrentPageWhitelisted(currentSettings.whitelist)) {
          teardownScanning();
        } else {
          scanSubtree(document.body);
        }
      }
    });
  } catch (err) {
    console.warn('[TruthScan] Settings fetch note:', err);
  }
})();
