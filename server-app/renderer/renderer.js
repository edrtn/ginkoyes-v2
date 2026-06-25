// @ts-check

/** @type {any} */
const gkApi = window.api;

if (!gkApi) {
  const _log = document.getElementById('log-output');
  if (_log) _log.textContent = '[ERREUR] window.api est undefined - le preload.js n\'a pas fonctionne\n';
}

// --- Pages ---
const elDashboard = document.getElementById('dashboard');
const elSetupWizard = document.getElementById('setup-wizard');
const elSettingsPage = document.getElementById('settings-page');

// --- Dashboard DOM elements ---
const elServiceStatus = document.getElementById('service-status');
const elNextSync = document.getElementById('next-sync');
const elSyncDate = document.getElementById('sync-date');
const elSyncDuration = document.getElementById('sync-duration');
const elSyncRows = document.getElementById('sync-rows');
const elSyncResult = document.getElementById('sync-result');
const elBtnSync = document.getElementById('btn-sync');
const elBtnRefresh = document.getElementById('btn-refresh');
const elBtnSettings = document.getElementById('btn-settings');
const elLogOutput = document.getElementById('log-output');
const elHistoryBody = document.querySelector('#sync-history tbody');

// Tunnel SSH
const elTunnelVpsHost = document.getElementById('tunnel-vps-host');
const elTunnelVpsPort = document.getElementById('tunnel-vps-port');
const elTunnelSshUser = document.getElementById('tunnel-ssh-user');
const elTunnelRemotePort = document.getElementById('tunnel-remote-port');
const elTunnelPrivateKey = document.getElementById('tunnel-private-key');
const elBtnSaveTunnel = document.getElementById('btn-save-tunnel');
const elTunnelSaveStatus = document.getElementById('tunnel-save-status');

let isSyncing = false;

// --- Page navigation ---

function showPage(page) {
  elSetupWizard.style.display = 'none';
  elSettingsPage.style.display = 'none';
  elDashboard.style.display = 'none';

  if (page === 'wizard') {
    elSetupWizard.style.display = 'flex';
  } else if (page === 'settings') {
    elSettingsPage.style.display = 'flex';
  } else {
    elDashboard.style.display = 'block';
  }
}

// --- Helpers ---

function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hours}:${mins}`;
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return '--';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatNumber(n) {
  if (n == null) return '--';
  return n.toLocaleString('fr-FR');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

function setBadge(el, status) {
  el.className = 'badge';
  switch (status) {
    case 'success':
      el.classList.add('badge-success');
      el.textContent = 'Succes';
      break;
    case 'error':
      el.classList.add('badge-error');
      el.textContent = 'Erreur';
      break;
    case 'running':
      el.classList.add('badge-running');
      el.textContent = 'En cours';
      break;
    default:
      el.classList.add('badge-unknown');
      el.textContent = status || '--';
  }
}

// --- Setup / Wizard ---

async function initSetup() {
  try {
    const result = await gkApi.checkSetupNeeded();
    if (result.needed) {
      showPage('wizard');
      await initWizard();
    } else {
      showPage('dashboard');
      refreshAll();
    }
  } catch (err) {
    // If check fails (e.g. no config file), show wizard
    showPage('wizard');
    await initWizard();
  }
}

async function initWizard() {
  // Auto-detect isql.exe
  const detectStatus = document.getElementById('wiz-detect-status');
  try {
    const result = await gkApi.detectInterbase();
    if (result.found) {
      document.getElementById('wiz-isql-path').value = result.isqlPath;
      detectStatus.textContent = 'Auto-detecte';
      detectStatus.className = 'test-result test-ok';
    } else {
      detectStatus.textContent = 'Non detecte - utilisez Parcourir';
      detectStatus.className = 'test-result test-fail';
    }
  } catch {
    detectStatus.textContent = '';
  }

  // Pre-fill from existing config if available
  try {
    const cfg = await gkApi.getSyncConfig();
    if (cfg && !cfg.error) {
      if (cfg.interbase) {
        if (cfg.interbase.ibSourcePath) document.getElementById('wiz-ib-source').value = cfg.interbase.ibSourcePath;
        if (cfg.interbase.isqlPath) document.getElementById('wiz-isql-path').value = cfg.interbase.isqlPath;
        if (cfg.interbase.user) document.getElementById('wiz-ib-user').value = cfg.interbase.user;
        if (cfg.interbase.password) document.getElementById('wiz-ib-password').value = cfg.interbase.password;
      }
      if (cfg.network) {
        if (cfg.network.user) document.getElementById('wiz-net-user').value = cfg.network.user;
        if (cfg.network.password) document.getElementById('wiz-net-password').value = cfg.network.password;
      }
      if (cfg.sync) {
        document.getElementById('wiz-live-enabled').checked = cfg.sync.liveEnabled !== false;
        if (cfg.sync.liveSchedule) document.getElementById('wiz-live-interval').value = cfg.sync.liveSchedule;
      }
    }
  } catch {}
}

// --- Wizard event handlers ---

// Browse IB source
document.getElementById('wiz-browse-ib').addEventListener('click', async () => {
  const result = await gkApi.browseFile({
    title: 'Selectionner le fichier GINKOIA.IB',
    filters: [{ name: 'Fichiers InterBase', extensions: ['IB', 'ib'] }],
  });
  if (!result.canceled) {
    document.getElementById('wiz-ib-source').value = result.filePath;
  }
});

// Test IB source
document.getElementById('wiz-test-ib').addEventListener('click', async () => {
  const filePath = document.getElementById('wiz-ib-source').value;
  const resultEl = document.getElementById('wiz-test-ib-result');
  if (!filePath) {
    resultEl.textContent = 'Chemin vide';
    resultEl.className = 'test-result test-fail';
    return;
  }
  const result = await gkApi.testPathExists(filePath);
  if (result.exists) {
    const date = new Date(result.mtime);
    resultEl.textContent = `OK - ${formatFileSize(result.size)} - modifie le ${date.toLocaleDateString('fr-FR')} ${date.toLocaleTimeString('fr-FR')}`;
    resultEl.className = 'test-result test-ok';
  } else {
    resultEl.textContent = result.error || 'Fichier introuvable';
    resultEl.className = 'test-result test-fail';
  }
});

// Browse isql.exe
document.getElementById('wiz-browse-isql').addEventListener('click', async () => {
  const result = await gkApi.browseFile({
    title: 'Selectionner isql.exe',
    filters: [{ name: 'Executables', extensions: ['exe'] }],
  });
  if (!result.canceled) {
    document.getElementById('wiz-isql-path').value = result.filePath;
  }
});

// Save wizard
document.getElementById('wiz-save').addEventListener('click', async () => {
  const ibSource = document.getElementById('wiz-ib-source').value;
  if (!ibSource) {
    document.getElementById('wiz-save-status').textContent = 'Veuillez indiquer le chemin du fichier .IB';
    document.getElementById('wiz-save-status').style.color = 'red';
    return;
  }

  const isqlPath = document.getElementById('wiz-isql-path').value;
  const interbaseHome = isqlPath ? isqlPath.replace(/\\bin\\isql\.exe$/i, '') : '';

  const config = {
    interbase: {
      ibSourcePath: ibSource,
      ibLocalPath: 'C:\\sportlink-serveur\\backup\\GINKOIA.IB',
      isqlPath: isqlPath,
      interbaseHome: interbaseHome,
      user: document.getElementById('wiz-ib-user').value || 'SYSDBA',
      password: document.getElementById('wiz-ib-password').value || 'masterkey',
    },
    network: {
      user: document.getElementById('wiz-net-user').value,
      password: document.getElementById('wiz-net-password').value,
    },
    sync: {
      liveEnabled: document.getElementById('wiz-live-enabled').checked,
      liveSchedule: document.getElementById('wiz-live-interval').value,
    },
  };

  const result = await gkApi.saveSyncConfig(config);
  if (result.error) {
    document.getElementById('wiz-save-status').textContent = 'Erreur: ' + result.error;
    document.getElementById('wiz-save-status').style.color = 'red';
  } else {
    document.getElementById('wiz-save-status').textContent = 'Configuration sauvegardee !';
    document.getElementById('wiz-save-status').style.color = 'green';
    setTimeout(() => {
      showPage('dashboard');
      refreshAll();
    }, 800);
  }
});

// --- Settings page event handlers ---

async function loadSettingsPage() {
  try {
    const cfg = await gkApi.getSyncConfig();
    if (cfg && !cfg.error) {
      if (cfg.interbase) {
        document.getElementById('set-ib-source').value = cfg.interbase.ibSourcePath || '';
        document.getElementById('set-isql-path').value = cfg.interbase.isqlPath || '';
        document.getElementById('set-ib-user').value = cfg.interbase.user || 'SYSDBA';
        document.getElementById('set-ib-password').value = cfg.interbase.password || 'masterkey';
      }
      if (cfg.network) {
        document.getElementById('set-net-user').value = cfg.network.user || '';
        document.getElementById('set-net-password').value = cfg.network.password || '';
      }
      if (cfg.sync) {
        document.getElementById('set-live-enabled').checked = cfg.sync.liveEnabled !== false;
        if (cfg.sync.liveSchedule) document.getElementById('set-live-interval').value = cfg.sync.liveSchedule;
      }
    }
  } catch {}
}

// Browse IB source (settings)
document.getElementById('set-browse-ib').addEventListener('click', async () => {
  const result = await gkApi.browseFile({
    title: 'Selectionner le fichier GINKOIA.IB',
    filters: [{ name: 'Fichiers InterBase', extensions: ['IB', 'ib'] }],
  });
  if (!result.canceled) {
    document.getElementById('set-ib-source').value = result.filePath;
  }
});

// Test IB source (settings)
document.getElementById('set-test-ib').addEventListener('click', async () => {
  const filePath = document.getElementById('set-ib-source').value;
  const resultEl = document.getElementById('set-test-ib-result');
  if (!filePath) {
    resultEl.textContent = 'Chemin vide';
    resultEl.className = 'test-result test-fail';
    return;
  }
  const result = await gkApi.testPathExists(filePath);
  if (result.exists) {
    const date = new Date(result.mtime);
    resultEl.textContent = `OK - ${formatFileSize(result.size)} - modifie le ${date.toLocaleDateString('fr-FR')} ${date.toLocaleTimeString('fr-FR')}`;
    resultEl.className = 'test-result test-ok';
  } else {
    resultEl.textContent = result.error || 'Fichier introuvable';
    resultEl.className = 'test-result test-fail';
  }
});

// Browse isql.exe (settings)
document.getElementById('set-browse-isql').addEventListener('click', async () => {
  const result = await gkApi.browseFile({
    title: 'Selectionner isql.exe',
    filters: [{ name: 'Executables', extensions: ['exe'] }],
  });
  if (!result.canceled) {
    document.getElementById('set-isql-path').value = result.filePath;
  }
});

// Save settings
document.getElementById('set-save').addEventListener('click', async () => {
  const ibSource = document.getElementById('set-ib-source').value;
  if (!ibSource) {
    document.getElementById('set-save-status').textContent = 'Veuillez indiquer le chemin du fichier .IB';
    document.getElementById('set-save-status').style.color = 'red';
    return;
  }

  const isqlPath = document.getElementById('set-isql-path').value;
  const interbaseHome = isqlPath ? isqlPath.replace(/\\bin\\isql\.exe$/i, '') : '';

  const config = {
    interbase: {
      ibSourcePath: ibSource,
      ibLocalPath: 'C:\\sportlink-serveur\\backup\\GINKOIA.IB',
      isqlPath: isqlPath,
      interbaseHome: interbaseHome,
      user: document.getElementById('set-ib-user').value || 'SYSDBA',
      password: document.getElementById('set-ib-password').value || 'masterkey',
    },
    network: {
      user: document.getElementById('set-net-user').value,
      password: document.getElementById('set-net-password').value,
    },
    sync: {
      liveEnabled: document.getElementById('set-live-enabled').checked,
      liveSchedule: document.getElementById('set-live-interval').value,
    },
  };

  const result = await gkApi.saveSyncConfig(config);
  const statusEl = document.getElementById('set-save-status');
  if (result.error) {
    statusEl.textContent = 'Erreur: ' + result.error;
    statusEl.style.color = 'red';
  } else {
    statusEl.textContent = 'Sauvegarde !';
    statusEl.style.color = 'green';
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
  }
});

// Back to dashboard
document.getElementById('set-back').addEventListener('click', () => {
  showPage('dashboard');
});

// Settings button in header
elBtnSettings.addEventListener('click', async () => {
  if (elSettingsPage.style.display !== 'none') {
    showPage('dashboard');
  } else {
    await loadSettingsPage();
    showPage('settings');
  }
});

// --- Data loading ---

async function loadSyncStatus() {
  let rows;
  try {
    rows = await gkApi.getSyncStatus();
  } catch (err) {
    elLogOutput.textContent += `[ERR] getSyncStatus: ${err.message}\n`;
    return;
  }
  if (rows.error || !Array.isArray(rows) || rows.length === 0) {
    elSyncDate.textContent = '--';
    elSyncDuration.textContent = '--';
    elSyncRows.textContent = '--';
    setBadge(elSyncResult, null);
    elHistoryBody.innerHTML = '';
    if (rows.error) elLogOutput.textContent += `[ERR] getSyncStatus: ${rows.error}\n`;
    return;
  }

  // Derniere sync
  const last = rows[0];
  elSyncDate.textContent = formatDate(last.sync_start);
  elSyncDuration.textContent = formatDuration(last.duration_ms);
  elSyncRows.textContent = formatNumber(last.rows_synced);
  setBadge(elSyncResult, last.status);

  // Check if a sync is currently running
  if (last.status === 'running') {
    isSyncing = true;
    elBtnSync.disabled = true;
    elBtnSync.textContent = 'Sync en cours...';
  }

  // Historique
  elHistoryBody.innerHTML = '';
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(row.sync_start)}</td>
      <td><span class="badge badge-${row.status === 'success' ? 'success' : row.status === 'error' ? 'error' : 'running'}">${row.status}</span></td>
      <td>${formatNumber(row.rows_synced)}</td>
      <td>${formatDuration(row.duration_ms)}</td>
    `;
    elHistoryBody.appendChild(tr);
  });
}

async function loadServiceStatus() {
  let result;
  try {
    result = await gkApi.getServiceStatus();
  } catch (err) {
    elLogOutput.textContent += `[ERR] getServiceStatus: ${err.message}\n`;
    return;
  }
  if (result.running) {
    elServiceStatus.className = 'badge badge-success';
    elServiceStatus.textContent = 'En marche';
  } else {
    elServiceStatus.className = 'badge badge-error';
    elServiceStatus.textContent = 'Arrete';
  }
  // Prochaine sync : on affiche 02:00 par defaut (lu depuis le service)
  elNextSync.textContent = '02:00';
}

async function loadSyncLog() {
  const result = await gkApi.getSyncLog();
  if (result.lines && result.lines.length > 0) {
    elLogOutput.textContent = result.lines.join('\n');
    elLogOutput.scrollTop = elLogOutput.scrollHeight;
  } else if (result.error) {
    elLogOutput.textContent = `[Erreur] ${result.error}`;
  } else {
    elLogOutput.textContent = 'Aucun log disponible.';
  }
}

async function loadTunnelConfig() {
  try {
    const config = await gkApi.getTunnelConfig();
    if (config && !config.error) {
      elTunnelVpsHost.value = config.vps_host || '';
      elTunnelVpsPort.value = config.vps_port || 22;
      elTunnelSshUser.value = config.ssh_user || 'tunnel';
      elTunnelRemotePort.value = config.remote_port || 3307;
      elTunnelPrivateKey.value = config.private_key || '';
    }
  } catch (err) {
    elLogOutput.textContent += `[ERR] getTunnelConfig: ${err.message}\n`;
  }
}

async function refreshAll() {
  await Promise.allSettled([
    loadSyncStatus(),
    loadServiceStatus(),
    loadSyncLog(),
    loadTunnelConfig(),
  ]);
}

// --- Actions ---

elBtnSync.addEventListener('click', async () => {
  if (isSyncing) return;

  isSyncing = true;
  elBtnSync.disabled = true;
  elBtnSync.textContent = 'Sync en cours...';
  elLogOutput.textContent = '';

  const result = await gkApi.triggerSync();
  if (result.error) {
    elLogOutput.textContent = `[Erreur] ${result.error}`;
    isSyncing = false;
    elBtnSync.disabled = false;
    elBtnSync.textContent = 'Lancer sync';
  }
});

elBtnRefresh.addEventListener('click', refreshAll);

elBtnSaveTunnel.addEventListener('click', async () => {
  const config = {
    vps_host: elTunnelVpsHost.value,
    vps_port: parseInt(elTunnelVpsPort.value, 10) || 22,
    ssh_user: elTunnelSshUser.value,
    private_key: elTunnelPrivateKey.value,
    remote_port: parseInt(elTunnelRemotePort.value, 10) || 3307,
  };
  const result = await gkApi.setTunnelConfig(config);
  if (result.error) {
    elLogOutput.textContent += `[ERR] setTunnelConfig: ${result.error}\n`;
  } else {
    elTunnelSaveStatus.style.display = 'inline';
    setTimeout(() => { elTunnelSaveStatus.style.display = 'none'; }, 3000);
  }
});

// --- Sync streaming events ---

gkApi.onSyncOutput((data) => {
  elLogOutput.textContent += data;
  elLogOutput.scrollTop = elLogOutput.scrollHeight;
});

gkApi.onSyncFinished((code) => {
  isSyncing = false;
  elBtnSync.disabled = false;
  elBtnSync.textContent = 'Lancer sync';

  const msg = code === 0
    ? '\n--- Synchronisation terminee avec succes ---\n'
    : `\n--- Synchronisation terminee (code: ${code}) ---\n`;
  elLogOutput.textContent += msg;
  elLogOutput.scrollTop = elLogOutput.scrollHeight;

  // Rafraichir les donnees
  loadSyncStatus();
});

// --- Startup ---

initSetup();
setInterval(() => {
  // Only auto-refresh if dashboard is visible
  if (elDashboard.style.display !== 'none') {
    refreshAll();
  }
}, 30000);
