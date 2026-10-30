import "dotenv/config";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import { openStore, bootstrap } from "./store.js";
import { createApp } from "./app.js";

const root = fileURLToPath(new URL("../", import.meta.url));
let localMongo;
let uri = process.env.MONGODB_URI;
if (!uri) {
  if (process.env.NODE_ENV === "production")
    throw new Error("MONGODB_URI is required in production.");
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const dbPath = path.join(root, "data", "mongo");
  mkdirSync(dbPath, { recursive: true });
  localMongo = await MongoMemoryServer.create({
    instance: { dbPath, storageEngine: "wiredTiger" },
  });
  uri = localMongo.getUri();
  console.log(
    "Development MongoDB running locally; data persists in business-portal/data/mongo.",
  );
}
const db = await openStore(
  uri,
  process.env.MONGODB_DATABASE || "business_portal",
);
const credentials = await bootstrap(db, {
  email: process.env.INITIAL_OWNER_EMAIL,
  password: process.env.INITIAL_OWNER_PASSWORD,
});
if (credentials)
  console.log(
    `\nFIRST-RUN OWNER ACCOUNT\nEmail: ${credentials.email}\nPassword: ${credentials.password}\nSave these credentials; change the password in Staff & access.\n`,
  );
const app = createApp(db);
if (existsSync(path.join(root, "dist"))) {
  app.use(express.static(path.join(root, "dist")));
  app.get("*", (_req, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
}
const server = app.listen(Number(process.env.PORT || 4318), "127.0.0.1", () =>
  console.log(`Business API: http://127.0.0.1:${process.env.PORT || 4318}`),
);
async function stop() {
  server.close();
  await db.connection.close();
  if (localMongo) await localMongo.stop({ doCleanup: false });
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
