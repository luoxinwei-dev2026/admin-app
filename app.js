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
      btn.textContent = '⌫';
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

  // Auto-check when both are 8 digits
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
            showPage('page-main');
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
}

function checkLoginPin() {
  const storedPin = Storage.get('pin');
  if (loginPin === storedPin) {
    Storage.set('attempts', 0);
    loginPin = '';
    clearDots('login-dots');
    document.getElementById('login-error-msg').textContent = '';
    showPage('page-main');
  } else {
    const attempts = (Storage.get('attempts', 0)) + 1;
    Storage.set('attempts', attempts);
    const remaining = MAX_ATTEMPTS - attempts;

    if (remaining <= 0) {
      Storage.set('locked_until', Date.now() + LOCK_SECONDS * 1000);
      showPage('page-pin-locked');
      startLockdownTimer();
    } else {
      document.getElementById('login-error-msg').textContent = `密码错误，还可尝试 ${remaining} 次`;
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
    document.getElementById('lockdown-timer').textContent = `请等待 ${remaining} 秒`;
    if (remaining <= 0) {
      Storage.set('attempts', 0);
      Storage.set('locked_until', 0);
      loginPin = '';
      clearDots('login-dots');
      document.getElementById('login-error-msg').textContent = '';
      clearInterval(lockdownInterval);
      showPage('page-pin-login');
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
      label.textContent = '输入新密码';
    } else {
      updateDots('change-dots', PIN_LENGTH, true);
      label.textContent = '旧密码错误，请重试';
      setTimeout(() => { changePin = ''; clearDots('change-dots'); label.textContent = '输入旧密码'; }, 800);
    }
  } else if (changeStep === 'new1') {
    tempNewPin = changePin;
    changePin = '';
    clearDots('change-dots');
    changeStep = 'new2';
    label.textContent = '再次确认新密码';
  } else if (changeStep === 'new2') {
    if (changePin === tempNewPin) {
      Storage.set('pin', changePin);
      changeStep = 'old';
      tempNewPin = '';
      changePin = '';
      clearDots('change-dots');
      label.textContent = '输入旧密码';
      showPage('page-settings');
    } else {
      updateDots('change-dots', PIN_LENGTH, true);
      label.textContent = '两次不一致，重新输入';
      setTimeout(() => { changePin = ''; clearDots('change-dots'); changeStep = 'new1'; label.textContent = '输入新密码'; }, 800);
    }
  }
}

// ===== Main Page =====
function initMain() {
  // Upload button
  document.getElementById('btn-upload').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  // Settings button
  document.getElementById('btn-settings').addEventListener('click', () => {
    updateSettingsPage();
    showPage('page-settings');
  });

  // File input
  document.getElementById('file-input').addEventListener('change', handleFileSelect);

  // Settings back
  document.getElementById('btn-settings-back').addEventListener('click', () => showPage('page-main'));

  // Change PIN
  document.getElementById('btn-change-pin').addEventListener('click', () => {
    changePin = '';
    changeStep = 'old';
    clearDots('change-dots');
    document.getElementById('change-step-label').textContent = '输入旧密码';
    showPage('page-change-pin');
  });

  // Clear data
  document.getElementById('btn-clear-data').addEventListener('click', () => {
    if (confirm('确定要清除所有数据吗？这将删除密码、照片记录和所有设置。')) {
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
    document.getElementById('view-timeline').classList.remove('hidden');
  });

  // Load existing photos
  renderTimeline();
}

// ===== File Upload =====
async function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const indicator = document.getElementById('sync-indicator').firstElementChild;
  indicator.className = 'sync-dot sync-active';

  const wifiOnly = document.getElementById('toggle-wifi').checked;

  // Check WiFi (Web API has limited support, best effort)
  if (wifiOnly && navigator.connection) {
    const conn = navigator.connection;
    if (conn.type && conn.type !== 'wifi' && conn.type !== 'none') {
      indicator.className = 'sync-dot sync-error';
      setTimeout(() => { indicator.className = 'sync-dot sync-idle'; }, 3000);
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
  if (token) {
    for (const photo of photos) {
      try {
        await uploadToBaidu(photo, token);
        photo.uploaded = true;
      } catch (err) {
        console.error('Upload failed (silent):', err);
        // Silent - no notification
      }
    }
    // Update storage with upload status
    const updated = Storage.get('photos', []);
    Storage.set('photos', updated.map(p => {
      const up = photos.find(ph => ph.id === p.id);
      return up ? { ...p, uploaded: up.uploaded } : p;
    }));
  }

  // Render timeline
  renderTimeline();

  // Reset indicator
  indicator.className = 'sync-dot sync-done';
  setTimeout(() => { indicator.className = 'sync-dot sync-idle'; }, 2000);

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
  if (!photos.length) {
    document.getElementById('view-welcome').classList.remove('hidden');
    document.getElementById('view-timeline').classList.add('hidden');
    return;
  }

  document.getElementById('view-welcome').classList.add('hidden');
  document.getElementById('view-timeline').classList.remove('hidden');

  const list = document.getElementById('timeline-list');
  list.innerHTML = '';

  // Group by date
  const groups = {};
  photos.sort((a, b) => new Date(b.date) - new Date(a.date));
  photos.forEach(p => {
    const d = new Date(p.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  document.getElementById('view-timeline').classList.add('hidden');
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
    status.textContent = `已授权 (${days}天前)`;
    status.style.color = 'var(--success)';
  } else {
    status.textContent = '未授权';
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
    history.pushState(null, '', '');
  } else if (visiblePage && visiblePage.id === 'page-settings') {
    showPage('page-main');
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
