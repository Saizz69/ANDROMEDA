/**
 * TruthScan Options & Settings Logic
 * Manages Featherless AI API keys, Google Fact Check API, Whitelist, and Scanning Preferences.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const newDomainInput = document.getElementById('new-domain-input');
  const addDomainBtn = document.getElementById('add-domain-btn');
  const resetWhitelistBtn = document.getElementById('reset-whitelist-btn');
  const whitelistList = document.getElementById('whitelist-items');
  const whitelistCount = document.getElementById('whitelist-count');

  const prefAutoScan = document.getElementById('pref-auto-scan');
  const prefScanText = document.getElementById('pref-scan-text');
  const prefScanImages = document.getElementById('pref-scan-images');
  const prefScanVideos = document.getElementById('pref-scan-videos');
  const prefSensitivity = document.getElementById('pref-sensitivity');

  // API & Backend Elements
  const backendUrlInput = document.getElementById('backend-url-input');
  const testBackendBtn = document.getElementById('test-backend-btn');
  const backendSpinner = document.getElementById('backend-spinner');
  const backendBtnText = document.getElementById('backend-btn-text');
  const backendTestResult = document.getElementById('backend-test-result');
  const backendStatusPill = document.getElementById('backend-status-pill');

  const featherlessKeyInput = document.getElementById('featherless-key-input');
  const toggleKeyVisibilityBtn = document.getElementById('toggle-key-visibility');
  const featherlessModelSelect = document.getElementById('featherless-model-select');
  const testFeatherlessBtn = document.getElementById('test-featherless-btn');
  const testSpinner = document.getElementById('test-spinner');
  const testBtnText = document.getElementById('test-btn-text');
  const connectionTestResult = document.getElementById('connection-test-result');
  const featherlessStatusPill = document.getElementById('featherless-status-pill');
  const googleKeyInput = document.getElementById('google-key-input');

  const toast = document.getElementById('save-toast');
  const navLinks = document.querySelectorAll('.nav-item');

  const DEFAULT_WHITELIST = [];

  const sensitivityMap = { '1': 'low', '2': 'medium', '3': 'high' };
  const sensitivityReverseMap = { 'low': '1', 'medium': '2', 'high': '3' };

  let activeSettings = null;

  // Sidebar navigation handling
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  // Load Settings from Background
  chrome.runtime.sendMessage({ action: 'GET_SETTINGS' }, (res) => {
    if (res && res.success && res.settings) {
      activeSettings = res.settings;
      renderSettings(activeSettings);
    }
  });

  function renderSettings(settings) {
    prefAutoScan.checked = settings.autoScan !== false;
    prefScanText.checked = settings.scanText !== false;
    prefScanImages.checked = settings.scanImages !== false;
    prefScanVideos.checked = settings.scanVideos !== false;
    prefSensitivity.value = sensitivityReverseMap[settings.sensitivity || 'medium'] || '2';

    // Backend & API Keys
    if (backendUrlInput) {
      backendUrlInput.value = settings.backendUrl || 'http://127.0.0.1:8000';
    }
    featherlessKeyInput.value = settings.featherlessApiKey || '';
    featherlessModelSelect.value = settings.featherlessModel || 'meta-llama/Meta-Llama-3.1-8B-Instruct';
    googleKeyInput.value = settings.googleApiKey || '';

    updateFeatherlessStatusPill(settings.featherlessApiKey);
    renderWhitelist(settings.whitelist || []);
  }

  function updateFeatherlessStatusPill(key) {
    if (key && key.trim().length > 0) {
      featherlessStatusPill.className = 'key-status-pill is-connected';
      featherlessStatusPill.textContent = 'API Key Configured';
    } else {
      featherlessStatusPill.className = 'key-status-pill';
      featherlessStatusPill.textContent = 'Offline / Not Set';
    }
  }

  function renderWhitelist(list) {
    whitelistList.innerHTML = '';
    whitelistCount.textContent = list.length;

    list.forEach(domain => {
      const li = document.createElement('li');
      li.className = 'whitelist-item';
      li.innerHTML = `
        <span class="domain-text">${escapeHtml(domain)}</span>
        <button class="remove-domain-btn" title="Remove domain" aria-label="Remove">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      `;

      li.querySelector('.remove-domain-btn').addEventListener('click', () => {
        removeDomain(domain);
      });

      whitelistList.appendChild(li);
    });
  }

  function showToast(message = 'Settings saved') {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }

  function saveSettings() {
    if (!activeSettings) return;

    activeSettings.autoScan = prefAutoScan.checked;
    activeSettings.scanText = prefScanText.checked;
    activeSettings.scanImages = prefScanImages.checked;
    activeSettings.scanVideos = prefScanVideos.checked;
    activeSettings.sensitivity = sensitivityMap[prefSensitivity.value] || 'medium';

    if (backendUrlInput) {
      activeSettings.backendUrl = backendUrlInput.value.trim() || 'http://127.0.0.1:8000';
    }
    activeSettings.featherlessApiKey = featherlessKeyInput.value.trim();
    activeSettings.featherlessModel = featherlessModelSelect.value;
    activeSettings.googleApiKey = googleKeyInput.value.trim();

    updateFeatherlessStatusPill(activeSettings.featherlessApiKey);

    chrome.runtime.sendMessage({
      action: 'UPDATE_SETTINGS',
      settings: activeSettings
    }, (res) => {
      if (res && res.success) {
        showToast('Settings successfully updated');
      }
    });
  }

  // Test ANDROMEDA Local Backend Server
  if (testBackendBtn) {
    testBackendBtn.addEventListener('click', () => {
      const url = backendUrlInput.value.trim() || 'http://127.0.0.1:8000';
      backendSpinner.style.display = 'inline-block';
      backendBtnText.textContent = 'Testing...';
      testBackendBtn.disabled = true;
      backendTestResult.textContent = '';

      chrome.runtime.sendMessage({
        action: 'TEST_BACKEND_CONNECTION',
        backendUrl: url
      }, (res) => {
        backendSpinner.style.display = 'none';
        backendBtnText.textContent = 'Test Backend Server';
        testBackendBtn.disabled = false;

        if (res && res.success) {
          backendTestResult.className = 'test-feedback is-success';
          const info = res.data || {};
          const dbCount = info.database_entries || 0;
          backendTestResult.textContent = `✓ Backend online! Latency: ${res.latencyMs}ms (${info.project} v${info.version}, ${dbCount} curated hoaxes loaded)`;
          backendStatusPill.className = 'key-status-pill is-connected';
          backendStatusPill.textContent = 'Live Connected';
          saveSettings();
        } else {
          backendTestResult.className = 'test-feedback is-error';
          const errMsg = res ? (res.error || 'Server unreachable') : 'Connection failed';
          backendTestResult.textContent = `✕ Cannot connect to ${url} (${errMsg}). Make sure 'uvicorn main:app --reload' is running.`;
          backendStatusPill.className = 'key-status-pill is-error';
          backendStatusPill.textContent = 'Server Offline';
        }
      });
    });
  }

  // Toggle key visibility
  toggleKeyVisibilityBtn.addEventListener('click', () => {
    if (featherlessKeyInput.type === 'password') {
      featherlessKeyInput.type = 'text';
      toggleKeyVisibilityBtn.textContent = '🔒';
    } else {
      featherlessKeyInput.type = 'password';
      toggleKeyVisibilityBtn.textContent = '👁';
    }
  });

  // Test Featherless Connection
  testFeatherlessBtn.addEventListener('click', () => {
    const key = featherlessKeyInput.value.trim();
    const model = featherlessModelSelect.value;

    if (!key) {
      connectionTestResult.className = 'test-feedback is-error';
      connectionTestResult.textContent = '⚠️ Please enter your Featherless API key first.';
      return;
    }

    testSpinner.style.display = 'inline-block';
    testBtnText.textContent = 'Testing...';
    testFeatherlessBtn.disabled = true;
    connectionTestResult.textContent = '';

    chrome.runtime.sendMessage({
      action: 'TEST_FEATHERLESS_API',
      apiKey: key,
      model: model
    }, (res) => {
      testSpinner.style.display = 'none';
      testBtnText.textContent = 'Test API Connection';
      testFeatherlessBtn.disabled = false;

      if (res && res.success) {
        connectionTestResult.className = 'test-feedback is-success';
        connectionTestResult.textContent = `✓ Connected successfully! Latency: ${res.latencyMs}ms (${model.split('/').pop()})`;
        featherlessStatusPill.className = 'key-status-pill is-connected';
        featherlessStatusPill.textContent = 'Live Connected';
        // Auto save on successful test
        saveSettings();
      } else {
        connectionTestResult.className = 'test-feedback is-error';
        const errMsg = res ? (res.error || 'Connection failed') : 'Could not reach service worker';
        connectionTestResult.textContent = `✕ Failed: ${errMsg}`;
        featherlessStatusPill.className = 'key-status-pill is-error';
        featherlessStatusPill.textContent = 'Error';
      }
    });
  });

  function addDomain() {
    const val = newDomainInput.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!val) return;

    const list = new Set(activeSettings.whitelist || []);
    if (!list.has(val)) {
      list.add(val);
      activeSettings.whitelist = Array.from(list);
      renderWhitelist(activeSettings.whitelist);
      saveSettings();
      newDomainInput.value = '';
      showToast(`Added ${val} to whitelist`);
    }
  }

  function removeDomain(domain) {
    const list = new Set(activeSettings.whitelist || []);
    if (list.has(domain)) {
      list.delete(domain);
      activeSettings.whitelist = Array.from(list);
      renderWhitelist(activeSettings.whitelist);
      saveSettings();
      showToast(`Removed ${domain} from whitelist`);
    }
  }

  function resetWhitelist() {
    if (confirm('Reset trusted domain whitelist to defaults?')) {
      activeSettings.whitelist = [...DEFAULT_WHITELIST];
      renderWhitelist(activeSettings.whitelist);
      saveSettings();
      showToast('Whitelist reset to defaults');
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Event Listeners
  addDomainBtn.addEventListener('click', addDomain);
  newDomainInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addDomain();
  });

  resetWhitelistBtn.addEventListener('click', resetWhitelist);

  prefAutoScan.addEventListener('change', saveSettings);
  prefScanText.addEventListener('change', saveSettings);
  prefScanImages.addEventListener('change', saveSettings);
  prefScanVideos.addEventListener('change', saveSettings);
  prefSensitivity.addEventListener('input', saveSettings);

  featherlessKeyInput.addEventListener('change', saveSettings);
  featherlessModelSelect.addEventListener('change', saveSettings);
  googleKeyInput.addEventListener('change', saveSettings);
});
