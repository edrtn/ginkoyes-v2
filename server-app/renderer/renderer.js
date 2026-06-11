// @ts-check

/** @type {any} */
const api = window.api;

// --- DOM elements ---
const elServiceStatus = document.getElementById('service-status');
const elNextSync = document.getElementById('next-sync');
const elVpnStatus = document.getElementById('vpn-status');
const elVpnIp = document.getElementById('vpn-ip');
const elVpnKeyInput = document.getElementById('vpn-key-input');
const elBtnSaveKey = document.getElementById('btn-save-key');
const elSyncDate = document.getElementById('sync-date');
const elSyncDuration = document.getElementById('sync-duration');
const elSyncRows = document.getElementById('sync-rows');
const elSyncResult = document.getElementById('sync-result');
const elBtnSync = document.getElementById('btn-sync');
const elBtnRefresh = document.getElementById('btn-refresh');
const elLogOutput = document.getElementById('log-output');
const elHistoryBody = document.querySelector('#sync-history tbody');

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
    rows = await api.getSyncStatus();
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
    result = await api.getServiceStatus();
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
  // Prochaine sync : on affiche 23:10 par defaut (lu depuis le service)
  elNextSync.textContent = '23:10';
}

async function loadVpnStatus() {
  let status;
  try {
    status = await api.tailscaleStatus();
  } catch (err) {
    elLogOutput.textContent += `[ERR] tailscaleStatus: ${err.message}\n`;
    return;
  }
  if (status.connected) {
    elVpnStatus.className = 'badge badge-success';
    elVpnStatus.textContent = 'Connecte';
    elVpnIp.textContent = status.ip || '--';
  } else {
    elVpnStatus.className = 'badge badge-error';
    elVpnStatus.textContent = 'Deconnecte';
    elVpnIp.textContent = '--';
  }

  // Charger la cle depuis la DB
  const vpnConfig = await api.getVpnConfig();
  if (vpnConfig && !vpnConfig.error && vpnConfig.auth_key) {
    elVpnKeyInput.value = vpnConfig.auth_key;
  }
}

async function loadSyncLog() {
  const result = await api.getSyncLog();
  if (result.lines && result.lines.length > 0) {
    elLogOutput.textContent = result.lines.join('\n');
    elLogOutput.scrollTop = elLogOutput.scrollHeight;
  } else if (result.error) {
    elLogOutput.textContent = `[Erreur] ${result.error}`;
  } else {
    elLogOutput.textContent = 'Aucun log disponible.';
  }
}

async function refreshAll() {
  const results = await Promise.allSettled([
    loadSyncStatus(),
    loadServiceStatus(),
    loadVpnStatus(),
    loadSyncLog(),
  ]);
  // Afficher les erreurs dans le log pour diagnostic
  const errors = results
    .filter(r => r.status === 'rejected')
    .map(r => r.reason);
  if (errors.length > 0) {
    elLogOutput.textContent = '[DIAGNOSTIC] Erreurs au chargement:\n' + errors.map(e => e.message || e).join('\n');
  }
}

// --- Actions ---

elBtnSync.addEventListener('click', async () => {
  if (isSyncing) return;

  isSyncing = true;
  elBtnSync.disabled = true;
  elBtnSync.textContent = 'Sync en cours...';
  elLogOutput.textContent = '';

  const result = await api.triggerSync();
  if (result.error) {
    elLogOutput.textContent = `[Erreur] ${result.error}`;
    isSyncing = false;
    elBtnSync.disabled = false;
    elBtnSync.textContent = 'Lancer sync';
  }
});

elBtnSaveKey.addEventListener('click', async () => {
  const key = elVpnKeyInput.value.trim();
  if (!key) return;

  elBtnSaveKey.disabled = true;
  elBtnSaveKey.textContent = 'Enregistrement...';

  const result = await api.setVpnKey(key);
  if (result.error) {
    alert(`Erreur : ${result.error}`);
  } else {
    elBtnSaveKey.textContent = 'Enregistre !';
    setTimeout(() => {
      elBtnSaveKey.textContent = 'Enregistrer';
    }, 2000);
  }

  elBtnSaveKey.disabled = false;
});

elBtnRefresh.addEventListener('click', refreshAll);

// --- Sync streaming events ---

api.onSyncOutput((data) => {
  elLogOutput.textContent += data;
  elLogOutput.scrollTop = elLogOutput.scrollHeight;
});

api.onSyncFinished((code) => {
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

elLogOutput.textContent = '[INFO] Ginkoyes Serveur demarre...\n';
refreshAll();
setInterval(refreshAll, 30000);
