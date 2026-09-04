/**
 * TruthScan High-Performance Content Scanner
 * Discovers text posts, embedded images, and videos with zero layout shifts.
 */

import { createBadgeOverlay } from './badge-ui.js';

// Tracks active badge controllers: HTMLElement -> BadgeController
const activeBadges = new Map();

// Intersection observer for viewport-based lazy scanning
let viewportObserver = null;

// Mutation observer for infinite scrolling feeds
let mutationObserver = null;

let currentSettings = {
  autoScan: true,
  scanText: true,
  scanImages: true,
  scanVideos: true,
  sensitivity: 'medium',
  whitelist: []
};

/**
 * Checks whether the current page hostname is whitelisted
 */
export function isPageWhitelisted(whitelist = []) {
  const currentHost = window.location.hostname.toLowerCase();
  return whitelist.some(domain => {
    const cleanDomain = domain.toLowerCase().trim();
    return currentHost === cleanDomain || currentHost.endsWith('.' + cleanDomain);
  });
}

/**
 * Initializes the scanner with settings and observers
 */
export function initScanner(settings, onScanRequest) {
  currentSettings = { ...currentSettings, ...settings };

  // If page domain is whitelisted, skip all scanning
  if (isPageWhitelisted(currentSettings.whitelist)) {
    console.log('[TruthScan] Current domain is whitelisted. Scanning skipped.');
    teardownScanner();
    return;
  }

  // Setup lazy-viewport IntersectionObserver
  if (!viewportObserver) {
    viewportObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const el = entry.target;
          viewportObserver.unobserve(el);
          handleDiscoveredElement(el, onScanRequest);
        }
      }
    }, {
      root: null,
      rootMargin: '150px 0px 150px 0px',
      threshold: 0.1
    });
  }

  // Initial scan of existing DOM elements
  scanDom(document.body);

  // Setup dynamic MutationObserver for infinite scroll & dynamic content
  if (!mutationObserver) {
    let debounceTimer = null;
    mutationObserver = new MutationObserver((mutations) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Ignore TruthScan's own hosts and overlays
              if (node.classList && (node.classList.contains('ts-badge-host') || node.id === 'truthscan-portal-root')) {
                continue;
              }
              scanDom(node);
            }
          }
        }
      }, 120);
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

/**
 * Scans a subtree for potential claims, images, and videos
 */
export function scanDom(rootElement = document.body) {
  if (!rootElement || isPageWhitelisted(currentSettings.whitelist)) return;

  // 1. Text Posts & Articles
  if (currentSettings.scanText) {
    const textSelectors = [
      'article',
      '[role="article"]',
      'blockquote',
      '.tweet',
      '.post-content',
      '.feed-post',
      '.story-card',
      'div[data-testid="tweetText"]',
      'p'
    ];

    const elements = rootElement.querySelectorAll(textSelectors.join(','));
    for (const el of elements) {
      if (shouldProcessTextElement(el)) {
        markAndObserve(el);
      }
    }
  }

  // 2. Embedded Images
  if (currentSettings.scanImages) {
    const images = rootElement.querySelectorAll('img');
    for (const img of images) {
      if (shouldProcessImageElement(img)) {
        markAndObserve(img);
      }
    }
  }

  // 3. Videos & Player Embeds
  if (currentSettings.scanVideos) {
    const videos = rootElement.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]');
    for (const vid of videos) {
      if (shouldProcessVideoElement(vid)) {
        markAndObserve(vid);
      }
    }
  }
}

function markAndObserve(el) {
  if (el.hasAttribute('data-ts-tracked')) return;
  el.setAttribute('data-ts-tracked', 'true');
  if (viewportObserver) {
    viewportObserver.observe(el);
  }
}

/**
 * Filters text elements: ensures meaningful length, avoids duplicates and tiny UI snippets
 */
function shouldProcessTextElement(el) {
  if (el.hasAttribute('data-ts-tracked')) return false;
  if (el.closest('.ts-badge-host') || el.closest('#truthscan-portal-root')) return false;

  // If element is a 'p' inside an article or tweet container that is already or will be tracked, avoid duplicate badges
  if (el.tagName === 'P') {
    const parentContainer = el.closest('article, [role="article"], .tweet, .feed-post, .story-card');
    if (parentContainer && parentContainer !== el) {
      return false;
    }
  }

  const text = (el.innerText || el.textContent || '').trim();
  // Require at least 60 characters and at least 6 words
  if (text.length < 60) return false;
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 6) return false;

  return true;
}

/**
 * Filters images: ignores tiny icons, avatars, tracking pixels
 */
function shouldProcessImageElement(img) {
  if (img.hasAttribute('data-ts-tracked')) return false;
  if (img.closest('.ts-badge-host') || img.closest('#truthscan-portal-root')) return false;

  // Ignore avatars, nav icons, or svgs
  const rect = img.getBoundingClientRect();
  const width = img.naturalWidth || rect.width;
  const height = img.naturalHeight || rect.height;

  // Filter out tiny icons and buttons
  if (width < 140 || height < 120) return false;

  // Filter out pure decorative icons by class
  const classStr = (img.className || '').toLowerCase();
  if (classStr.includes('avatar') || classStr.includes('icon') || classStr.includes('emoji')) {
    return false;
  }

  return true;
}

/**
 * Filters video elements
 */
function shouldProcessVideoElement(vid) {
  if (vid.hasAttribute('data-ts-tracked')) return false;
  if (vid.closest('.ts-badge-host') || vid.closest('#truthscan-portal-root')) return false;

  const rect = vid.getBoundingClientRect();
  if (rect.width > 0 && rect.width < 160) return false;

  return true;
}

/**
 * Handles element entering the visible viewport
 */
function handleDiscoveredElement(el, onScanRequest) {
  // Determine element type
  let type = 'text';
  let content = '';
  let url = '';
  let title = '';

  if (el.tagName === 'IMG') {
    type = 'image';
    url = el.currentSrc || el.src || '';
    content = el.alt || el.getAttribute('title') || '';
    title = el.alt || '';
  } else if (el.tagName === 'VIDEO' || el.tagName === 'IFRAME') {
    type = 'video';
    url = el.src || el.currentSrc || '';
    title = el.getAttribute('title') || '';
    content = title;
  } else {
    type = 'text';
    content = (el.innerText || el.textContent || '').trim();
    // Check if there is a heading
    const heading = el.querySelector('h1, h2, h3, h4');
    if (heading) {
      title = heading.innerText.trim();
    }
  }

  // Create loading badge overlay immediately
  const badgeController = createBadgeOverlay(el);
  activeBadges.set(el, badgeController);

  // If autoScan is disabled, only scan on hover
  if (!currentSettings.autoScan) {
    badgeController.update({
      status: 'unverified',
      headline: 'Hover or click to scan',
      color: '#8E8E93',
      score: null,
      explanation: 'Auto-scan is disabled in settings. Click to evaluate this content.'
    });

    const triggerScan = () => {
      el.removeEventListener('mouseenter', triggerScan);
      badgeController.update(null); // Return to pulsing loading state
      if (typeof onScanRequest === 'function') {
        onScanRequest({ type, content, url, title }, (result) => {
          badgeController.update(result);
        });
      }
    };

    el.addEventListener('mouseenter', triggerScan, { once: true });
    return;
  }

  // Dispatch scan request
  if (typeof onScanRequest === 'function') {
    onScanRequest({ type, content, url, title }, (result) => {
      badgeController.update(result);
    });
  }
}

/**
 * Updates scanner configuration dynamically
 */
export function updateScannerSettings(newSettings, onScanRequest) {
  currentSettings = { ...currentSettings, ...newSettings };

  // If whitelist changed and now includes this domain, teardown
  if (isPageWhitelisted(currentSettings.whitelist)) {
    teardownScanner();
    return;
  }

  // Otherwise rescann
  scanDom(document.body);
}

/**
 * Cleans up badges and observers
 */
export function teardownScanner() {
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
}
