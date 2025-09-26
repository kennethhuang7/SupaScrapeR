const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
let currentScreen = 'folder-select';
let serviceKeyVisible = false;
let actualServiceKey = '';
let appData = {
  dataFolder: null,
  credentials: {},
  runMode: null,
  scrapeMode: null,
  selectedPreset: null,
  keywords: [],
  selectedKeywords: [],
  keywordBatchSize: 10,
  deepscanBatchSize: 25,
  currentBroadSubreddits: [],
  currentConcentratedSubreddits: []
};
window.minimizeWindow = () => ipcRenderer.send('minimize-window');
window.maximizeWindow = () => ipcRenderer.send('maximize-window');
window.closeWindow = () => ipcRenderer.send('close-window');
document.addEventListener('DOMContentLoaded', () => {
  const autoLogin = checkExistingFolder();
  if (!autoLogin) {
    loadScreen('folder-select');
  }
  setupSidebarNavigation();
});

function setupSidebarNavigation() {
  const sidebarItems = document.querySelectorAll('.sidebar-item[data-screen]');
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      const screen = item.dataset.screen;
      if (screen && canNavigateToScreen(screen)) {
        setActiveSidebarItem(item);
        loadScreen(screen);
      }
    });
  });
}
function setActiveSidebarItem(activeItem) {
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.remove('active');
  });
  activeItem.classList.add('active');
}
function canNavigateToScreen(screen) {
  if (screen === 'folder-select') return true;
  if (screen === 'login' && appData.dataFolder) return true;
  if (screen === 'scraper' && appData.credentials.redditClientId) return true;
  return false;
}
function loadScreen(screenName) {
  currentScreen = screenName;
  const container = document.getElementById('screen-container');
  container.innerHTML = '';
  switch(screenName) {
    case 'folder-select':
      loadFolderSelectScreen();
      break;
    case 'login':
      loadLoginScreen();
      break;
    case 'run-mode':
      loadRunModeScreen();
      break;
    case 'scrape-mode':
      loadScrapeModeScreen();
      break;
    case 'preset-select':
      loadPresetSelectScreen();
      break;
    case 'custom-keywords':
      loadCustomKeywordsScreen();
      break;
    case 'keyword-select':
      loadKeywordSelectScreen();
      break;
    case 'batch-size':
      loadBatchSizeScreen();
      break;
    case 'confirmation':
      loadConfirmationScreen();
      break;
    case 'settings':
      loadSettingsScreen();
      break;
    case 'scraper-status':
      loadScraperStatusScreen();
      break;
  }
}
function loadFolderSelectScreen() {
  const container = document.getElementById('screen-container');
  container.innerHTML = `
    <div class="screen">
      <div class="screen-card">
        <div class="logo-container">
          <img src="../assets/supascraper-complete-logo.png" alt="SupaScrapeR" class="logo-main">
          <div class="subtitle">
            Advanced Reddit Data Collection Tool<br>
            Created by Kenneth Huang
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Data Storage Location</label>
          <div class="folder-display" id="folder-display">
            ${getDefaultFolder()}
          </div>
        </div>
        <button class="btn-secondary" onclick="browseFolder()">
          <span style="margin-right: 8px;">📁</span> Browse Folder
        </button>
        <button class="btn-secondary" onclick="useDefaultFolder()">
          <span style="margin-right: 8px;">📂</span> Use Default Location
        </button>
        <button class="btn-primary" id="continue-btn" disabled onclick="continueToLogin()">
          Please choose and confirm a location
        </button>
        <div class="disclaimer">
          For easy access, crucial app data will always be stored in Documents/SupaScrapeR.
          Your user data will be stored in the folder you choose.
        </div>
      </div>
    </div>
  `;
  checkExistingFolder();
}
function getDefaultFolder() {
  const home = process.env.HOME || process.env.USERPROFILE;
  return path.join(home, 'Documents', 'SupaScrapeR');
}
function checkExistingFolder() {
  const lastFolderPath = path.join(getDefaultFolder(), 'last_folder.txt');
  if (fs.existsSync(lastFolderPath)) {
    const lastFolder = fs.readFileSync(lastFolderPath, 'utf8').trim();
    if (lastFolder && fs.existsSync(lastFolder)) {
      appData.dataFolder = lastFolder;
      const credPath = path.join(appData.dataFolder, 'scraper_credentials.dat');
      if (fs.existsSync(credPath)) {
        setActiveSidebarItem(document.querySelector('.sidebar-item[data-screen="scraper"]'));
        sendToBackend({
          type: 'load-credentials',
          dataFolder: appData.dataFolder
        });
        return true;
      }
      updateFolderDisplay(lastFolder);
      enableContinueButton();
    }
  }
  return false;
}
function updateFolderDisplay(folderPath) {
  const display = document.getElementById('folder-display');
  if (display) {
    const defaultFolder = getDefaultFolder();
    if (path.normalize(folderPath) === path.normalize(defaultFolder)) {
      display.textContent = `Default: ${folderPath}`;
    } else {
      display.textContent = `Selected: ${folderPath}`;
    }
  }
}
function enableContinueButton() {
  const btn = document.getElementById('continue-btn');
  if (btn) {
    btn.disabled = false;
    btn.textContent = '✨ Continue';
    btn.style.background = 'var(--gradient-primary)';
  }
}
window.browseFolder = async () => {
  const folderPath = await ipcRenderer.invoke('select-folder');
  if (folderPath) {
    appData.dataFolder = folderPath;
    updateFolderDisplay(folderPath);
    enableContinueButton();
    saveLastUsedFolder(folderPath);
  }
};
window.useDefaultFolder = () => {
  const defaultFolder = getDefaultFolder();
  if (!fs.existsSync(defaultFolder)) {
    fs.mkdirSync(defaultFolder, { recursive: true });
  }
  appData.dataFolder = defaultFolder;
  updateFolderDisplay(defaultFolder);
  enableContinueButton();
  saveLastUsedFolder(defaultFolder);
};
function saveLastUsedFolder(folderPath) {
  const configFolder = getDefaultFolder();
  if (!fs.existsSync(configFolder)) {
    fs.mkdirSync(configFolder, { recursive: true });
  }
  const lastFolderPath = path.join(configFolder, 'last_folder.txt');
  fs.writeFileSync(lastFolderPath, folderPath);
}
window.continueToLogin = () => {
  if (appData.dataFolder) {
    setActiveSidebarItem(document.querySelector('.sidebar-item[data-screen="login"]'));
    loadScreen('login');
  }
};
ipcRenderer.on('backend-message', (event, message) => {
  handleBackendMessage(message);
});
function handleBackendMessage(message) {
  switch(message.type) {
    case 'login-success':
      appData.credentials = message.data;
      const loginBtn = document.getElementById('login-btn');
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = '🔑 Login';
      }
      setActiveSidebarItem(document.querySelector('.sidebar-item[data-screen="scraper"]'));
      loadScreen('run-mode');
      sendToBackend({ type: 'check-nlp' });
      break;
    case 'login-error':
      showLoginError(message.error);
      const errorBtn = document.getElementById('login-btn');
      if (errorBtn) {
        errorBtn.disabled = false;
        errorBtn.textContent = '🔑 Login';
      }
      break;
    case 'scraper-log':
      appendToScraperLog(message.data);
      break;
    case 'scraper-progress':
      updateScraperProgress(message.data);
      break;
    case 'keywords-fetched':
      handleKeywordsFetched(message.data);
      break;
    case 'nlp-status':
      appData.nlpAvailable = message.available;
      const nlpContainer = document.getElementById('nlp-status-container');
      if (nlpContainer) {
        nlpContainer.className = `nlp-status ${message.available ? 'nlp-available' : 'nlp-standard'}`;
        nlpContainer.innerHTML = `
          <div class="status-icon">${message.available ? '✨' : '📋'}</div>
          <div class="status-text">
            ${message.available ? 'Enhanced Search with NLP is available' : 'Standard search mode (spaCy not installed)'}
          </div>
        `;
      }
      break;
    case 'keywords-error':
      handleKeywordsError(message.error);
      break;
    case 'scraper-finished':
      const stopBtn = document.querySelector('.btn-control.stop');
      if (stopBtn) {
        stopBtn.textContent = '✅ Completed';
        stopBtn.disabled = true;
      }
      const pauseBtn = document.getElementById('pause-btn');
      if (pauseBtn) {
        pauseBtn.disabled = true;
      }
      document.getElementById('estimated-time').textContent = 'Completed';
      appendToScraperLog('<b style="color: var(--success);">✅ Scraping completed successfully!</b>');
      break;
    case 'error':
      console.error('Backend error:', message.message);
      break;
    case 'scraper-stopped':
      handleScraperStopped();
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
}
function sendToBackend(message) {
  ipcRenderer.send('send-to-backend', message);
}
function handleScraperStopped() {
  const stopBtn = document.querySelector('.btn-control.stop');
  if (stopBtn) {
    stopBtn.textContent = '✅ Stopped';
    stopBtn.disabled = true;
  }
  const pauseBtn = document.getElementById('pause-btn');
  if (pauseBtn) {
    pauseBtn.disabled = true;
  }
  if (document.getElementById('screen-container')) {
  document.getElementById('screen-container').style.maxWidth = '';
  }
}
function loadLoginScreen() {
  const container = document.getElementById('screen-container');
  container.innerHTML = `
    <div class="screen">
      <div class="screen-card">
        <div class="logo-container">
          <img src="../assets/supascraper-complete-logo.png" alt="SupaScrapeR" class="logo-main">
          <div class="subtitle">
            Connect your Reddit and Supabase accounts
          </div>
        </div>
        <div class="form-section">
          <div class="section-header">
            <div class="section-icon supabase-icon">
              <svg viewBox="0 0 24 24"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/></svg>
            </div>
            <h3 class="section-title">Supabase Configuration</h3>
          </div>
          <div class="form-group">
            <label class="form-label">Project URL</label>
            <input type="text" class="input-field" id="supabase-url" placeholder="https://your-project.supabase.co">
          </div>
          <div class="form-group">
            <label class="form-label">
              Service Role Key
              <button class="visibility-toggle" onclick="toggleServiceKeyVisibility()">
                <svg id="eye-icon" viewBox="0 0 24 24" width="16" height="16">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
              </button>
            </label>
            <textarea class="input-field textarea-field" id="service-key" placeholder="Your service role key (keep this secret!)" rows="3"></textarea>
          </div>
        </div>
        <div class="form-section">
          <div class="section-header">
            <div class="section-icon reddit-icon">
              <svg viewBox="0 0 24 24"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
            </div>
            <h3 class="section-title">Reddit API Configuration</h3>
          </div>
          <div class="form-group">
            <label class="form-label">Client ID</label>
            <input type="text" class="input-field" id="reddit-client-id" placeholder="14-character client ID">
          </div>
          <div class="form-group">
            <label class="form-label">Client Secret</label>
            <input type="password" class="input-field" id="reddit-client-secret" placeholder="Your client secret">
          </div>
          <div class="form-group">
            <label class="form-label">User Agent</label>
            <input type="text" class="input-field" id="reddit-user-agent" placeholder="YourApp/1.0 by YourUsername">
          </div>
        </div>
        <div class="checkbox-group">
          <label class="checkbox-container">
            <input type="checkbox" id="keep-signed-in" checked>
            <span class="checkbox-mark"></span>
            <span class="checkbox-label">Keep me signed in on this device</span>
          </label>
        </div>
        <div class="error-message" id="login-error" style="display: none;"></div>
        <button class="btn-primary" id="login-btn" disabled onclick="handleLogin()">
          🔑 Login
        </button>
        <button class="btn-link" onclick="goBackToFolder()">
          ← Change Data Folder
        </button>
      </div>
    </div>
  `;
  setupLoginListeners();
  loadSavedCredentials();
}
function setupLoginListeners() {
  const fields = ['supabase-url', 'reddit-client-id', 'reddit-client-secret', 'reddit-user-agent'];
  fields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', updateLoginButtonState);
    }
  });
  const serviceKeyField = document.getElementById('service-key');
  if (serviceKeyField) {
    serviceKeyField.addEventListener('input', (e) => {
      if (!serviceKeyVisible) {
        actualServiceKey = e.target.value;
      }
      updateLoginButtonState();
    });
    serviceKeyField.style.webkitTextSecurity = 'disc';
    serviceKeyField.style.textSecurity = 'disc';
  }
}
let toggleInProgress = false;
window.toggleServiceKeyVisibility = () => {
  const field = document.getElementById('service-key');
  const icon = document.getElementById('eye-icon');
  if (!field || !icon) return;
  serviceKeyVisible = !serviceKeyVisible;
  if (serviceKeyVisible) {
    if (!actualServiceKey) {
      actualServiceKey = field.value;
    }
    field.value = actualServiceKey;
    field.style.webkitTextSecurity = 'none';
    field.style.textSecurity = 'none';
    icon.innerHTML = '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>';
  } else {
    actualServiceKey = field.value;
    field.value = '•'.repeat(actualServiceKey.length);
    field.style.webkitTextSecurity = 'disc';
    field.style.textSecurity = 'disc';
    icon.innerHTML = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
  }
};
function updateLoginButtonState() {
  const btn = document.getElementById('login-btn');
  const fields = [
    document.getElementById('supabase-url')?.value.trim(),
    actualServiceKey.trim(),
    document.getElementById('reddit-client-id')?.value.trim(),
    document.getElementById('reddit-client-secret')?.value.trim(),
    document.getElementById('reddit-user-agent')?.value.trim()
  ];
  const allFilled = fields.every(field => field);
  if (btn) {
    btn.disabled = !allFilled;
    if (allFilled) {
      btn.style.background = 'var(--gradient-primary)';
      btn.style.color = 'white';
      btn.style.cursor = 'pointer';
    } else {
      btn.style.background = 'linear-gradient(135deg, #2a2f3d 0%, #1f232e 100%)';
      btn.style.color = 'var(--text-tertiary)';
      btn.style.cursor = 'not-allowed';
    }
  }
}
function loadSavedCredentials() {
  const credPath = path.join(appData.dataFolder, 'scraper_credentials.dat');
  if (fs.existsSync(credPath)) {
    sendToBackend({
      type: 'load-credentials',
      dataFolder: appData.dataFolder
    });
    return true;
  }
  return false;
}
window.handleLogin = () => {
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = '🔄 Testing connections...';
  const credentials = {
    supabaseUrl: document.getElementById('supabase-url').value.trim(),
    serviceKey: actualServiceKey.trim(),
    redditClientId: document.getElementById('reddit-client-id').value.trim(),
    redditClientSecret: document.getElementById('reddit-client-secret').value.trim(),
    redditUserAgent: document.getElementById('reddit-user-agent').value.trim(),
    keepSignedIn: document.getElementById('keep-signed-in').checked
  };
  sendToBackend({
    type: 'login',
    credentials: credentials,
    dataFolder: appData.dataFolder
  });
};
function showLoginError(error) {
  const errorDiv = document.getElementById('login-error');
  if (errorDiv) {
    const truncatedError = error.length > 200 ? error.substring(0, 200) + '... [truncated]' : error;
    errorDiv.textContent = truncatedError;
    errorDiv.style.display = 'block';
  }
  const btn = document.getElementById('login-btn');
  if (btn) {
    btn.disabled = false;
    btn.textContent = '🔑 Login';
  }
  document.querySelectorAll('.input-field, .textarea-field').forEach(field => {
    field.style.borderColor = 'var(--error)';
  });
}
window.goBackToFolder = () => {
  setActiveSidebarItem(document.querySelector('.sidebar-item[data-screen="folder-select"]'));
  loadScreen('folder-select');
};
function loadRunModeScreen() {
  const container = document.getElementById('screen-container');
  container.innerHTML = `
    <div class="screen">
      <div class="screen-card">
        <div class="logo-container">
          <img src="../assets/supascraper-complete-logo.png" alt="SupaScrapeR" class="logo-main">
          <div class="subtitle">
            Choose how you want to run the scraper
          </div>
        </div>
        <div class="option-grid">
          <button class="option-card" onclick="selectRunMode('once')">
            <div class="option-icon">🔄</div>
            <div class="option-title">Run Once</div>
            <div class="option-description">
              Single data collection session.<br>
              Perfect for one-time research.
            </div>
          </button>
          <button class="option-card" onclick="selectRunMode('infinite')">
            <div class="option-icon">♾️</div>
            <div class="option-title">Run Continuously</div>
            <div class="option-description">
              Ongoing collection with breaks.<br>
              Ideal for monitoring trends.
            </div>
          </button>
        </div>
        <div class="nlp-status ${appData.nlpAvailable ? 'nlp-available' : 'nlp-standard'}" id="nlp-status-container">
          <div class="status-icon">${appData.nlpAvailable ? '✨' : '📋'}</div>
          <div class="status-text">
            ${appData.nlpAvailable ? 'Enhanced Search with NLP is available' : 'Checking NLP status...'}
          </div>
        </div>
        <button class="btn-danger" onclick="handleLogout()">
          🔒 Logout
        </button>
      </div>
    </div>
  `;
  if (appData.nlpAvailable === undefined) {
    sendToBackend({ type: 'check-nlp' });
  }
}
window.selectRunMode = (mode) => {
  appData.runMode = mode;
  loadScreen('scrape-mode');
};
window.handleLogout = () => {
  sendToBackend({ type: 'logout', dataFolder: appData.dataFolder });
  appData = {
    dataFolder: appData.dataFolder,
    credentials: {},
    runMode: null,
    scrapeMode: null,
    selectedPreset: null,
    keywords: [],
    selectedKeywords: [],
    keywordBatchSize: 10,
    deepscanBatchSize: 25,
    currentBroadSubreddits: [],
    currentConcentratedSubreddits: []
  };
  setActiveSidebarItem(document.querySelector('.sidebar-item[data-screen="folder-select"]'));
  loadScreen('folder-select');
};
function loadScrapeModeScreen() {
  const container = document.getElementById('screen-container');
  container.innerHTML = `
    <div class="screen">
      <div class="screen-card">
        <div class="screen-header">
          <button class="btn-back" onclick="goBackToRunMode()">← Back</button>
          <h2 class="screen-title">Select Scraping Strategy</h2>
        </div>
        <div class="option-list">
          <div class="option-row">
            <button class="option-card horizontal" onclick="selectScrapeMode('keyword')">
              <div class="option-icon">🔍</div>
              <div class="option-content">
                <div class="option-title">Keyword Search Only</div>
                <div class="option-description">Target specific topics using trending keywords</div>
              </div>
            </button>
            <button class="settings-btn" onclick="openSettings('keyword')" title="Customize subreddit lists">
              ⚙️
            </button>
          </div>
          <div class="option-row">
            <button class="option-card horizontal" onclick="selectScrapeMode('deepscan')">
              <div class="option-icon">🔬</div>
              <div class="option-content">
                <div class="option-title">DeepScan Only</div>
                <div class="option-description">Analyze high-engagement posts without keyword filtering</div>
              </div>
            </button>
            <button class="settings-btn" onclick="openSettings('deepscan')" title="Customize subreddit lists">
              ⚙️
            </button>
          </div>
          <div class="option-row">
            <button class="option-card horizontal" onclick="selectScrapeMode('both')">
              <div class="option-icon">⚡</div>
              <div class="option-content">
                <div class="option-title">Both Keyword and DeepScan</div>
                <div class="option-description">Comprehensive coverage using both approaches</div>
              </div>
            </button>
            <button class="settings-btn" onclick="openSettings('both')" title="Customize subreddit lists">
              ⚙️
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
window.goBackToRunMode = () => {
  loadScreen('run-mode');
};
window.selectScrapeMode = (mode) => {
  appData.scrapeMode = mode;
  loadScreen('preset-select');
};
window.openSettings = (type) => {
  appData.currentSettingsType = type;
  loadScreen('settings');
};
function loadPresetSelectScreen() {
  const container = document.getElementById('screen-container');
  let presetHTML = '';
  presetHTML += `
    <button class="preset-card" onclick="selectPreset('default')">
      <div class="preset-icon">🏠</div>
      <div class="preset-content">
        <div class="preset-title">Default Configuration</div>
        <div class="preset-description">${getDefaultDescription()}</div>
      </div>
    </button>
  `;
  for (let i = 1; i <= 5; i++) {
    const presetData = getPresetData(i);
    const hasData = presetData && ((Array.isArray(presetData) && presetData.length > 0) || 
                    (presetData.broad && presetData.broad.length > 0) || 
                    (presetData.concentrated && presetData.concentrated.length > 0));
    presetHTML += `
      <button class="preset-card ${!hasData ? 'disabled' : ''}" 
              ${hasData ? `onclick="selectPreset('preset_${i}', event)"` : ''}
              ${!hasData ? 'style="cursor: not-allowed; opacity: 0.5;"' : ''}>
        <div class="preset-icon">📝</div>
        <div class="preset-content">
          <div class="preset-title">Preset ${i}</div>
          <div class="preset-description">
            ${hasData ? getPresetDescription(presetData) : 'No data saved'}
          </div>
        </div>
      </button>
    `;
  }
  container.innerHTML = `
    <div class="screen">
      <div class="screen-card large">
        <div class="screen-header">
          <button class="btn-back" onclick="goBackToScrapeMode()">← Back</button>
          <h2 class="screen-title">Select Subreddit Preset</h2>
        </div>
        <div class="preset-grid">
          ${presetHTML}
        </div>
        <button class="btn-primary" id="confirm-preset-btn" disabled onclick="confirmPresetSelection()">
          ✨ Confirm Preset
        </button>
      </div>
    </div>
  `;
}
window.selectPreset = (preset, event) => {
  appData.selectedPreset = preset;
  document.querySelectorAll('.preset-card').forEach(card => {
    card.classList.remove('selected');
  });
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('selected');
  } else {
    document.querySelectorAll('.preset-card').forEach(card => {
      if (card.onclick && card.onclick.toString().includes(preset)) {
        card.classList.add('selected');
      }
    });
  }
  const btn = document.getElementById('confirm-preset-btn');
  if (btn) {
    btn.disabled = false;
    btn.style.background = 'var(--gradient-primary)';
    btn.style.cursor = 'pointer';
  }
};
window.confirmPresetSelection = () => {
  if (appData.selectedPreset === 'default') {
    appData.currentBroadSubreddits = getDefaultBroadSubreddits();
    appData.currentConcentratedSubreddits = getDefaultConcentratedSubreddits();
  } else {
    const presetNum = parseInt(appData.selectedPreset.split('_')[1]);
    const data = loadPresetData(appData.scrapeMode, presetNum);
    if (appData.scrapeMode === 'both') {
      appData.currentBroadSubreddits = data.broad || getDefaultBroadSubreddits();
      appData.currentConcentratedSubreddits = data.concentrated || getDefaultConcentratedSubreddits();
    } else if (appData.scrapeMode === 'keyword') {
      appData.currentBroadSubreddits = data || getDefaultBroadSubreddits();
      appData.currentConcentratedSubreddits = getDefaultConcentratedSubreddits();
    } else {
      appData.currentBroadSubreddits = getDefaultBroadSubreddits();
      appData.currentConcentratedSubreddits = data || getDefaultConcentratedSubreddits();
    }
  }
  if (appData.scrapeMode === 'keyword' || appData.scrapeMode === 'both') {
    loadScreen('custom-keywords');
  } else {
    loadScreen('batch-size');
  }
};
function getDefaultDescription() {
  if (appData.scrapeMode === 'keyword') {
    return 'Uses 40 general subreddits for keyword searching';
  } else if (appData.scrapeMode === 'deepscan') {
    return 'Uses 15 high-engagement subreddits for deep scanning';
  } else {
    return 'Uses 40 subreddits for keywords, 15 for deepscan';
  }
}
function getPresetData(presetNum) {
  return loadPresetData(appData.scrapeMode, presetNum);
}
function getPresetDescription(data) {
  if (appData.scrapeMode === 'both') {
    const broadCount = data.broad ? data.broad.length : 0;
    const concentratedCount = data.concentrated ? data.concentrated.length : 0;
    return `${broadCount} keyword subs, ${concentratedCount} deepscan subs`;
  } else {
    return `${data.length} subreddits configured`;
  }
}
function loadCustomKeywordsScreen() {
  const recentKeywords = loadRecentKeywords();
  let recentKeywordsHTML = '';
  if (recentKeywords && recentKeywords.length > 0) {
    recentKeywordsHTML = `
      <div class="recent-keywords-section">
        <div class="section-header">
          <h3 class="section-title">Recent Keyword Sets</h3>
          <button class="btn-text" onclick="clearRecentKeywords()">Clear History</button>
        </div>
        <div class="recent-keywords-list">
          ${recentKeywords.map((set, index) => `
            <button class="recent-keyword-item" onclick="useRecentKeywordSet(${index})">
              <div class="keyword-set-preview">${set.keywords.slice(0, 3).join(', ')}${set.keywords.length > 3 ? ` +${set.keywords.length - 3} more` : ''}</div>
              <div class="keyword-set-date">${formatRelativeDate(set.date)}</div>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="divider-with-text">
        <span>or enter new keywords</span>
      </div>
    `;
  }
  const container = document.getElementById('screen-container');
  container.innerHTML = `
    <div class="screen">
      <div class="screen-card ${recentKeywords.length > 0 ? 'large' : ''}">
        <div class="screen-header">
            <button class="btn-back" onclick="goBackToPresetSelect()">← Back</button>
          <h2 class="screen-title">Configure Base Keywords</h2>
        </div>
        <div class="subtitle">
          Enter keywords separated by commas.<br>
          These will be used to find trending related keywords via Google Trends.
        </div>
        ${recentKeywordsHTML}
        <div class="form-group">
          <label class="form-label">Base Keywords</label>
          <textarea class="input-field textarea-field" 
                    id="custom-keywords-input" 
                    placeholder="Enter keywords separated by commas (e.g. politics, election, democracy)"
                    rows="4">politics</textarea>
        </div>
        <div class="error-message" id="keyword-error" style="display: none;"></div>
        <button class="btn-primary" onclick="fetchRelatedKeywords()">
          🔄 Fetch Related Keywords
        </button>
      </div>
    </div>
  `;
}
function loadRecentKeywords() {
  const recentPath = path.join(appData.dataFolder, 'recent_keywords.json');
  if (fs.existsSync(recentPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(recentPath, 'utf8'));
      return data.recent || [];
    } catch (e) {
      console.error('Failed to load recent keywords:', e);
    }
  }
  return [];
}
function saveRecentKeywords(keywords) {
  const recentPath = path.join(appData.dataFolder, 'recent_keywords.json');
  let recentData = { recent: [] };
  if (fs.existsSync(recentPath)) {
    try {
      recentData = JSON.parse(fs.readFileSync(recentPath, 'utf8'));
    } catch (e) {}
  }
  const isDuplicate = recentData.recent.some(set => 
    JSON.stringify(set.keywords.sort()) === JSON.stringify(keywords.sort())
  );
  if (!isDuplicate) {
    recentData.recent.unshift({
      keywords: keywords,
      date: new Date().toISOString()
    });
    recentData.recent = recentData.recent.slice(0, 5);
    fs.writeFileSync(recentPath, JSON.stringify(recentData, null, 2));
  }
}
window.useRecentKeywordSet = (index) => {
  const recent = loadRecentKeywords();
  if (recent && recent[index]) {
    document.getElementById('custom-keywords-input').value = recent[index].keywords.join(', ');
  }
};
window.clearRecentKeywords = () => {
  const recentPath = path.join(appData.dataFolder, 'recent_keywords.json');
  fs.writeFileSync(recentPath, JSON.stringify({ recent: [] }, null, 2));
  loadCustomKeywordsScreen();
};
window.goBackToPresetSelect = () => {
  loadScreen('preset-select');
};
window.goBackToScrapeMode = () => {
  loadScreen('scrape-mode');
};
window.goBackFromConfirmation = () => {
  loadScreen('batch-size');
};
window.goBackFromBatchSize = () => {
  if (appData.scrapeMode === 'keyword' || appData.scrapeMode === 'both') {
    loadScreen('keyword-select');
  } else {
    loadScreen('preset-select');
  }
};
window.fetchRelatedKeywords = () => {
  const input = document.getElementById('custom-keywords-input').value.trim();
  if (!input) {
    showKeywordError('Please enter at least one base keyword');
    return;
  }
  const keywords = input.split(',').map(k => k.trim()).filter(k => k);
  for (let kw of keywords) {
    if (!/^[a-zA-Z0-9\s\-_&]+$/.test(kw)) {
      showKeywordError('Only letters, numbers, spaces, hyphens, underscores, and ampersands allowed');
      return;
    }
  }
  appData.baseKeywords = keywords;
  saveRecentKeywords(keywords);
  loadScreen('keyword-select');
  sendToBackend({
    type: 'fetch-keywords',
    keywords: keywords
  });
};
function showKeywordError(message) {
  const errorDiv = document.getElementById('keyword-error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  document.getElementById('custom-keywords-input').style.borderColor = 'var(--error)';
}
function formatRelativeDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return date.toLocaleDateString();
}
function loadKeywordSelectScreen() {
  const container = document.getElementById('screen-container');
  container.innerHTML = `
    <div class="screen">
      <div class="screen-card large">
        <div class="screen-header">
          <button class="btn-back" onclick="goBackToCustomKeywords()">← Back</button>
          <h2 class="screen-title">Select Keywords</h2>
        </div>
        <div class="keyword-status" id="keyword-status">
          <div class="loading-spinner"></div>
          <span>🔄 Fetching trending keywords...</span>
        </div>
        <div class="keyword-container" id="keyword-container" style="display: none;">
          <div class="keyword-grid" id="keyword-grid"></div>
        </div>
        <div class="manual-entry-section" id="manual-entry-section" style="display: none;">
          <div class="form-group">
            <label class="form-label">Add Custom Keywords (one per line or comma-separated)</label>
            <textarea class="input-field textarea-field" 
                      id="manual-keywords-input" 
                      placeholder="Enter keywords to search for, one per line or separated by commas"
                      rows="6"></textarea>
          </div>
          <button class="btn-secondary" onclick="addManualKeywords()">
            ➕ Add to List
          </button>
        </div>
        <div class="keyword-controls" style="display: none;">
          <button class="btn-secondary" onclick="selectAllKeywords()">✅ Select All</button>
          <button class="btn-secondary" onclick="deselectAllKeywords()">❌ Deselect All</button>
          <button class="btn-secondary" id="add-custom-btn" onclick="showCustomKeywordInput()">➕ Add Custom</button>
        </div>
        <button class="btn-primary" id="confirm-keywords-btn" disabled onclick="confirmKeywordSelection()">
          ✨ Confirm Selection
        </button>
        <button class="btn-danger" id="retry-keywords-btn" style="display: none;" onclick="retryKeywordFetch()">
          🔄 Try Again
        </button>
        <button class="btn-secondary" id="manual-keywords-btn" style="display: none;" onclick="enableManualKeywordEntry()">
          ✏️ Enter Keywords Manually
        </button>
      </div>
    </div>
  `;
}
window.goBackToCustomKeywords = () => {
  loadScreen('custom-keywords');
};
function handleKeywordsFetched(keywords) {
  appData.keywords = keywords;
  document.getElementById('keyword-status').style.display = 'none';
  document.getElementById('keyword-container').style.display = 'block';
  document.querySelector('.keyword-controls').style.display = 'flex';
  document.getElementById('confirm-keywords-btn').style.display = 'block';
  document.getElementById('confirm-keywords-btn').disabled = false;
  document.getElementById('confirm-keywords-btn').textContent = '✨ Confirm Selection';
  document.getElementById('confirm-keywords-btn').onclick = confirmKeywordSelection;
  const grid = document.getElementById('keyword-grid');
  grid.innerHTML = '';
  keywords.forEach(keyword => {
    const item = document.createElement('label');
    item.className = 'keyword-item';
    item.innerHTML = `
      <input type="checkbox" value="${keyword}" checked onchange="updateKeywordSelection()">
      <span class="keyword-text">${keyword}</span>
    `;
    grid.appendChild(item);
  });
  updateKeywordSelection();
}
window.enableManualKeywordEntry = () => {
  document.getElementById('keyword-status').style.display = 'none';
  document.getElementById('retry-keywords-btn').style.display = 'none';
  document.getElementById('manual-keywords-btn').style.display = 'none';
  document.getElementById('confirm-keywords-btn').style.display = 'block';
  document.getElementById('confirm-keywords-btn').disabled = false;
  document.getElementById('manual-entry-section').style.display = 'block';
  document.getElementById('keyword-container').style.display = 'none';
  document.querySelector('.keyword-controls').style.display = 'none';
  const textarea = document.getElementById('manual-keywords-input');
  textarea.value = appData.baseKeywords ? appData.baseKeywords.join(', ') : '';
  textarea.focus();
  setupTextareaAutoScroll();
  const confirmBtn = document.getElementById('confirm-keywords-btn');
  confirmBtn.textContent = '✨ Use These Keywords';
  confirmBtn.onclick = () => {
    const input = textarea.value.trim();
    if (!input) {
      alert('Please enter at least one keyword');
      return;
    }
    const keywords = input.split(/[,\n]/)
      .map(k => k.trim())
      .filter(k => k && /^[a-zA-Z0-9\s\-_&]+$/.test(k));
    if (keywords.length === 0) {
      alert('Please enter valid keywords (letters, numbers, spaces, hyphens, underscores only)');
      return;
    }
    appData.selectedKeywords = keywords;
    loadScreen('batch-size');
  };
};
window.setupTextareaAutoScroll = () => {
  const textarea = document.getElementById('manual-keywords-input');
  if (!textarea) return;
  textarea.addEventListener('input', () => {
    textarea.scrollTop = textarea.scrollHeight;
  });
  textarea.addEventListener('focus', () => {
    setTimeout(() => {
      textarea.scrollTop = textarea.scrollHeight;
    }, 0);
  });
};
window.showCustomKeywordInput = () => {
  const manualSection = document.getElementById('manual-entry-section');
  manualSection.style.display = manualSection.style.display === 'none' ? 'block' : 'none';
  if (manualSection.style.display === 'block') {
    document.getElementById('manual-keywords-input').focus();
  }
};
window.addManualKeywords = () => {
  const input = document.getElementById('manual-keywords-input').value.trim();
  if (!input) return;
  const newKeywords = input.split(/[,\n]/)
    .map(k => k.trim())
    .filter(k => k && /^[a-zA-Z0-9\s\-_&]+$/.test(k));
  if (newKeywords.length === 0) {
    alert('Please enter valid keywords (letters, numbers, spaces, hyphens, underscores only)');
    return;
  }
  const grid = document.getElementById('keyword-grid');
  const existingKeywords = Array.from(document.querySelectorAll('.keyword-item input'))
    .map(cb => cb.value.toLowerCase());
  newKeywords.forEach(keyword => {
    if (!existingKeywords.includes(keyword.toLowerCase())) {
      const item = document.createElement('label');
      item.className = 'keyword-item';
      item.style.border = '2px solid var(--accent-primary)';
      item.innerHTML = `
        <input type="checkbox" value="${keyword}" checked onchange="updateKeywordSelection()">
        <span class="keyword-text">${keyword}</span>
      `;
      grid.appendChild(item);
      appData.keywords.push(keyword);
      existingKeywords.push(keyword.toLowerCase());
    }
  });
  document.getElementById('manual-keywords-input').value = '';
  document.getElementById('manual-entry-section').style.display = 'none';
  updateKeywordSelection();
};
function handleKeywordsError(error) {
  const statusDiv = document.getElementById('keyword-status');
  const cleanError = error.replace(/<[^>]*>/g, '').substring(0, 200);
  statusDiv.innerHTML = `
    <div style="color: var(--error);">
      <div style="margin-bottom: 8px;">⚠️ Google Trends is temporarily unavailable</div>
      <div style="color: var(--text-secondary); font-size: 12px;">
        ${cleanError}
      </div>
    </div>
  `;
  document.getElementById('confirm-keywords-btn').style.display = 'none';
  document.getElementById('retry-keywords-btn').style.display = 'block';
  document.getElementById('keyword-container').style.display = 'none';
  document.getElementById('manual-entry-section').style.display = 'none';
  let manualBtn = document.getElementById('manual-keywords-btn');
  if (!manualBtn) {
    manualBtn = document.createElement('button');
    manualBtn.id = 'manual-keywords-btn';
    manualBtn.className = 'btn-secondary';
    manualBtn.textContent = '✏️ Enter Keywords Manually';
    manualBtn.onclick = () => enableManualKeywordEntry();
    const container = document.querySelector('.screen-card');
    container.appendChild(manualBtn);
  }
  manualBtn.style.display = 'block';
}
window.selectAllKeywords = () => {
  document.querySelectorAll('.keyword-item input').forEach(cb => cb.checked = true);
  updateKeywordSelection();
};
window.deselectAllKeywords = () => {
  document.querySelectorAll('.keyword-item input').forEach(cb => cb.checked = false);
  updateKeywordSelection();
};
function updateKeywordSelection() {
  const selected = Array.from(document.querySelectorAll('.keyword-item input:checked'))
    .map(cb => cb.value);
  appData.selectedKeywords = selected;
  const btn = document.getElementById('confirm-keywords-btn');
  btn.disabled = selected.length === 0;
  if (selected.length > 0) {
    btn.style.background = 'var(--gradient-primary)';
  }
}
window.confirmKeywordSelection = () => {
  if (appData.selectedKeywords.length > 0) {
    loadScreen('batch-size');
  }
};
window.retryKeywordFetch = () => {
  loadScreen('keyword-select');
  sendToBackend({
    type: 'fetch-keywords',
    keywords: appData.baseKeywords
  });
};
function loadBatchSizeScreen() {
  loadBatchSizeSettings();
  const container = document.getElementById('screen-container');
  const isBoth = appData.scrapeMode === 'both';
  container.innerHTML = `
    <div class="screen">
      <div class="screen-card">
        <div class="screen-header">
          <button class="btn-back" onclick="goBackFromBatchSize()">← Back</button>
          <h2 class="screen-title">${isBoth ? 'Configure Batch Sizes' : `${appData.scrapeMode === 'keyword' ? 'Keyword' : 'DeepScan'} Batch Size`}</h2>
        </div>
        <div class="subtitle">
          Choose how many posts to process at once${isBoth ? ' for each mode' : ''}.<br>
          Higher values are faster but use more memory.
        </div>
        ${isBoth ? `
          <div class="batch-section">
            <h3 class="batch-label">Keyword Search Batch Size</h3>
            <div class="batch-options">
              ${[5, 10, 25, 50].map(size => `
                <button class="batch-option ${appData.keywordBatchSize === size ? 'selected' : ''}" 
                        onclick="selectKeywordBatchSize(${size}, event)">${size}</button>
              `).join('')}
            </div>
          </div>
          <div class="batch-section">
            <h3 class="batch-label">DeepScan Batch Size</h3>
            <div class="batch-options">
              ${[5, 10, 25, 50, 100].map(size => `
                <button class="batch-option ${appData.deepscanBatchSize === size ? 'selected' : ''}" 
                        onclick="selectDeepscanBatchSize(${size}, event)">${size}</button>
              `).join('')}
            </div>
          </div>
        ` : `
          <div class="batch-section">
            <div class="batch-options">
              ${(appData.scrapeMode === 'keyword' ? [5, 10, 25, 50] : [5, 10, 25, 50, 100]).map(size => `
                <button class="batch-option ${(appData.scrapeMode === 'keyword' ? appData.keywordBatchSize : appData.deepscanBatchSize) === size ? 'selected' : ''}" 
                        onclick="selectBatchSize(${size}, event)">${size}</button>
              `).join('')}
            </div>
          </div>
        `}
        <div class="batch-recommendations">
          <div class="recommendation-title">💡 Recommendations</div>
          <div class="recommendation-grid">
            <div class="recommendation-item">
              <span class="ram-label">4GB RAM:</span>
              <span>Keyword: 5, DeepScan: 5</span>
            </div>
            <div class="recommendation-item">
              <span class="ram-label">8GB RAM:</span>
              <span>Keyword: 10, DeepScan: 25</span>
            </div>
            <div class="recommendation-item">
              <span class="ram-label">16GB+ RAM:</span>
              <span>Keyword: 25, DeepScan: 50</span>
            </div>
          </div>
        </div>
        <button class="btn-primary" onclick="confirmBatchSize()">
          ✨ Continue
        </button>
      </div>
    </div>
  `;
}
function loadBatchSizeSettings() {
  const settingsPath = path.join(appData.dataFolder, 'batch_settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      appData.keywordBatchSize = settings.keywordBatchSize || 10;
      appData.deepscanBatchSize = settings.deepscanBatchSize || 25;
    } catch (e) {
      console.error('Failed to load batch settings:', e);
    }
  }
}
function saveBatchSizeSettings() {
  const settingsPath = path.join(appData.dataFolder, 'batch_settings.json');
  const settings = {
    keywordBatchSize: appData.keywordBatchSize,
    deepscanBatchSize: appData.deepscanBatchSize
  };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}
window.selectBatchSize = (size, event) => {
  if (appData.scrapeMode === 'keyword') {
    appData.keywordBatchSize = size;
  } else {
    appData.deepscanBatchSize = size;
  }
  document.querySelectorAll('.batch-option').forEach(btn => {
    btn.classList.remove('selected');
  });
  event.target.classList.add('selected');
};
window.selectKeywordBatchSize = (size, event) => {
  appData.keywordBatchSize = size;
  document.querySelectorAll('.batch-section:first-child .batch-option').forEach(btn => {
    btn.classList.remove('selected');
  });
  event.target.classList.add('selected');
};
window.selectDeepscanBatchSize = (size, event) => {
  appData.deepscanBatchSize = size;
  document.querySelectorAll('.batch-section:last-child .batch-option').forEach(btn => {
    btn.classList.remove('selected');
  });
  event.target.classList.add('selected');
};
window.confirmBatchSize = () => {
  saveBatchSizeSettings();
  loadScreen('confirmation');
};
window.goBackFromBatchSize = () => {
  if (appData.scrapeMode === 'keyword' || appData.scrapeMode === 'both') {
    loadScreen('keyword-select');
  } else {
    loadScreen('preset-select');
  }
};
function loadConfirmationScreen() {
  const container = document.getElementById('screen-container');
  const modeIcons = {once: '🔄', infinite: '♾️'};
  const scrapeIcons = {keyword: '🔍', deepscan: '🔬', both: '⚡'};
  let configSummary = [];
  configSummary.push(`Run Mode: ${modeIcons[appData.runMode]} ${appData.runMode === 'once' ? 'Run Once' : 'Run Continuously'}`);
  configSummary.push(`Scrape Mode: ${scrapeIcons[appData.scrapeMode]} ${appData.scrapeMode === 'both' ? 'Both Methods' : appData.scrapeMode === 'keyword' ? 'Keyword Search' : 'DeepScan'}`);
  configSummary.push(`Preset: ${appData.selectedPreset === 'default' ? '🏠 Default' : `📝 ${appData.selectedPreset.split('_')[1]}`}`);
  if (appData.scrapeMode === 'keyword' || appData.scrapeMode === 'both') {
    const keywordDisplay = appData.selectedKeywords.length <= 3 
      ? appData.selectedKeywords.join(', ')
      : `${appData.selectedKeywords.slice(0, 3).join(', ')} +${appData.selectedKeywords.length - 3} more`;
    configSummary.push(`Keywords: ${keywordDisplay}`);
  }
  if (appData.scrapeMode === 'both') {
    configSummary.push(`Keyword Batch: ${appData.keywordBatchSize}`);
    configSummary.push(`DeepScan Batch: ${appData.deepscanBatchSize}`);
  } else {
    configSummary.push(`Batch Size: ${appData.scrapeMode === 'keyword' ? appData.keywordBatchSize : appData.deepscanBatchSize}`);
  }
  container.innerHTML = `
    <div class="screen">
      <div class="screen-card">
        <div class="screen-header">
          <button class="btn-back" onclick="goBackFromConfirmation()">← Back</button>
          <h2 class="screen-title">Confirm Configuration</h2>
        </div>
        <div class="config-summary">
          ${configSummary.map(line => `
            <div class="config-line">${line}</div>
          `).join('')}
        </div>
        <button class="btn-secondary" onclick="reconfigureBatchSize()">
          ⚙️ Adjust Batch Size
        </button>
        <button class="btn-primary pulse" onclick="startScraping()">
          🚀 Start Scraping
        </button>
      </div>
    </div>
  `;
}
window.goBackFromConfirmation = () => {
  loadScreen('batch-size');
};
window.reconfigureBatchSize = () => {
  appData.cameFromConfirmation = true;
  loadScreen('batch-size');
};
window.startScraping = () => {
  console.log('Starting scraper with keywords:', appData.selectedKeywords);  // Add this debug line
  sendToBackend({
    type: 'start-scraping',
    config: {
      runMode: appData.runMode,
      scrapeMode: appData.scrapeMode,
      keywords: appData.selectedKeywords,
      keywordBatchSize: appData.keywordBatchSize,
      deepscanBatchSize: appData.deepscanBatchSize,
      broadSubreddits: appData.currentBroadSubreddits,
      concentratedSubreddits: appData.currentConcentratedSubreddits
    }
  });
  loadScreen('scraper-status');
};
function loadScraperStatusScreen() {
  const container = document.getElementById('screen-container');
  container.innerHTML = `
    <div class="screen scraper-screen">
      <div class="scraper-container">
        <div class="scraper-header">
          <h2 class="screen-title">SupaScrapeR Progress</h2>
          <div class="scraper-controls">
             <button class="btn-control pause" id="pause-btn" onclick="togglePause()">
              ⏸️ Pause
            </button>
            <button class="btn-control stop" onclick="stopScraping()">
              🛑 Stop
            </button>
          </div>
        </div>
        <div class="scraper-info" id="scraper-info">
          <div class="info-row">
            <span class="info-label">Mode:</span>
            <span class="info-value">${appData.runMode === 'infinite' ? 'Continuous' : 'Single Run'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Method:</span>
            <span class="info-value" id="current-method">Initializing...</span>
          </div>
          <div class="info-row">
            <span class="info-label">Subreddit:</span>
            <span class="info-value" id="current-subreddit">—</span>
          </div>
          <div class="info-row">
            <span class="info-label">Keyword:</span>
            <span class="info-value" id="current-keyword">—</span>
          </div>
          <div class="info-row">
            <span class="info-label">Batch Size:</span>
            <span class="info-value" id="current-batch-size">—</span>
          </div>
          <div class="info-row highlight">
            <span class="info-label">Est. Time:</span>
            <span class="info-value" id="estimated-time">Calculating...</span>
          </div>
        </div>
        <div class="log-container">
          <div class="log-header">
            <span>Activity Log</span>
            <div class="log-actions">
              <button class="log-action-btn" onclick="copyLog()" title="Copy to clipboard">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
                <span class="action-label">Copy</span>
              </button>
              <button class="log-action-btn" onclick="downloadLog()" title="Download as text file">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                <span class="action-label">Download</span>
              </button>
              <button class="log-action-btn" onclick="clearLog()" title="Clear log">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
                <span class="action-label">Clear</span>
              </button>
            </div>
          </div>
          <div class="log-output" id="log-output"></div>
        </div>
        <div class="progress-section">
          <div class="progress-item" id="keyword-progress" style="${appData.scrapeMode === 'deepscan' ? 'display: none;' : ''}">
            <div class="progress-label">Keywords Progress</div>
            <div class="progress-bar">
              <div class="progress-fill keyword" id="keyword-bar" style="width: 0%"></div>
              <span class="progress-text">0/0</span>
            </div>
          </div>
          <div class="progress-item">
            <div class="progress-label">Posts Progress</div>
            <div class="progress-bar">
              <div class="progress-fill posts" id="posts-bar" style="width: 0%"></div>
              <span class="progress-text">0/0</span>
            </div>
          </div>
          <div class="progress-item">
            <div class="progress-label">Subreddits Progress</div>
            <div class="progress-bar">
              <div class="progress-fill subreddits" id="subreddits-bar" style="width: 0%"></div>
              <span class="progress-text">0/0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('screen-container').style.maxWidth = 'none';
  startTimeTracking();
}
let startTime = null;
let postsProcessed = 0;
let totalPostsEstimate = 0;
let currentPostTotal = 0;
let currentKeywordIndex = 0;
let currentSubredditIndex = 0;
let totalKeywords = 0;
let totalSubreddits = 0;
function startTimeTracking() {
  startTime = Date.now();
  postsProcessed = 0;
  currentPostTotal = 0;
  currentKeywordIndex = 0;
  currentSubredditIndex = 0;
  if (appData.scrapeMode === 'keyword') {
    totalKeywords = appData.selectedKeywords.length;
    totalSubreddits = appData.currentBroadSubreddits.length;
    totalPostsEstimate = totalKeywords * totalSubreddits * 50;
  } else if (appData.scrapeMode === 'deepscan') {
    totalKeywords = 0;
    totalSubreddits = appData.currentConcentratedSubreddits.length;
    totalPostsEstimate = totalSubreddits * 100;
  } else {
    totalKeywords = appData.selectedKeywords.length;
    const broadSubs = appData.currentBroadSubreddits.length;
    const concentratedSubs = appData.currentConcentratedSubreddits.length;
    totalSubreddits = broadSubs + concentratedSubs;
    totalPostsEstimate = (totalKeywords * broadSubs * 50) + (concentratedSubs * 100);
  }
}
function updateTimeEstimate() {
  if (!startTime || postsProcessed === 0) {
    document.getElementById('estimated-time').textContent = 'Calculating...';
    return;
  }
  const elapsed = (Date.now() - startTime) / 1000;
  const rate = postsProcessed / elapsed;
  if (rate === 0 || !isFinite(rate)) {
    document.getElementById('estimated-time').textContent = 'Calculating...';
    return;
  }
  let postsRemaining = 0;
  if (appData.scrapeMode === 'keyword') {
    const keywordsRemaining = totalKeywords - currentKeywordIndex;
    const subredditsRemaining = totalSubreddits - currentSubredditIndex;
    postsRemaining = (keywordsRemaining * subredditsRemaining * 50) + (currentPostTotal - postsProcessed);
  } else if (appData.scrapeMode === 'deepscan') {
    const subredditsRemaining = totalSubreddits - currentSubredditIndex;
    postsRemaining = (subredditsRemaining * 100) + (currentPostTotal - postsProcessed);
  } else {
    const estimatedProgress = postsProcessed / totalPostsEstimate;
    postsRemaining = totalPostsEstimate - postsProcessed;
  }
  const remaining = Math.max(0, postsRemaining / rate);
  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);
  if (minutes > 120) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    document.getElementById('estimated-time').textContent = `~${hours}h ${mins}m remaining`;
  } else if (minutes > 0) {
    document.getElementById('estimated-time').textContent = `~${minutes}m ${seconds}s remaining`;
  } else {
    document.getElementById('estimated-time').textContent = `~${seconds}s remaining`;
  }
}
function updateScraperProgress(data) {
  if (data.type === 'keyword') {
    const bar = document.getElementById('keyword-bar');
    const progressItem = document.querySelector('#keyword-progress');
    const text = progressItem ? progressItem.querySelector('.progress-text') : null;
    if (bar && text && progressItem.style.display !== 'none') {
      currentKeywordIndex = data.current;
      totalKeywords = data.total;
      const progress = data.total > 0 ? (data.current / data.total) * 100 : 0;
      bar.style.width = `${Math.min(100, progress)}%`;
      text.textContent = `${data.current}/${data.total}`;
    }
  } else if (data.type === 'posts') {
    const bar = document.getElementById('posts-bar');
    const progressItem = bar ? bar.closest('.progress-item') : null;
    const text = progressItem ? progressItem.querySelector('.progress-text') : null;
    if (bar && text) {
      currentPostTotal = data.total;
      postsProcessed = data.current;
      const progress = data.total > 0 ? (data.current / data.total) * 100 : 0;
      bar.style.width = `${Math.min(100, progress)}%`;
      text.textContent = `${data.current}/${data.total}`;
      updateTimeEstimate();
    }
  } else if (data.type === 'subreddit') {
    const bar = document.getElementById('subreddits-bar');
    const progressItem = bar ? bar.closest('.progress-item') : null;
    const text = progressItem ? progressItem.querySelector('.progress-text') : null;
    if (bar && text) {
      currentSubredditIndex = data.current;
      totalSubreddits = data.total;
      const progress = data.total > 0 ? (data.current / data.total) * 100 : 0;
      bar.style.width = `${Math.min(100, progress)}%`;
      text.textContent = `${data.current}/${data.total}`;
    }
  } else if (data.type === 'info') {
    if (data.method) document.getElementById('current-method').textContent = data.method;
    if (data.subreddit) document.getElementById('current-subreddit').textContent = data.subreddit;
    if (data.keyword !== undefined) document.getElementById('current-keyword').textContent = data.keyword || '(none)';
    if (data.batchSize) document.getElementById('current-batch-size').textContent = data.batchSize;
  }
}
function appendToScraperLog(message) {
  if (!message || message.trim() === '') {
    return;
  }
  const log = document.getElementById('log-output');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = message;
  log.appendChild(entry);
  if (log.children.length > 1000) {
    log.removeChild(log.firstChild);
  }
  log.scrollTop = log.scrollHeight;
}
window.clearLog = () => {
  document.getElementById('log-output').innerHTML = '';
};
window.copyLog = () => {
  const log = document.getElementById('log-output');
  const entries = Array.from(log.querySelectorAll('.log-entry'));
  const text = entries.map(entry => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = entry.innerHTML;
    return tempDiv.textContent || tempDiv.innerText || '';
  }).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const copyBtn = document.querySelector('button[onclick="copyLog()"]');
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
};
window.downloadLog = () => {
  const log = document.getElementById('log-output');
  const entries = Array.from(log.querySelectorAll('.log-entry'));
  const text = entries.map(entry => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = entry.innerHTML;
    return tempDiv.textContent || tempDiv.innerText || '';
  }).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  a.download = `supascraper-log-${timestamp}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  const downloadBtn = document.querySelector('button[onclick="downloadLog()"]');
  const originalHTML = downloadBtn.innerHTML;
  downloadBtn.innerHTML = downloadBtn.innerHTML.replace('Download', 'Downloaded!');
  setTimeout(() => {
    downloadBtn.innerHTML = originalHTML;
  }, 2000);
};
window.togglePause = () => {
  const btn = document.getElementById('pause-btn');
  const isPaused = btn.textContent.includes('Resume');
  sendToBackend({ type: isPaused ? 'resume-scraping' : 'pause-scraping' });
  btn.textContent = isPaused ? '⏸️ Pause' : '▶️ Resume';
};
window.stopScraping = () => {
  if (confirm('Are you sure you want to stop scraping?')) {
    sendToBackend({ type: 'stop-scraping' });
    const stopBtn = document.querySelector('.btn-control.stop');
    stopBtn.textContent = '⏹ Stopping...';
    stopBtn.disabled = true;
    document.getElementById('screen-container').style.maxWidth = '';
  }
  if (document.getElementById('screen-container')) {
  document.getElementById('screen-container').style.maxWidth = '';
  }
};
function loadSettingsScreen() {
  const type = appData.currentSettingsType;
  const container = document.getElementById('screen-container');
  const isBoth = type === 'both';
  let currentBroadSubs = [];
  let currentConcentratedSubs = [];
  if (type === 'keyword') {
    currentBroadSubs = appData.currentBroadSubreddits.length > 0 
      ? appData.currentBroadSubreddits 
      : getDefaultBroadSubreddits();
  } else if (type === 'deepscan') {
    currentConcentratedSubs = appData.currentConcentratedSubreddits.length > 0
      ? appData.currentConcentratedSubreddits
      : getDefaultConcentratedSubreddits();
  } else {
    currentBroadSubs = appData.currentBroadSubreddits.length > 0
      ? appData.currentBroadSubreddits
      : getDefaultBroadSubreddits();
    currentConcentratedSubs = appData.currentConcentratedSubreddits.length > 0
      ? appData.currentConcentratedSubreddits
      : getDefaultConcentratedSubreddits();
  }
  container.innerHTML = `
    <div class="screen">
      <div class="screen-card large">
        <div class="screen-header">
          <button class="btn-back" onclick="goBackToScrapeMode()">← Back</button>
          <h2 class="screen-title">${type === 'keyword' ? 'Keyword Search' : type === 'deepscan' ? 'DeepScan' : 'Combined'} Settings</h2>
        </div>
        <div class="subtitle">
          ${type === 'keyword' ? 'Configure subreddits for keyword-based searches' :
            type === 'deepscan' ? 'Configure subreddits for deep scanning' :
            'Configure subreddits for both keyword search and deep scanning'}
        </div>
        ${isBoth ? `
          <div class="settings-section">
            <label class="form-label">Keyword Search Subreddits</label>
            <textarea class="input-field textarea-field" id="broad-subreddits" 
                      placeholder="Enter subreddits separated by commas"
                      rows="3">${currentBroadSubs.join(', ')}</textarea>
          </div>
          <div class="settings-section">
            <label class="form-label">DeepScan Subreddits</label>
            <textarea class="input-field textarea-field" id="concentrated-subreddits"
                      placeholder="Enter subreddits separated by commas"
                      rows="3">${currentConcentratedSubs.join(', ')}</textarea>
          </div>
        ` : `
          <div class="settings-section">
            <label class="form-label">Subreddits (exclude r/ prefix)</label>
            <textarea class="input-field textarea-field" id="subreddit-input"
                      placeholder="Enter subreddits separated by commas"
                      rows="4">${type === 'keyword' ? currentBroadSubs.join(', ') : currentConcentratedSubs.join(', ')}</textarea>
          </div>
        `}
        <div class="preset-section">
          <div class="section-header">
            <h3 class="section-title">Save to Preset</h3>
          </div>
          <div class="preset-buttons">
            ${[1, 2, 3, 4, 5].map(num => {
              const hasData = checkPresetHasData(type, num);
              return `
                <button class="preset-btn ${appData.selectedPresetNum === num ? 'selected' : ''}"
                  onclick="selectPresetNumber(${num}, event)">
                <span class="preset-number">${num}</span>
                ${hasData ? '<span class="preset-indicator">●</span>' : ''}
                </button>
              `;
            }).join('')}
          </div>
          <div class="preset-status" id="preset-status"></div>
        </div>
        <button class="btn-primary" id="save-preset-btn" disabled onclick="savePresetSettings()">
          💾 Save to Preset
        </button>
        <button class="btn-secondary" onclick="goBackToScrapeMode()">
          Cancel
        </button>
      </div>
    </div>
  `;
}
window.selectPresetNumber = (num, event) => {
  appData.selectedPresetNum = num;
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  event.target.closest('.preset-btn').classList.add('selected');
  const btn = document.getElementById('save-preset-btn');
  btn.disabled = false;
  btn.style.background = 'var(--gradient-primary)';
  const presetData = loadPresetData(appData.currentSettingsType, num);
  const statusDiv = document.getElementById('preset-status');
  if (appData.currentSettingsType === 'both') {
    const broadInput = document.getElementById('broad-subreddits');
    const concentratedInput = document.getElementById('concentrated-subreddits');
    if (presetData.broad && presetData.broad.length > 0) {
      broadInput.value = presetData.broad.join(', ');
    }
    if (presetData.concentrated && presetData.concentrated.length > 0) {
      concentratedInput.value = presetData.concentrated.join(', ');
    }
    if ((presetData.broad && presetData.broad.length > 0) || 
        (presetData.concentrated && presetData.concentrated.length > 0)) {
      statusDiv.textContent = `⚠️ Preset ${num} has saved data. Saving will overwrite it.`;
      statusDiv.className = 'preset-status warning';
    } else {
      statusDiv.textContent = `✨ Preset ${num} is empty. Ready to save new data.`;
      statusDiv.className = 'preset-status success';
    }
  } else {
    const input = document.getElementById('subreddit-input');
    if (presetData && presetData.length > 0) {
      input.value = presetData.join(', ');
      statusDiv.textContent = `⚠️ Preset ${num} has saved data. Saving will overwrite it.`;
      statusDiv.className = 'preset-status warning';
    } else {
      statusDiv.textContent = `✨ Preset ${num} is empty. Ready to save new data.`;
      statusDiv.className = 'preset-status success';
    }
  }
};
window.savePresetSettings = () => {
  if (!appData.selectedPresetNum) {
    showSettingsError('Please select a preset first');
    return;
  }
  const type = appData.currentSettingsType;
  let dataToSave = {};
  if (type === 'both') {
    const broadText = document.getElementById('broad-subreddits').value.trim();
    const concentratedText = document.getElementById('concentrated-subreddits').value.trim();
    if (!broadText && !concentratedText) {
      showSettingsError('Please enter subreddits in at least one section');
      return;
    }
    const broadSubs = broadText ? broadText.split(',').map(s => s.trim()).filter(s => s) : [];
    const concentratedSubs = concentratedText ? concentratedText.split(',').map(s => s.trim()).filter(s => s) : [];
    for (let sub of [...broadSubs, ...concentratedSubs]) {
      if (!/^[a-zA-Z0-9_\-]+$/.test(sub)) {
        showSettingsError(`Invalid subreddit name: ${sub}`);
        return;
      }
    }
    dataToSave = { broad: broadSubs, concentrated: concentratedSubs };
  } else {
    const text = document.getElementById('subreddit-input').value.trim();
    if (!text) {
      showSettingsError('Please enter at least one subreddit');
      return;
    }
    const subs = text.split(',').map(s => s.trim()).filter(s => s);
    for (let sub of subs) {
      if (!/^[a-zA-Z0-9_\-]+$/.test(sub)) {
        showSettingsError(`Invalid subreddit name: ${sub}`);
        return;
      }
    }
    dataToSave = subs;
  }
  savePresetData(type, appData.selectedPresetNum, dataToSave);
  const statusDiv = document.getElementById('preset-status');
  statusDiv.textContent = `✅ Preset ${appData.selectedPresetNum} saved successfully!`;
  statusDiv.className = 'preset-status success';
  setTimeout(() => {
    loadScreen('scrape-mode');
  }, 1500);
};
function showSettingsError(message) {
  const statusDiv = document.getElementById('preset-status');
  statusDiv.textContent = `❌ ${message}`;
  statusDiv.className = 'preset-status error';
}
function checkPresetHasData(type, num) {
  const data = loadPresetData(type, num);
  if (type === 'both') {
    return (data.broad && data.broad.length > 0) || (data.concentrated && data.concentrated.length > 0);
  }
  return data && data.length > 0;
}
function loadPresetData(type, num) {
  const presetsPath = path.join(appData.dataFolder, 'user_presets.json');
  if (!fs.existsSync(presetsPath)) return type === 'both' ? {broad: [], concentrated: []} : [];
  try {
    const presets = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
    if (type === 'both') {
      return {
        broad: presets.both_broad_presets?.[num] || [],
        concentrated: presets.both_concentrated_presets?.[num] || []
      };
    } else if (type === 'keyword') {
      return presets.broad_presets?.[num] || [];
    } else {
      return presets.concentrated_presets?.[num] || [];
    }
  } catch (e) {
    return type === 'both' ? {broad: [], concentrated: []} : [];
  }
}
function savePresetData(type, num, data) {
  const presetsPath = path.join(appData.dataFolder, 'user_presets.json');
  let presets = {};
  if (fs.existsSync(presetsPath)) {
    try {
      presets = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
    } catch (e) {}
  }
  if (!presets.broad_presets) presets.broad_presets = {};
  if (!presets.concentrated_presets) presets.concentrated_presets = {};
  if (!presets.both_broad_presets) presets.both_broad_presets = {};
  if (!presets.both_concentrated_presets) presets.both_concentrated_presets = {};
  if (type === 'both') {
    presets.both_broad_presets[num] = data.broad || [];
    presets.both_concentrated_presets[num] = data.concentrated || [];
  } else if (type === 'keyword') {
    presets.broad_presets[num] = data;
  } else {
    presets.concentrated_presets[num] = data;
  }
  fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2));
}
function getDefaultBroadSubreddits() {
  return ["AskReddit", "news", "worldnews", "technology", "science",
          "todayilearned", "explainlikeimfive", "OutOfTheLoop", "NoStupidQuestions",
          "books", "television", "movies", "gaming", "sports", "nba", "soccer", "nfl",
          "food", "cooking", "DIY", "personalfinance", "investing", "cryptocurrency",
          "fitness", "health", "relationships", "travel", "photography", "art",
          "music", "videos", "funny", "pics", "gifs", "interestingasfuck",
          "mildlyinteresting", "dataisbeautiful", "space", "Futurology", "history"];
}
function getDefaultConcentratedSubreddits() {
  return ["AskReddit", "news", "worldnews", "technology", "science",
          "todayilearned", "explainlikeimfive", "IAmA", "bestof",
          "changemyview", "unpopularopinion", "TrueOffMyChest",
          "AmItheAsshole", "tifu", "LifeProTips"];
}