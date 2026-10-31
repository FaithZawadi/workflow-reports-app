"use client";
// A tiny IndexedDB queue for clock punches made while offline. Each punch (with
// its selfie and the real punch time) is stored and re-sent when back online, so
// no attendance is lost at a site with no signal.

const DB_NAME = "qsl-clock";
const STORE = "punches";

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function queuePunch(punch) {
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(punch);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

export async function allPunches() {
  try {
    const db = await openDb();
    return await new Promise((res) => {
      const tx = db.transaction(STORE, "readonly");
      const rq = tx.objectStore(STORE).getAll();
      rq.onsuccess = () => res(rq.result || []);
      rq.onerror = () => res([]);
    });
  } catch {
    return [];
  }
}

export async function removePunch(id) {
  try {
    const db = await openDb();
    await new Promise((res) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch {}
}

export async function queuedCount() {
  return (await allPunches()).length;
}

// Re-send every queued punch (oldest first). Returns how many synced. A 4xx
// other than network failure drops the punch (it will never succeed); a network
// failure stops the flush so it's retried later.
export async function flushQueue(endpoint = "/api/attendance/clock") {
  const items = (await allPunches()).sort((a, b) => (a.at || "").localeCompare(b.at || ""));
  let synced = 0;
  for (const p of items) {
    try {
      const { id, ...payload } = p;
      const r = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (r.ok) { await removePunch(id); synced++; }
      else if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) { await removePunch(id); } // unrecoverable → drop
      else break; // server/network trouble → stop, retry later
    } catch {
      break; // offline again → stop
    }
  }
  return synced;
}
