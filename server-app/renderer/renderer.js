// @ts-check

/** @type {any} */
const gkApi = window.api;

if (!gkApi) {
  const _log = document.getElementById('log-output');
  if (_log) _log.textContent = '[ERREUR] window.api est undefined - le preload.js n\'a pas fonctionne\n';
}

// --- DOM elements ---
const elServiceStatus = document.getElementById('service-status');
const elNextSync = document.getElementById('next-sync');
const elSyncDate = document.getElementById('sync-date');
const elSyncDuration = document.getElementById('sync-duration');
const elSyncRows = document.getElementById('sync-rows');
const elSyncResult = document.getElementById('sync-result');
const elBtnSync = document.getElementById('btn-sync');
const elBtnRefresh = document.getElementById('btn-refresh');
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

// --- Auto-refresh ---

refreshAll();
setInterval(refreshAll, 30000);
