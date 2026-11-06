// Signed-in staff are looked up on every API request (user + branch: two
// database round trips before any real work). Keep them for a few seconds.
// Any write to a User or Branch clears the cache (model hooks), so
// deactivating a user or changing permissions applies on the next request.
const TTL_MS = 20 * 1000;
const cache = new Map();

function getCachedUser(id) {
  const hit = cache.get(String(id));
  if (!hit) return null;
  if (hit.expires < Date.now()) { cache.delete(String(id)); return null; }
  return hit.user;
}
function setCachedUser(id, user) {
  if (cache.size > 500) cache.clear();
  cache.set(String(id), { user, expires: Date.now() + TTL_MS });
}
function clearUserCache() { cache.clear(); }

module.exports = { getCachedUser, setCachedUser, clearUserCache };
