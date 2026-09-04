/**
 * TruthScan Toolbar Settings Popup Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const currentDomainEl = document.getElementById('current-domain');
  const toggleWhitelistBtn = document.getElementById('toggle-site-whitelist');
  const statusPill = document.getElementById('status-pill');

  // Stats elements
  const statScanned = document.getElementById('stat-scanned');
  const statVerified = document.getElementById('stat-verified');
  const statContext = document.getElementById('stat-context');
  const statFlagged = document.getElementById('stat-flagged');

  // Controls
  const toggleAutoScan = document.getElementById('toggle-auto-scan');
  const toggleScanText = document.getElementById('toggle-scan-text');
  const toggleScanImages = document.getElementById('toggle-scan-images');
  const toggleScanVideos = document.getElementById('toggle-scan-videos');
  const sensitivitySlider = document.getElementById('sensitivity-slider');
  const sensitivityDisplay = document.getElementById('sensitivity-display');
  const openOptionsBtn = document.getElementById('open-options');

  const sensitivityMap = {
    '1': { label: 'Low', value: 'low' },
    '2': { label: 'Medium', value: 'medium' },
    '3': { label: 'High', value: 'high' }
  };
  const sensitivityReverseMap = { 'low': '1', 'medium': '2', 'high': '3' };

  let currentTab = null;
  let currentDomain = '';
  let activeSettings = null;

  // 1. Get active tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      currentTab = tabs[0];
      if (currentTab.url) {
        try {
          const parsed = new URL(currentTab.url);
          currentDomain = parsed.hostname;
          currentDomainEl.textContent = currentDomain || 'Local / File Page';
        } catch (e) {
          currentDomainEl.textContent = 'Special Page';
        }
      }
    }
  } catch (err) {
    console.error('Error finding tab:', err);
  }

  // 2. Fetch stored settings
  chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }, (res) => {
    if (res && res.success && res.settings) {
      activeSettings = res.settings;
      applySettingsToUI(activeSettings);
    }
  });

  // 3. Fetch tab stats
  if (currentTab && currentTab.id) {
    chrome.runtime.sendMessage({ action: 'GET_TAB_STATS', tabId: currentTab.id }, (res) => {
      if (res && res.success && res.stats) {
        statScanned.textContent = res.stats.scanned || 0;
        statVerified.textContent = res.stats.verified || 0;
        statContext.textContent = res.stats.needsContext || 0;
        statFlagged.textContent = res.stats.misleading || 0;
      }
    });
  }

  const activeEngineVal = document.getElementById('active-engine-val');

  function applySettingsToUI(settings) {
    toggleAutoScan.checked = settings.autoScan !== false;
    toggleScanText.checked = settings.scanText !== false;
    toggleScanImages.checked = settings.scanImages !== false;
    toggleScanVideos.checked = settings.scanVideos !== false;

    const sensVal = sensitivityReverseMap[settings.sensitivity || 'medium'] || '2';
    sensitivitySlider.value = sensVal;
    sensitivityDisplay.textContent = sensitivityMap[sensVal].label;

    const hasApiKey = settings.featherlessApiKey && settings.featherlessApiKey.trim().length > 0;

    // ── Show / hide the Featherless setup banner ──────────────────────────────
    const banner = document.getElementById('api-setup-banner');
    if (banner) {
      banner.style.display = hasApiKey ? 'none' : 'block';
    }

    // Display Active Engine
    if (activeEngineVal) {
      if (hasApiKey) {
        const modelName = (settings.featherlessModel || 'Llama-3.1').split('/').pop();
        activeEngineVal.textContent = `🤖 Featherless AI (${modelName})`;
        activeEngineVal.style.color = '#7c3aed';
      } else if (settings.googleApiKey && settings.googleApiKey.trim().length > 0) {
        activeEngineVal.textContent = '🔍 Google Fact Check API';
        activeEngineVal.style.color = '#059669';
      } else {
        activeEngineVal.textContent = '📋 Offline Knowledge Base';
        activeEngineVal.style.color = '#64748B';
      }
    }

    // Check whitelist
    const isWhitelisted = checkWhitelisted(currentDomain, settings.whitelist || []);
    updateWhitelistUI(isWhitelisted);
  }

  // Wire the banner "Add API Key in Settings" button
  const bannerSettingsBtn = document.getElementById('banner-open-settings');
  if (bannerSettingsBtn) {
    bannerSettingsBtn.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    });
  }

  function checkWhitelisted(domain, whitelist) {
    if (!domain) return false;
    const d = domain.toLowerCase();
    return whitelist.some(w => {
      const clean = w.toLowerCase().trim();
      return d === clean || d.endsWith('.' + clean);
    });
  }

  function updateWhitelistUI(isWhitelisted) {
    if (isWhitelisted) {
      statusPill.className = 'status-indicator is-whitelisted';
      statusPill.querySelector('.status-text').textContent = 'Whitelisted';
      toggleWhitelistBtn.className = 'whitelist-btn is-active';
      toggleWhitelistBtn.textContent = 'Trusted';
    } else {
      statusPill.className = 'status-indicator';
      statusPill.querySelector('.status-text').textContent = 'Active';
      toggleWhitelistBtn.className = 'whitelist-btn';
      toggleWhitelistBtn.textContent = 'Trust Domain';
    }
  }

  function saveSettings() {
    if (!activeSettings) return;

    activeSettings.autoScan = toggleAutoScan.checked;
    activeSettings.scanText = toggleScanText.checked;
    activeSettings.scanImages = toggleScanImages.checked;
    activeSettings.scanVideos = toggleScanVideos.checked;
    activeSettings.sensitivity = sensitivityMap[sensitivitySlider.value].value;

    chrome.runtime.sendMessage({
      action: 'UPDATE_SETTINGS',
      settings: activeSettings
    });
  }

  // Event Listeners
  toggleAutoScan.addEventListener('change', saveSettings);
  toggleScanText.addEventListener('change', saveSettings);
  toggleScanImages.addEventListener('change', saveSettings);
  toggleScanVideos.addEventListener('change', saveSettings);

  sensitivitySlider.addEventListener('input', () => {
    sensitivityDisplay.textContent = sensitivityMap[sensitivitySlider.value].label;
    saveSettings();
  });

  toggleWhitelistBtn.addEventListener('click', () => {
    if (!currentDomain) return;
    chrome.runtime.sendMessage({
      action: 'TOGGLE_WHITELIST_DOMAIN',
      domain: currentDomain
    }, (res) => {
      if (res && res.success) {
        if (activeSettings) activeSettings.whitelist = res.whitelist;
        updateWhitelistUI(res.isWhitelisted);
      }
    });
  });

  openOptionsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });
});
