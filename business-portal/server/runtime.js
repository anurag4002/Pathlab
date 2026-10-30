import { openStore } from "./store.js";
import { createApp } from "./app.js";

let cached;
export async function getHubApp() {
  if (!cached)
    cached = initialise().catch((error) => {
      cached = undefined;
      throw error;
    });
  const result = await cached;
  if (result.db.connection.readyState === 0) {
    cached = undefined;
    return getHubApp();
  }
  return result.app;
}
async function initialise() {
  const uri = process.env.HUB_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("HUB_MONGODB_URI must be configured.");
  const database =
    process.env.HUB_MONGODB_DATABASE ||
    process.env.MONGODB_DATABASE ||
    "business_portal";
  // Never fall back to MONGO_URI: that belongs exclusively to Path Lab.
  const db = await openStore(uri, database);
  if (!(await db.Setting.exists({ key: "business" }))) {
    await db.connection.close();
    throw new Error("Run npm run setup:hub before serving Business Hub.");
  }
  return { app: createApp(db), db };
}
