/**
 * TruthScan Interactive Demo Controller
 * Supports dynamic feed appending, edge-boundary testing, and standalone fallback simulation.
 */

document.addEventListener('DOMContentLoaded', () => {
  const btnAddPost = document.getElementById('btn-add-post');
  const btnAddLiveMsg = document.getElementById('btn-add-live-msg');
  const btnToggleEdge = document.getElementById('btn-toggle-edge');
  const feed = document.getElementById('feed');
  const liveChatMessages = document.getElementById('live-chat-messages');

  // Live incoming message stream sample claims
  const liveChatSamples = [
    { user: '@health_rumors', text: 'SHOCKING: Drinking warm lemon water and baking soda completely cures cancer with zero chemo needed!' },
    { user: '@tech_conspiracy', text: '5G radiation waves are actively spreading coronavirus and biological pathogens across cities.' },
    { user: '@astro_bot', text: 'NASA confirms James Webb Telescope infrared view of galaxy cluster SMACS 0723 is authentic.' },
    { user: '@viral_buzz', text: 'BREAKING: Official photos show Pope Francis looking stylish in a custom white Balenciaga coat!' },
    { user: '@wire_bulletin', text: 'Arlington Fire Dept clearance: Zero explosion or smoke incident took place near Pentagon.' },
    { user: '@dangerous_remedies', text: 'Drinking disinfectant and bleach kills viruses inside the human body instantly according to viral posts.' },
    { user: '@climate_now', text: 'Official European Electricity Review confirms wind and solar set new record generation across EU.' }
  ];

  let liveMsgIndex = 0;

  if (btnAddLiveMsg && liveChatMessages) {
    btnAddLiveMsg.addEventListener('click', () => {
      const sample = liveChatSamples[liveMsgIndex % liveChatSamples.length];
      liveMsgIndex++;

      const msgEl = document.createElement('div');
      msgEl.className = 'message-text';
      msgEl.setAttribute('data-testid', 'message-content');
      msgEl.innerHTML = `<span class="user-tag">${sample.user}:</span> ${sample.text}`;

      liveChatMessages.appendChild(msgEl);
      msgEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      if (!window.__TRUTH_SCAN_INITIALIZED__) {
        const lower = sample.text.toLowerCase();
        if (lower.includes('lemon') || lower.includes('cancer') || lower.includes('5g') || lower.includes('bleach') || lower.includes('disinfectant') || lower.includes('balenciaga') || lower.includes('pope')) {
          setTimeout(() => {
            showStandaloneAlert(sample.text, 'Debunked by verified clinical trials and accredited fact-checking organizations.', 8);
          }, 300);
        }
      }
    });
  }

  // Live Chat Input Box: allows typing any claim to test real-time AI misinformation detection
  const demoChatInput = document.getElementById('demo-chat-input');
  const demoChatSend = document.getElementById('demo-chat-send');

  function sendDemoMessage() {
    if (!demoChatInput || !liveChatMessages) return;
    const text = demoChatInput.value.trim();
    if (!text) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'message-text';
    msgEl.setAttribute('data-testid', 'message-content');
    msgEl.innerHTML = `<span class="user-tag">@you:</span> ${text}`;

    liveChatMessages.appendChild(msgEl);
    demoChatInput.value = '';
    msgEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // In standalone demo mode (when extension not active in tab), simulate the real-time AI alert
    if (!window.__TRUTH_SCAN_INITIALIZED__) {
      const lower = text.toLowerCase();
      if (lower.includes('lemon') || lower.includes('cancer') || lower.includes('5g') || lower.includes('bleach') || lower.includes('disinfectant') || lower.includes('cure')) {
        setTimeout(() => {
          showStandaloneAlert(text, 'No clinical evidence supports this claim. Medical oncologists and regulatory agencies warn against this dangerous assertion.', 6);
        }, 300);
      }
    }
  }

  if (demoChatSend) {
    demoChatSend.addEventListener('click', sendDemoMessage);
  }
  if (demoChatInput) {
    demoChatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        sendDemoMessage();
      }
    });
  }

  // Additional dynamic viral claims to test MutationObserver
  const dynamicStories = [
    {
      author: 'Clean Energy Dispatch',
      handle: '@energy_clean • just now',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      text: 'European Electricity Review Report confirms wind and solar produced a record 74% share of EU electricity during peak spring months, with fossil fuels falling significantly.',
      image: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&auto=format&fit=crop&q=80',
      alt: 'Wind turbines and solar panels renewable energy record generation'
    },
    {
      author: 'Viral Shock Alerts',
      handle: '@shock_wire • just now',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
      text: 'SHOCKING LEAKED FOOTAGE: Secret government files show giant deepfake explosion at the Pentagon with massive black smoke billowing into the sky!',
      image: 'https://images.unsplash.com/photo-1579829366248-204fe8413f31?w=800&auto=format&fit=crop&q=80',
      alt: 'Pentagon explosion black smoke hoax AI fabricated image'
    },
    {
      author: 'Longevity Insights',
      handle: '@longevity_daily • just now',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
      text: 'Drinking 4 cups of coffee everyday extends life expectancy by 10 years and reduces mortality from all causes according to observational research.',
      image: null
    }
  ];

  let dynamicIndex = 0;

  // Add dynamic post on button click
  btnAddPost.addEventListener('click', () => {
    const item = dynamicStories[dynamicIndex % dynamicStories.length];
    dynamicIndex++;

    const card = document.createElement('article');
    card.className = 'feed-card';
    card.innerHTML = `
      <div class="card-author">
        <img class="avatar" src="${item.avatar}" alt="Avatar">
        <div>
          <div class="author-name">${item.author}</div>
          <div class="author-handle">${item.handle}</div>
        </div>
      </div>
      <div class="card-text">
        ${item.text}
      </div>
      ${item.image ? `
        <div class="card-media">
          <img src="${item.image}" alt="${item.alt}">
        </div>
      ` : ''}
      <div class="card-actions">
        <span>💬 5</span>
        <span>🔁 12</span>
        <span>❤️ 88</span>
      </div>
    `;

    // Prepend to top of feed
    feed.insertBefore(card, feed.firstChild);

    // Smooth scroll into view
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Toggle Screen-Edge Card to test auto-flip popup logic
  let isEdgeActive = false;
  btnToggleEdge.addEventListener('click', () => {
    const card = document.getElementById('post-jwst');
    if (!card) return;

    isEdgeActive = !isEdgeActive;
    if (isEdgeActive) {
      card.classList.add('edge-test-active');
      btnToggleEdge.textContent = 'Reset Edge Card';
    } else {
      card.classList.remove('edge-test-active');
      btnToggleEdge.textContent = 'Test Screen-Edge Card';
    }
  });

  // Standalone Simulator Fallback:
  // If extension is not yet loaded into Chrome, initialize visual badges after 400ms
  setTimeout(() => {
    if (!window.__TRUTH_SCAN_INITIALIZED__) {
      console.log('[TruthScan Demo] Extension not installed in this tab. Running Standalone Demo Overlay Mode.');
      runStandaloneDemoMode();
    }
  }, 400);

  function runStandaloneDemoMode() {
    const sampleData = {
      'post-jwst': {
        status: 'verified',
        color: '#30A46C',
        score: 96,
        headline: 'Verified accurate',
        explanation: 'Corroborated by NASA, ESA, and CSA official releases. The infrared observation of galaxy cluster SMACS 0723 is authentic and peer-verified.',
        originalSource: {
          title: 'NASA First Deep Field Release',
          publisher: 'NASA / ESA / STScI',
          publishDate: 'July 11, 2022',
          url: 'https://www.nasa.gov/image-feature/goddard/2022/nasa-s-webb-delivers-deepest-infrared-image-of-universe-yet',
          credibilityNotes: 'Official tier-1 scientific institution clearance.'
        },
        checkedAgainst: [
          { name: 'Reuters', url: 'https://www.reuters.com' },
          { name: 'AP News', url: 'https://apnews.com' },
          { name: 'Nature', url: 'https://www.nature.com' }
        ],
        isRealSourceCheck: true
      },
      'post-pope': {
        status: 'manipulated',
        color: '#E5484D',
        score: 12,
        headline: 'Manipulated media',
        explanation: 'Synthetic image created using Midjourney v5. Digital creator Pablo Xavier acknowledged prompt generation; physical artifacts on hand and cross necklace confirm AI origin.',
        originalSource: {
          title: 'Debunking the Viral Midjourney Pope',
          publisher: 'Reuters Fact Check',
          publishDate: 'March 27, 2023',
          url: 'https://www.reuters.com/article/factcheck-pope-jacket-midjourney-idUSL1N36014D',
          credibilityNotes: 'Admitted generative AI creation.'
        },
        checkedAgainst: [
          { name: 'Reuters', url: 'https://www.reuters.com' },
          { name: 'Snopes', url: 'https://www.snopes.com' }
        ],
        isRealSourceCheck: false
      },
      'post-gas': {
        status: 'needs_context',
        color: '#F5A623',
        score: 64,
        headline: 'Needs context',
        explanation: 'While nominal prices reached records in 2022, when adjusted for historical inflation, the peak in July 2008 remains significantly higher in purchasing power.',
        originalSource: {
          title: 'Inflation-Adjusted Gas Price Comparison',
          publisher: 'U.S. Energy Information Administration',
          publishDate: 'July 2023',
          url: 'https://www.eia.gov/petroleum/gasdiesel/',
          credibilityNotes: 'Government energy statistical repository.'
        },
        checkedAgainst: [
          { name: 'PolitiFact', url: 'https://www.politifact.com' },
          { name: 'FactCheck.org', url: 'https://www.factcheck.org' }
        ],
        isRealSourceCheck: false
      },
      'post-health': {
        status: 'misleading',
        color: '#E5484D',
        score: 6,
        headline: 'Likely misleading',
        explanation: 'No scientific evidence supports the claim that lemon juice or alkaline diets cure cancer or outperform chemotherapy. Medical consensus considers this dangerous misinformation.',
        originalSource: {
          title: 'Lemons Are Not a Miracle Cancer Cure',
          publisher: 'Snopes & American Cancer Society',
          publishDate: 'Updated 2023',
          url: 'https://www.snopes.com/fact-check/lemon-juice-cancer-cure/',
          credibilityNotes: 'Debunked by oncologists and clinical trials.'
        },
        checkedAgainst: [
          { name: 'Snopes', url: 'https://www.snopes.com' },
          { name: 'FactCheck.org', url: 'https://www.factcheck.org' }
        ],
        isRealSourceCheck: false
      },
      'post-who': {
        status: 'verified',
        color: '#30A46C',
        score: 94,
        headline: 'Verified accurate',
        explanation: 'The World Health Organization officially recommended the Oxford R21/Matrix-M malaria vaccine, unlocking millions of doses for endemic areas.',
        originalSource: {
          title: 'WHO Recommends R21 Malaria Vaccine',
          publisher: 'World Health Organization (WHO)',
          publishDate: 'October 2, 2023',
          url: 'https://www.who.int/news/item/02-10-2023-who-recommends-r21-matrix-m-vaccine-for-malaria-prevention-in-updated-advice-on-immunization',
          credibilityNotes: 'Official public health agency clearance.'
        },
        checkedAgainst: [
          { name: 'AP News', url: 'https://apnews.com' },
          { name: 'BBC Verify', url: 'https://www.bbc.com' }
        ],
        isRealSourceCheck: true
      },
      'post-shark': {
        status: 'manipulated',
        color: '#E5484D',
        score: 14,
        headline: 'Manipulated media',
        explanation: 'A recurring digital hoax dating back to Hurricane Irene in 2011. A 2005 photo of a great white shark was pasted into flooded roadway imagery.',
        originalSource: {
          title: 'Shark in Flooded Street Hoax History',
          publisher: 'Snopes',
          publishDate: 'Repeatedly Debunked',
          url: 'https://www.snopes.com/fact-check/shark-swimming-street-hurrican-harvey-floods/',
          credibilityNotes: 'Recurring viral internet fabrication.'
        },
        checkedAgainst: [
          { name: 'Snopes', url: 'https://www.snopes.com' }
        ],
        isRealSourceCheck: false
      },
      'post-unverified': {
        status: 'unverified',
        color: '#8E8E93',
        score: null,
        headline: 'Unverified — no source data',
        explanation: 'No definitive fact-check records or conclusive sources were found for this specific item. Consider manually reviewing local news wires.',
        originalSource: {
          title: 'Manual Verification Recommended',
          publisher: 'Local Municipal Portal',
          publishDate: 'Current',
          url: 'https://www.google.com/search?q=water+reservoir+pipe+repair+fact+check',
          credibilityNotes: 'No automated verdict assigned.'
        },
        checkedAgainst: [
          { name: 'Reuters', url: 'https://www.reuters.com' },
          { name: 'AP News', url: 'https://apnews.com' }
        ],
        isRealSourceCheck: false
      }
    };

    // Attach standalone badges to cards
    for (const [id, data] of Object.entries(sampleData)) {
      const el = document.getElementById(id);
      if (el) {
        attachStandaloneBadge(el, data);
      }
    }
  }

  function attachStandaloneBadge(targetEl, data) {
    if (targetEl.querySelector('.ts-badge-host')) return;

    const host = document.createElement('div');
    host.className = 'ts-badge-host';
    host.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 9999;
      pointer-events: auto;
    `;

    const shadow = host.attachShadow({ mode: 'open' });
    const isUnverified = data.status === 'unverified';
    const scoreText = data.score !== null ? `${data.score}%` : '?';

    let iconSvg = '';
    if (data.status === 'verified') {
      iconSvg = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (data.status === 'needs_context') {
      iconSvg = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else if (isUnverified) {
      iconSvg = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else {
      iconSvg = `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    }

    shadow.innerHTML = `
      <style>
        .ts-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          height: 26px;
          min-width: 26px;
          padding: 0 7px;
          border-radius: 999px;
          background: ${data.color};
          color: #FFFFFF;
          cursor: pointer;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 11px;
          font-weight: 700;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.25);
          transition: transform 0.15s ease;
          outline: none;
        }
        .ts-badge:hover {
          transform: scale(1.08);
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }
      </style>
      <button class="ts-badge" title="TruthScan: ${data.headline}">
        ${iconSvg}
        <span>${scoreText}</span>
      </button>
    `;

    shadow.querySelector('.ts-badge').addEventListener('click', (e) => {
      e.stopPropagation();
      openStandalonePopup(host, data);
    });

    targetEl.appendChild(host);
  }

  let activeStandalonePopup = null;

  function openStandalonePopup(hostEl, data) {
    if (activeStandalonePopup) {
      activeStandalonePopup.remove();
      activeStandalonePopup = null;
    }

    const popup = document.createElement('div');
    popup.style.cssText = `
      position: absolute;
      width: 310px;
      z-index: 99999;
      background: #FFFFFF;
      color: #0F172A;
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 14px 34px -4px rgba(15, 23, 42, 0.25), 0 4px 12px -2px rgba(15, 23, 42, 0.1);
      border: 1px solid rgba(15, 23, 42, 0.12);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      gap: 12px;
      opacity: 0;
      transform: scale(0.96);
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    const scoreWidth = data.score !== null ? `${data.score}%` : '15%';
    const scoreVal = data.score !== null ? `${data.score}%` : 'Inconclusive';

    popup.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span style="background: ${data.color}; color: #FFF; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px; text-transform: uppercase;">
            ● ${data.status.replace('_', ' ')}
          </span>
          <div style="font-size: 14px; font-weight: 700; margin-top: 4px; color: #0F172A;">${data.headline}</div>
        </div>
        <button id="close-pop" style="background: #F1F5F9; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; color: #64748B; font-weight: 700; display: flex; align-items: center; justify-content: center;">✕</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #64748B;">
          <span>Truth Confidence</span>
          <span style="color: ${data.color}; font-weight: 800;">${scoreVal}</span>
        </div>
        <div style="background: #E2E8F0; height: 6px; border-radius: 999px; overflow: hidden;">
          <div style="width: ${scoreWidth}; height: 100%; background: ${data.color};"></div>
        </div>
      </div>

      <div style="background: #F8FAFC; border-left: 3px solid ${data.color}; padding: 8px 10px; font-size: 12px; line-height: 1.4; color: #334155; border-radius: 6px;">
        ${data.explanation}
      </div>

      ${data.originalSource ? `
        <div style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 10px; background: #FAFAFA; font-size: 11px; display: flex; flex-direction: column; gap: 3px;">
          <div style="font-weight: 700; text-transform: uppercase; color: ${data.isRealSourceCheck ? '#30A46C' : '#64748B'}; font-size: 10px;">
            ${data.isRealSourceCheck ? '✓ Real Source Check' : 'Original Source'}
          </div>
          <a href="${data.originalSource.url}" target="_blank" rel="noopener noreferrer" style="color: #2563EB; font-weight: 600; text-decoration: none;">
            ${data.originalSource.title} ↗
          </a>
          <div style="color: #64748B; font-size: 10.5px;">${data.originalSource.publishDate} • ${data.originalSource.publisher}</div>
          <div style="color: #64748B; font-size: 10px; font-style: italic;">${data.originalSource.credibilityNotes}</div>
        </div>
      ` : ''}

      <div style="display: flex; flex-direction: column; gap: 5px;">
        <span style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase;">Checked Against</span>
        <div style="display: flex; flex-wrap: wrap; gap: 5px;">
          ${data.checkedAgainst.map(s => `
            <span style="background: #F1F5F9; border: 1px solid #E2E8F0; font-size: 10.5px; font-weight: 600; padding: 2px 6px; border-radius: 5px; color: #1E293B;">
              ${s.name}
            </span>
          `).join('')}
        </div>
      </div>

      <div style="border-top: 1px solid #F1F5F9; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; color: #64748B;">
        <span style="font-weight: 700; color: #0F172A; display: flex; align-items: center; gap: 4px;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="#30A46C"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
          TruthScan
        </span>
        <span>Test Environment</span>
      </div>
    `;

    document.body.appendChild(popup);

    // Calculate position
    const rect = hostEl.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    let left = rect.right - 310;
    if (left < 12) left = Math.max(12, rect.left);
    if (left + 310 > window.innerWidth - 12) left = window.innerWidth - 322;

    let top = rect.bottom + 8;
    if (rect.bottom + 360 > window.innerHeight && rect.top - 360 > 0) {
      top = rect.top - 360;
    }

    popup.style.left = `${left + scrollX}px`;
    popup.style.top = `${top + scrollY}px`;

    requestAnimationFrame(() => {
      popup.style.opacity = '1';
      popup.style.transform = 'scale(1)';
    });

    popup.querySelector('#close-pop').addEventListener('click', (e) => {
      e.stopPropagation();
      popup.remove();
      activeStandalonePopup = null;
    });

    activeStandalonePopup = popup;
  }

  // Dismiss popup on outside click
  document.addEventListener('click', (e) => {
    if (activeStandalonePopup && !activeStandalonePopup.contains(e.target)) {
      activeStandalonePopup.remove();
      activeStandalonePopup = null;
    }
  });

  function showStandaloneAlert(text, reason, score) {
    if (document.getElementById('ts-standalone-alert')) {
      document.getElementById('ts-standalone-alert').remove();
    }
    const alertEl = document.createElement('div');
    alertEl.id = 'ts-standalone-alert';
    alertEl.style.cssText = `
      position: fixed;
      top: 18px;
      right: 18px;
      z-index: 999999;
      max-width: 440px;
      width: calc(100vw - 36px);
      background: #190A0B;
      border: 2px solid #E5484D;
      border-radius: 14px;
      padding: 14px 16px;
      box-shadow: 0 14px 38px rgba(0, 0, 0, 0.6), 0 0 24px rgba(229, 72, 77, 0.3);
      color: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      gap: 8px;
      animation: tsSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    const clean = text.length > 90 ? text.slice(0, 87) + '...' : text;

    alertEl.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 11px; font-weight: 800; color: #FFA2A2; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
          <span style="width: 8px; height: 8px; background: #E5484D; border-radius: 50%; box-shadow: 0 0 8px #E5484D;"></span>
          TruthScan Real-Time Alert
        </span>
        <button id="close-standalone-alert" style="background: rgba(255,255,255,0.1); border: none; border-radius: 50%; color: #FFF; width: 22px; height: 22px; cursor: pointer;">✕</button>
      </div>
      <div style="background: rgba(229, 72, 77, 0.16); border-left: 3px solid #E5484D; padding: 8px 10px; border-radius: 6px; font-size: 12.5px; font-style: italic; color: #F8FAFC;">
        "${clean}"
      </div>
      <div style="font-size: 13px; font-weight: 800; color: #FF6B6B;">
        ⚠️ "${clean}" — that message is misleading / it is false!
      </div>
      <div style="display: flex; gap: 8px; font-size: 11px; font-weight: 700; color: #FFA2A2; align-items: center;">
        <span>Truth Confidence: ${score}%</span>
        <span>•</span>
        <span>TruthScan Fact Engine</span>
      </div>
      <div style="font-size: 12px; color: #CBD5E1; line-height: 1.4;">
        ${reason}
      </div>
      <div style="display: flex; gap: 8px; margin-top: 4px;">
        <button id="copy-standalone-rebuttal" style="background: #E5484D; color: #FFF; border: none; border-radius: 6px; padding: 6px 12px; font-size: 11.5px; font-weight: 700; cursor: pointer;">
          📋 Copy Fact-Check Rebuttal
        </button>
        <a href="https://snopes.com" target="_blank" rel="noopener noreferrer" style="background: rgba(255,255,255,0.12); color: #FFF; border-radius: 6px; padding: 6px 12px; font-size: 11.5px; font-weight: 700; text-decoration: none;">
          🔍 View Snopes ↗
        </a>
      </div>
    `;

    document.body.appendChild(alertEl);

    alertEl.querySelector('#close-standalone-alert').addEventListener('click', () => alertEl.remove());
    alertEl.querySelector('#copy-standalone-rebuttal').addEventListener('click', () => {
      navigator.clipboard.writeText(`Fact Check: The claim "${clean}" was reviewed and rated as false/misleading.`);
      alertEl.querySelector('#copy-standalone-rebuttal').textContent = '✓ Copied to Clipboard!';
      setTimeout(() => alertEl.remove(), 1500);
    });

    setTimeout(() => {
      if (document.getElementById('ts-standalone-alert') === alertEl) {
        alertEl.remove();
      }
    }, 10000);
  }
});
