"use client";
// Offline outbox for report submissions.
//
// When the device has no network, a filed report is stored here (IndexedDB, so
// it survives a page reload and comfortably holds base64 photo payloads) and
// forwarded to the server automatically the moment connectivity returns.

const DB_NAME = "qsl-outbox";
const STORE = "reports";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no-indexeddb"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("indexeddb-open-failed"));
  });
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

// Queue a report payload. `payload` is the same body the form POSTs to
// /api/reports. Returns the stored record (with a generated id).
export async function enqueueReport(payload) {
  const db = await openDB();
  const record = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    payload,
    createdAt: Date.now(),
  };
  await new Promise((resolve, reject) => {
    const req = tx(db, "readwrite").add(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  db.close();
  return record;
}

export async function pendingReports() {
  const db = await openDB();
  const list = await new Promise((resolve, reject) => {
    const req = tx(db, "readonly").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function pendingCount() {
  try {
    const db = await openDB();
    const n = await new Promise((resolve, reject) => {
      const req = tx(db, "readonly").count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return n;
  } catch {
    return 0;
  }
}

export async function removeReport(id) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const req = tx(db, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  db.close();
}

let flushing = false;

// Attempt to send every queued report. Successfully delivered ones are removed;
// anything that fails (still offline, server error) stays queued for the next
// attempt. Returns a summary { sent, remaining }.
export async function flushOutbox() {
  if (flushing) return { sent: 0, remaining: await pendingCount() };
  flushing = true;
  let sent = 0;
  try {
    const queued = await pendingReports();
    for (const record of queued) {
      try {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(record.payload),
        });
        if (res.ok) {
          await removeReport(record.id);
          sent += 1;
        } else if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 408 && res.status !== 429) {
          // Permanent rejection (e.g. validation) — drop it so it can't wedge
          // the queue forever. Auth/timeout/rate-limit are treated as transient.
          await removeReport(record.id);
        } else {
          // Transient (offline mid-flush, 5xx, auth not ready). Stop and retry later.
          break;
        }
      } catch {
        // Network error — stop; the online listener will retry.
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, remaining: await pendingCount() };
}
