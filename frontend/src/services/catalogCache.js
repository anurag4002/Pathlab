/**
 * Short-lived in-memory cache for catalog APIs (tests, doctors, packages…).
 * Avoids re-downloading the same full lists on every page navigation.
 */

const store = new Map();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

const keyOf = (name, params) => {
  try {
    return `${name}:${JSON.stringify(params || {})}`;
  } catch {
    return `${name}:`;
  }
};

export const getCached = async (name, params, fetcher, ttlMs = DEFAULT_TTL_MS) => {
  const key = keyOf(name, params);
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    return hit.data;
  }
  const data = await fetcher();
  store.set(key, { at: Date.now(), data });
  return data;
};

export const invalidateCatalog = (namePrefix = '') => {
  if (!namePrefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(namePrefix)) store.delete(key);
  }
};

export default { getCached, invalidateCatalog };
