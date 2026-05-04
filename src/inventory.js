const STORAGE_KEY = 'lego-moc-inventory-v1';
const LEGACY_STORAGE_KEY = 'lego-moc-inventory';
const VALID_STATUSES = new Set(['complete', 'partial', 'missing']);

let store = {};

function hasStorage() {
  return typeof localStorage !== 'undefined';
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function partQty(qty) {
  const value = Number(qty);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function normalizeRecord(record, qty) {
  if (!record || typeof record !== 'object' || !VALID_STATUSES.has(record.status)) return null;

  if (record.status === 'complete') return { status: 'complete' };
  if (record.status === 'missing') return { status: 'missing' };

  const total = partQty(qty);
  const found = Math.round(Number(record.found));
  if (!Number.isFinite(found)) return null;
  if (total <= 1) return found >= total ? { status: 'complete' } : { status: 'missing' };
  if (found <= 0) return { status: 'missing' };
  if (found >= total) return { status: 'complete' };
  return { status: 'partial', found: clampNumber(found, 1, total - 1) };
}

function recordsMatch(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.status === b.status && a.found === b.found;
}

function saveInventory() {
  if (!hasStorage()) return;
  if (Object.keys(store).length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function loadInventory(parts = []) {
  if (!hasStorage()) {
    store = {};
    return;
  }

  const qtyByPart = new Map(parts.map(part => [part.part_id, part.qty]));
  const storedValue = localStorage.getItem(STORAGE_KEY);
  const legacyValue = !storedValue ? localStorage.getItem(LEGACY_STORAGE_KEY) : null;
  const rawValue = storedValue || legacyValue;

  try {
    const parsed = rawValue ? JSON.parse(rawValue) : {};
    const nextStore = {};
    let changed = Boolean(legacyValue);

    for (const [partId, record] of Object.entries(parsed || {})) {
      const normalized = normalizeRecord(record, qtyByPart.get(partId));
      if (normalized) nextStore[partId] = normalized;
      if (!recordsMatch(record, normalized)) changed = true;
    }

    store = nextStore;
    if (changed) saveInventory();
    if (legacyValue) localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    store = {};
    saveInventory();
  }
}

export function getRecord(partId, qty = null) {
  return normalizeRecord(store[partId], qty);
}

export function getStatus(partId, qty = null) {
  return getRecord(partId, qty)?.status || 'unchecked';
}

export function getFound(partId, qty = null) {
  const record = getRecord(partId, qty);
  return record?.status === 'partial' ? record.found : null;
}

export function defaultPartialFound(qty) {
  const total = partQty(qty);
  if (total <= 1) return null;
  return Math.min(total - 1, Math.max(1, Math.floor(total / 2)));
}

export function setStatus(partId, status, qty = null, found = null) {
  if (status === 'unchecked') {
    delete store[partId];
    saveInventory();
    return true;
  }

  let nextRecord = null;
  if (status === 'complete') nextRecord = { status: 'complete' };
  if (status === 'missing') nextRecord = { status: 'missing' };
  if (status === 'partial') {
    nextRecord = normalizeRecord({ status: 'partial', found }, qty);
  }

  if (!nextRecord) return false;
  store[partId] = nextRecord;
  saveInventory();
  return true;
}

export function resetAll() {
  store = {};
  if (!hasStorage()) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function summarizeParts(parts = []) {
  const summary = {
    totalLots: parts.length,
    checkedLots: 0,
    completeLots: 0,
    partialLots: 0,
    missingLots: 0,
    totalPieces: 0,
    foundPieces: 0,
    lotPct: 0,
    piecePct: 0,
  };

  for (const part of parts) {
    const total = partQty(part.qty);
    summary.totalPieces += total;

    const status = getStatus(part.part_id, total);
    if (status === 'unchecked') continue;

    summary.checkedLots++;
    if (status === 'complete') {
      summary.completeLots++;
      summary.foundPieces += total;
    } else if (status === 'partial') {
      summary.partialLots++;
      summary.foundPieces += getFound(part.part_id, total) || 0;
    } else if (status === 'missing') {
      summary.missingLots++;
    }
  }

  summary.lotPct = summary.totalLots ? Math.round((summary.checkedLots / summary.totalLots) * 100) : 0;
  summary.piecePct = summary.totalPieces ? Math.round((summary.foundPieces / summary.totalPieces) * 100) : 0;
  return summary;
}

export function drawerCompletion(drawerKey, partsByDrawerMap) {
  return summarizeParts(partsByDrawerMap.get(drawerKey) || []);
}
