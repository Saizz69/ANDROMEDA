/**
 * TruthScan Background Service Worker (Manifest V3)
 * Coordinates fact verification requests, Featherless AI LLM calls, caching, settings, tab stats, and context menus.
 */

import { verifyContent, testFeatherlessConnection, RATING_COLORS } from './fact-engine.js';

// Default user configuration: Whitelist is empty by default so user can test on any live site!
const DEFAULT_SETTINGS = {
  autoScan: true,
  scanText: true,
  scanImages: true,
  scanVideos: true,
  sensitivity: 'medium', // 'low' | 'medium' | 'high'
  whitelist: [], // Empty by default: all live sites are scanned
  featherlessApiKey: '',
  featherlessModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
  googleApiKey: '',
  alertOnMisleadingChat: true,
  soundAlerts: true
};

// In-memory tab statistics tracker: tabId -> { scanned: 0, verified: 0, needsContext: 0, misleading: 0, unverified: 0 }
const tabStats = new Map();

// In-memory result cache: hash -> result
const scanCache = new Map();

// Initialize extension settings & context menus on install
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get('truthscan_settings');
  if (!data.truthscan_settings) {
    await chrome.storage.local.set({ truthscan_settings: DEFAULT_SETTINGS });
    console.log('[TruthScan] Initialized default configuration with empty whitelist.');
  } else {
    const existing = data.truthscan_settings;
    // If the whitelist only contained the old hardcoded demo news sites, clean it up so live testing works
    const oldDefaults = ['wikipedia.org', 'reuters.com', 'apnews.com', 'bbc.com', 'nasa.gov', 'nature.com', 'who.int'];
    let cleanWhitelist = existing.whitelist || [];
    if (cleanWhitelist.length === oldDefaults.length && cleanWhitelist.every(d => oldDefaults.includes(d))) {
      cleanWhitelist = [];
    }

    const merged = {
      ...DEFAULT_SETTINGS,
      ...existing,
      whitelist: cleanWhitelist
    };
    await chrome.storage.local.set({ truthscan_settings: merged });
  }

  // Create Context Menu for Highlighted Text Verification
  try {
    chrome.contextMenus.create({
      id: 'truthscan-verify-selection',
      title: 'TruthScan: Fact-check "%s"',
      contexts: ['selection']
    });
  } catch (err) {
    console.warn('[TruthScan] Context menu creation warning:', err);
  }
});

// Handle Context Menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'truthscan-verify-selection' && info.selectionText && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'VERIFY_SELECTION',
      text: info.selectionText
    }).catch(err => console.warn('[TruthScan] Could not send selection to tab:', err));
  }
});

// Simple string hash for fast cache lookup
function hashString(str) {
  let hash = 0;
  if (!str || str.length === 0) return '0';
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return String(hash);
}

/**
 * Message Dispatcher
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : null;

  if (request.action === 'VERIFY_CONTENT') {
    handleVerifyRequest(request.payload, tabId)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'TEST_FEATHERLESS_API') {
    const { apiKey, model } = request;
    testFeatherlessConnection(apiKey, model)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'GET_SETTINGS') {
    chrome.storage.local.get('truthscan_settings', data => {
      sendResponse({ success: true, settings: data.truthscan_settings || DEFAULT_SETTINGS });
    });
    return true;
  }

  if (request.action === 'UPDATE_SETTINGS') {
    chrome.storage.local.set({ truthscan_settings: request.settings }, () => {
      // Notify all tabs of updated settings
      chrome.tabs.query({}, tabs => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { action: 'SETTINGS_CHANGED', settings: request.settings }).catch(() => {});
          }
        }
      });
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'GET_TAB_STATS') {
    const stats = tabStats.get(request.tabId || tabId) || { scanned: 0, verified: 0, needsContext: 0, misleading: 0, unverified: 0 };
    sendResponse({ success: true, stats });
    return true;
  }

  if (request.action === 'UPDATE_TAB_BADGE_COUNT') {
    if (tabId && request.count !== undefined) {
      const text = request.count > 0 ? String(request.count) : '';
      chrome.action.setBadgeText({ tabId, text });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#30A46C' });
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'TOGGLE_WHITELIST_DOMAIN') {
    const domain = request.domain;
    chrome.storage.local.get('truthscan_settings', data => {
      const settings = data.truthscan_settings || { ...DEFAULT_SETTINGS };
      const list = new Set(settings.whitelist || []);
      let isWhitelisted = false;

      if (list.has(domain)) {
        list.delete(domain);
        isWhitelisted = false;
      } else {
        list.add(domain);
        isWhitelisted = true;
      }

      settings.whitelist = Array.from(list);
      chrome.storage.local.set({ truthscan_settings: settings }, () => {
        chrome.tabs.query({}, tabs => {
          for (const tab of tabs) {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, { action: 'SETTINGS_CHANGED', settings }).catch(() => {});
            }
          }
        });
        sendResponse({ success: true, isWhitelisted, whitelist: settings.whitelist });
      });
    });
    return true;
  }
});

/**
 * Handle verification for a single item
 */
async function handleVerifyRequest(payload, tabId) {
  const { type, content, url, title } = payload;
  const rawKey = `${type}:${url || ''}:${content || ''}:${title || ''}`;
  const keyHash = hashString(rawKey);

  // Check cache
  if (scanCache.has(keyHash)) {
    const cached = scanCache.get(keyHash);
    recordTabStat(tabId, cached.status);
    return cached;
  }

  // Load current settings
  const data = await chrome.storage.local.get('truthscan_settings');
  const settings = data.truthscan_settings || DEFAULT_SETTINGS;

  // Run verification engine (Featherless AI -> Google Fact Check -> Database -> Heuristics)
  const result = await verifyContent({ type, content, url, title }, settings);

  // Store in cache
  scanCache.set(keyHash, result);

  // Update tab statistics
  recordTabStat(tabId, result.status);

  return result;
}

/**
 * Track scan stats per tab and update toolbar action badge
 */
function recordTabStat(tabId, status) {
  if (!tabId) return;
  const current = tabStats.get(tabId) || { scanned: 0, verified: 0, needsContext: 0, misleading: 0, unverified: 0 };
  current.scanned++;
  if (status === 'verified') current.verified++;
  else if (status === 'needs_context') current.needsContext++;
  else if (status === 'misleading' || status === 'manipulated') current.misleading++;
  else current.unverified++;

  tabStats.set(tabId, current);

  // Update toolbar badge counter
  chrome.action.setBadgeText({ tabId, text: String(current.scanned) });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#30A46C' });
}

chrome.tabs.onRemoved.addListener(tabId => {
  tabStats.delete(tabId);
});
