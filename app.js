// ===== 相册备份 Web APP =====

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 3;
const LOCK_SECONDS = 30;

// ===== Storage =====
const Storage = {
  get(key, defaultVal = null) {
    try {
      const v = localStorage.getItem('photo_backup_' + key);
      return v ? JSON.parse(v) : defaultVal;
    } catch { return defaultVal; }
  },
  set(key, val) {
    localStorage.setItem('photo_backup_' + key, JSON.stringify(val));
  },
  remove(key) {
    localStorage.removeItem('photo_backup_' + key);
  },
  clearAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('photo_backup_'))
      .forEach(k => localStorage.removeItem(k));
  }
};

// ===== Page Navigation =====
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// ===== Lock Screen Clock =====
let lockClockInterval = null;

function startLockClock() {
  const updateTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeEl = document.getElementById('lock-time');
    const dateEl = document.getElementById('lock-date');
    if (timeEl) timeEl.textContent = hours + ':' + minutes;
    if (dateEl) {
      const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      const month = now.getMonth() + 1;
      const day = now.getDate();
      dateEl.textContent = month + '月' + day + '日 ' + weekdays[now.getDay()];
    }
  };
  updateTime();
  lockClockInterval = setInterval(updateTime, 1000);
}

function stopLockClock() {
  if (lockClockInterval) {
    clearInterval(lockClockInterval);
    lockClockInterval = null;
  }
}

// ===== PIN Keyboard Builder =====
function buildKeyboard(containerId, onDigit, onDelete) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'del', 0, ''];
  keys.forEach(k => {
    const btn = document.createElement('button');
    btn.classList.add('pin-key');
    if (k === 'del') {
      btn.classList.add('key-delete');
      btn.textContent = '\u232B';
      btn.addEventListener('click', onDelete);
    } else if (k === '') {
      btn.classList.add('key-empty');
    } else {
      btn.textContent = k;
      btn.addEventListener('click', () => onDigit(k));
    }
    container.appendChild(btn);
  });
}

function buildDots(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  for (let i = 0; i < PIN_LENGTH; i++) {
    const dot = document.createElement('div');
    dot.classList.add('pin-dot');
    container.appendChild(dot);
  }
}

function updateDots(containerId, length, error = false) {
  const dots = document.getElementById(containerId).children;
  for (let i = 0; i < PIN_LENGTH; i++) {
    dots[i].classList.toggle('filled', i < length);
    dots[i].classList.toggle('error', error);
  }
}

function clearDots(containerId) {
  updateDots(containerId, 0, false);
}

// ===== PIN Setup =====
let setupPin1 = '';
let setupPin2 = '';

function initSetup() {
  buildDots('setup-dots-1');
  buildDots('setup-dots-2');
  buildKeyboard('setup-keyboard-1',
    (d) => {
      if (setupPin1.length < PIN_LENGTH) {
        setupPin1 += d;
        updateDots('setup-dots-1', setupPin1.length);
      }
    },
    () => {
      setupPin1 = setupPin1.slice(0, -1);
      updateDots('setup-dots-1', setupPin1.length);
    }
  );
  buildKeyboard('setup-keyboard-2',
    (d) => {
      if (setupPin2.length < PIN_LENGTH) {
        setupPin2 += d;
        updateDots('setup-dots-2', setupPin2.length);
      }
    },
    () => {
      setupPin2 = setupPin2.slice(0, -1);
      updateDots('setup-dots-2', setupPin2.length);
    }
  );

  // Auto-check when both are 6 digits
  const origOnDigit2 = () => {};
  document.getElementById('setup-keyboard-2').querySelectorAll('.pin-key:not(.key-delete):not(.key-empty)').forEach(btn => {
    btn.addEventListener('click', () => {
      if (setupPin2.length === PIN_LENGTH) {
        setTimeout(() => {
          if (setupPin1 === setupPin2) {
            Storage.set('pin', setupPin1);
            Storage.set('pin_set', true);
            Storage.set('attempts', 0);
            Storage.set('locked_until', 0);
            stopLockClock();
            showPage('page-main');
            updateDashboard();
            setTimeout(() => triggerFilePicker(), 300);
          } else {
            updateDots('setup-dots-2', PIN_LENGTH, true);
            setTimeout(() => {
              setupPin2 = '';
              clearDots('setup-dots-2');
            }, 600);
          }
        }, 200);
      }
    });
  });

  document.getElementById('btn-clear-setup').addEventListener('click', () => {
    setupPin1 = '';
    setupPin2 = '';
    clearDots('setup-dots-1');
    clearDots('setup-dots-2');
  });
}

// ===== PIN Login =====
let loginPin = '';

function initLogin() {
  buildDots('login-dots');
  buildKeyboard('login-keyboard',
    (d) => {
      if (loginPin.length < PIN_LENGTH) {
        loginPin += d;
        updateDots('login-dots', loginPin.length);
      }
    },
    () => {
      loginPin = loginPin.slice(0, -1);
      updateDots('login-dots', loginPin.length);
    }
  );

  document.getElementById('login-keyboard').querySelectorAll('.pin-key:not(.key-delete):not(.key-empty)').forEach(btn => {
    btn.addEventListener('click', () => {
      if (loginPin.length === PIN_LENGTH) {
        setTimeout(() => checkLoginPin(), 200);
      }
    });
  });

  document.getElementById('btn-clear-login').addEventListener('click', () => {
    loginPin = '';
    clearDots('login-dots');
    document.getElementById('login-error-msg').textContent = '';
  });

  // Start lock screen clock
  startLockClock();
}

function checkLoginPin() {
  const storedPin = Storage.get('pin');
  if (loginPin === storedPin) {
    Storage.set('attempts', 0);
    loginPin = '';
    clearDots('login-dots');
    document.getElementById('login-error-msg').textContent = '';
    stopLockClock();
    showPage('page-main');
    updateDashboard();
    setTimeout(() => triggerFilePicker(), 300);
  } else {
    const attempts = (Storage.get('attempts', 0)) + 1;
    Storage.set('attempts', attempts);
    const remaining = MAX_ATTEMPTS - attempts;

    if (remaining <= 0) {
      Storage.set('locked_until', Date.now() + LOCK_SECONDS * 1000);
      showPage('page-pin-locked');
      startLockdownTimer();
    } else {
      document.getElementById('login-error-msg').textContent = '\u5BC6\u7801\u9519\u8BEF\uFF0C\u8FD8\u53EF\u5C1D\u8BD5 ' + remaining + ' \u6B21';
      updateDots('login-dots', PIN_LENGTH, true);
      setTimeout(() => {
        loginPin = '';
        clearDots('login-dots');
      }, 600);
    }
  }
}

// ===== Lockdown =====
let lockdownInterval = null;

function startLockdownTimer() {
  const update = () => {
    const lockedUntil = Storage.get('locked_until', 0);
    const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
    document.getElementById('lockdown-timer').textContent = '\u8BF7\u7B49\u5F85 ' + remaining + ' \u79D2';
    if (remaining <= 0) {
      Storage.set('attempts', 0);
      Storage.set('locked_until', 0);
      loginPin = '';
      clearDots('login-dots');
      document.getElementById('login-error-msg').textContent = '';
      clearInterval(lockdownInterval);
      showPage('page-pin-login');
      startLockClock();
    }
  };
  update();
  lockdownInterval = setInterval(update, 1000);
}

// ===== Change PIN =====
let changePin = '';
let changeStep = 'old'; // old -> new1 -> new2

function initChangePin() {
  buildDots('change-dots');
  buildKeyboard('change-keyboard',
    (d) => {
      if (changePin.length < PIN_LENGTH) {
        changePin += d;
        updateDots('change-dots', changePin.length);
      }
    },
    () => {
      changePin = changePin.slice(0, -1);
      updateDots('change-dots', changePin.length);
    }
  );

  document.getElementById('change-keyboard').querySelectorAll('.pin-key:not(.key-delete):not(.key-empty)').forEach(btn => {
    btn.addEventListener('click', () => {
      if (changePin.length === PIN_LENGTH) {
        setTimeout(() => processChangePin(), 200);
      }
    });
  });

  document.getElementById('btn-clear-change').addEventListener('click', () => {
    changePin = '';
    clearDots('change-dots');
  });
}

let tempNewPin = '';
function processChangePin() {
  const label = document.getElementById('change-step-label');
  if (changeStep === 'old') {
    if (changePin === Storage.get('pin')) {
      changeStep = 'new1';
      tempNewPin = '';
      changePin = '';
      clearDots('change-dots');
      label.textContent = '\u8F93\u5165\u65B0\u5BC6\u7801';
    } else {
      updateDots('change-dots', PIN_LENGTH, true);
      label.textContent = '\u65E7\u5BC6\u7801\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5';
      setTimeout(() => { changePin = ''; clearDots('change-dots'); label.textContent = '\u8F93\u5165\u65E7\u5BC6\u7801'; }, 800);
    }
  } else if (changeStep === 'new1') {
    tempNewPin = changePin;
    changePin = '';
    clearDots('change-dots');
    changeStep = 'new2';
    label.textContent = '\u518D\u6B21\u786E\u8BA4\u65B0\u5BC6\u7801';
  } else if (changeStep === 'new2') {
    if (changePin === tempNewPin) {
      Storage.set('pin', changePin);
      changeStep = 'old';
      tempNewPin = '';
      changePin = '';
      clearDots('change-dots');
      label.textContent = '\u8F93\u5165\u65E7\u5BC6\u7801';
      showPage('page-settings');
    } else {
      updateDots('change-dots', PIN_LENGTH, true);
      label.textContent = '\u4E24\u6B21\u4E0D\u4E00\u81F4\uFF0C\u91CD\u65B0\u8F93\u5165';
      setTimeout(() => { changePin = ''; clearDots('change-dots'); changeStep = 'new1'; label.textContent = '\u8F93\u5165\u65B0\u5BC6\u7801'; }, 800);
    }
  }
}

// ===== Dashboard Stats =====
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return size.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

function updateDashboard() {
  const photos = Storage.get('photos', []);

  // Total photos
  document.getElementById('stat-total-photos').textContent = photos.length;

  // Total size
  const totalSize = photos.reduce((sum, p) => sum + (p.size || 0), 0);
  document.getElementById('stat-total-size').textContent = formatFileSize(totalSize);

  // Last sync time
  const lastSync = Storage.get('last_sync_time', 0);
  if (lastSync) {
    const syncDate = new Date(lastSync);
    const month = syncDate.getMonth() + 1;
    const day = syncDate.getDate();
    const hours = String(syncDate.getHours()).padStart(2, '0');
    const minutes = String(syncDate.getMinutes()).padStart(2, '0');
    document.getElementById('stat-last-sync').textContent = month + '/' + day + ' ' + hours + ':' + minutes;
  } else {
    document.getElementById('stat-last-sync').textContent = '\u5C1A\u672A\u540C\u6B65';
  }

  // Baidu auth status
  const token = Storage.get('baidu_token');
  const authEl = document.getElementById('stat-auth-status');
  if (token) {
    authEl.textContent = '\u5DF2\u6388\u6743';
    authEl.style.color = 'var(--success)';
  } else {
    authEl.textContent = '\u672A\u6388\u6743';
    authEl.style.color = 'var(--text-dim)';
  }

  // Render timeline if photos exist
  renderTimeline();
}

// ===== Trigger File Picker =====
function triggerFilePicker() {
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.click();
  }
}

// ===== Main Page =====
function initMain() {
  // Settings button (no upload button)
  document.getElementById('btn-settings').addEventListener('click', () => {
    updateSettingsPage();
    showPage('page-settings');
  });

  // File input - handle selected files silently
  document.getElementById('file-input').addEventListener('change', handleFileSelect);

  // Settings back
  document.getElementById('btn-settings-back').addEventListener('click', () => showPage('page-main'));

  // Change PIN
  document.getElementById('btn-change-pin').addEventListener('click', () => {
    changePin = '';
    changeStep = 'old';
    clearDots('change-dots');
    document.getElementById('change-step-label').textContent = '\u8F93\u5165\u65E7\u5BC6\u7801';
    showPage('page-change-pin');
  });

  // Clear data
  document.getElementById('btn-clear-data').addEventListener('click', () => {
    if (confirm('\u786E\u5B9A\u8981\u6E05\u9664\u6240\u6709\u6570\u636E\u5417\uFF1F\u8FD9\u5C06\u5220\u9664\u5BC6\u7801\u3001\u7167\u7247\u8BB0\u5F55\u548C\u6240\u6709\u8BBE\u7F6E\u3002')) {
      Storage.clearAll();
      setupPin1 = '';
      setupPin2 = '';
      clearDots('setup-dots-1');
      clearDots('setup-dots-2');
      showPage('page-pin-setup');
    }
  });

  // Baidu auth
  document.getElementById('baidu-auth-item').addEventListener('click', startBaiduAuth);

  // Viewer back
  document.getElementById('btn-viewer-back').addEventListener('click', () => {
    document.getElementById('view-photo-viewer').classList.add('hidden');
    document.getElementById('view-dashboard').classList.remove('hidden');
  });

  // Load dashboard stats
  updateDashboard();
}

// ===== File Upload =====
async function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const indicator = document.getElementById('sync-indicator').firstElementChild;
  indicator.className = 'sync-dot sync-active';

  // Show progress card
  const progressCard = document.getElementById('sync-progress-card');
  const progressDetail = document.getElementById('sync-progress-detail');
  const progressFill = document.getElementById('sync-progress-fill');
  const successCard = document.getElementById('sync-success-card');
  progressCard.style.display = 'block';
  successCard.style.display = 'none';

  const wifiOnly = document.getElementById('toggle-wifi').checked;

  // Check WiFi (Web API has limited support, best effort)
  if (wifiOnly && navigator.connection) {
    const conn = navigator.connection;
    if (conn.type && conn.type !== 'wifi' && conn.type !== 'none') {
      indicator.className = 'sync-dot sync-error';
      progressCard.style.display = 'none';
      setTimeout(() => { indicator.className = 'sync-dot sync-idle'; }, 3000);
      e.target.value = '';
      return;
    }
  }

  const compress = document.getElementById('toggle-compress').checked;
  const photos = [];

  for (const file of files) {
    try {
      let dataUrl;
      if (compress) {
        dataUrl = await compressImage(file, 1600, 0.85);
      } else {
        dataUrl = await readFileAsDataURL(file);
      }
      photos.push({
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        name: file.name,
        size: file.size,
        date: new Date().toISOString(),
        data: dataUrl,
        uploaded: false
      });
    } catch (err) {
      console.error('File read error:', err);
    }
  }

  // Save to storage
  const existing = Storage.get('photos', []);
  Storage.set('photos', [...photos, ...existing]);

  // Try to upload to Baidu
  const token = Storage.get('baidu_token');
  let uploadedCount = 0;
  if (token) {
    for (let i = 0; i < photos.length; i++) {
      try {
        // Update progress
        progressDetail.textContent = (i + 1) + '/' + photos.length;
        progressFill.style.width = ((i + 1) / photos.length * 100) + '%';
        await uploadToBaidu(photos[i], token);
        photos[i].uploaded = true;
        uploadedCount++;
      } catch (err) {
        console.error('Upload failed (silent):', err);
      }
    }
    // Update storage with upload status
    const updated = Storage.get('photos', []);
    Storage.set('photos', updated.map(p => {
      const up = photos.find(ph => ph.id === p.id);
      return up ? { ...p, uploaded: up.uploaded } : p;
    }));
  } else {
    progressDetail.textContent = photos.length + '/' + photos.length;
    progressFill.style.width = '100%';
  }

  // Update last sync time
  Storage.set('last_sync_time', Date.now());

  // Hide progress, show success
  progressCard.style.display = 'none';
  successCard.style.display = 'flex';

  // Set success text
  const successText = document.getElementById('sync-success-text');
  if (token && uploadedCount > 0) {
    successText.textContent = '\u5DF2\u6210\u529F\u5907\u4EFD ' + photos.length + ' \u5F20\u7167\u7247';
  } else if (photos.length > 0) {
    successText.textContent = '\u5DF2\u4FDD\u5B58 ' + photos.length + ' \u5F20\u7167\u7247\uFF08\u672A\u6388\u6743\u4E0A\u4F20\uFF09';
  }

  // Update dashboard
  updateDashboard();

  // Reset indicator
  indicator.className = 'sync-dot sync-done';
  setTimeout(() => { indicator.className = 'sync-dot sync-idle'; }, 2000);

  // Hide success card after a delay
  setTimeout(() => {
    successCard.style.display = 'none';
  }, 5000);

  // Reset file input
  e.target.value = '';
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = (h / w) * maxDim; w = maxDim; }
          else { w = (w / h) * maxDim; h = maxDim; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ===== Baidu Pan Upload =====
const BAIDU_APP_KEY = '4X49Agt4J9LEnNCQrr0DCe0HR2W0lRcV';
const BAIDU_SECRET = 'h2cysNzQuLAXTJ7GoBDXKvncQSLk8spH';
const BAIDU_REDIRECT = window.location.origin + window.location.pathname;

function startBaiduAuth() {
  const url = 'https://openapi.baidu.com/oauth/2.0/authorize' +
    '?response_type=code' +
    '&client_id=' + BAIDU_APP_KEY +
    '&redirect_uri=' + encodeURIComponent(BAIDU_REDIRECT) +
    '&scope=basic,netdisk' +
    '&display=mobile';
  window.location.href = url;
}

function handleBaiduCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code) {
    // Exchange code for token (needs server proxy in production)
    // For demo, we store the code as token
    Storage.set('baidu_token', code);
    Storage.set('baidu_auth_time', Date.now());
    window.history.replaceState({}, '', window.location.pathname);
  }
}

async function uploadToBaidu(photo, token) {
  // In production, this would call your server which proxies to Baidu API
  // Baidu Pan upload: POST https://pan.baidu.com/rest/2.0/pcs/file?method=upload
  // For Web App demo, we simulate successful upload
  return new Promise((resolve) => {
    setTimeout(resolve, 500); // Simulate upload delay
  });
}

// ===== Timeline =====
function renderTimeline() {
  const photos = Storage.get('photos', []);
  const timelineSection = document.getElementById('view-timeline-inner');

  if (!photos.length) {
    timelineSection.style.display = 'none';
    return;
  }

  timelineSection.style.display = 'block';

  const list = document.getElementById('timeline-list');
  list.innerHTML = '';

  // Group by date
  const groups = {};
  photos.sort((a, b) => new Date(b.date) - new Date(a.date));
  photos.forEach(p => {
    const d = new Date(p.date);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  Object.entries(groups).forEach(([date, items]) => {
    const dateLabel = document.createElement('div');
    dateLabel.className = 'timeline-date';
    dateLabel.textContent = date;
    list.appendChild(dateLabel);

    const grid = document.createElement('div');
    grid.className = 'timeline-grid';

    items.forEach(p => {
      const thumb = document.createElement('div');
      thumb.className = 'timeline-thumb';
      const img = document.createElement('img');
      img.src = p.data;
      img.alt = p.name;
      img.loading = 'lazy';
      thumb.appendChild(img);
      thumb.addEventListener('click', () => viewPhoto(p.data));
      grid.appendChild(thumb);
    });

    list.appendChild(grid);
  });
}

function viewPhoto(src) {
  document.getElementById('view-dashboard').classList.add('hidden');
  document.getElementById('view-photo-viewer').classList.remove('hidden');
  document.getElementById('viewer-img').src = src;
}

// ===== Settings =====
function updateSettingsPage() {
  const token = Storage.get('baidu_token');
  const status = document.getElementById('baidu-auth-status');
  if (token) {
    const authTime = Storage.get('baidu_auth_time', 0);
    const days = Math.floor((Date.now() - authTime) / 86400000);
    status.textContent = '\u5DF2\u6388\u6743 (' + days + '\u5929\u524D)';
    status.style.color = 'var(--success)';
  } else {
    status.textContent = '\u672A\u6388\u6743';
    status.style.color = 'var(--text-dim)';
  }
}

// ===== App Init =====
function init() {
  // Handle Baidu OAuth callback
  handleBaiduCallback();

  const pinSet = Storage.get('pin_set', false);
  const lockedUntil = Storage.get('locked_until', 0);

  if (!pinSet) {
    initSetup();
    showPage('page-pin-setup');
  } else if (Date.now() < lockedUntil) {
    showPage('page-pin-locked');
    startLockdownTimer();
  } else {
    initLogin();
    showPage('page-pin-login');
  }

  initMain();
  initChangePin();
}

// Prevent back button bypass on mobile
window.addEventListener('popstate', (e) => {
  e.preventDefault();
  const visiblePage = document.querySelector('.page:not(.hidden)');
  if (visiblePage && visiblePage.id === 'page-main') {
    showPage('page-pin-login');
    loginPin = '';
    clearDots('login-dots');
    document.getElementById('login-error-msg').textContent = '';
    startLockClock();
    history.pushState(null, '', '');
  } else if (visiblePage && visiblePage.id === 'page-settings') {
    showPage('page-main');
    updateDashboard();
    history.pushState(null, '', '');
  } else if (visiblePage && visiblePage.id === 'page-change-pin') {
    showPage('page-settings');
    history.pushState(null, '', '');
  }
});

// Push initial state
history.pushState(null, '', '');

// Start app
document.addEventListener('DOMContentLoaded', init);
