// Local preview of the exact combined build. No existing Lab database is used.
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const express = require("express");
const root = path.resolve(__dirname, "..");
const port = Number(process.env.UNIFIED_PREVIEW_PORT || 4118);
let mongo, hubChild;
async function main() {
  if (!fs.existsSync(path.join(root, "dist/pathlab/index.html")))
    throw new Error("Run npm run build first.");
  let hubReady = false;
  try {
    const r = await fetch("http://127.0.0.1:4318/api/health");
    hubReady = r.ok;
  } catch {}
  if (!hubReady) {
    hubChild = spawn(process.execPath, ["server/index.js"], {
      cwd: path.join(root, "business-portal"),
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "development" },
    });
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        hubReady = (
          await fetch("http://127.0.0.1:4318/api/health", {
            signal: AbortSignal.timeout(500),
          })
        ).ok;
      } catch {}
      if (hubReady) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!hubReady)
      throw new Error("Business Hub API did not become ready on port 4318.");
  }
  const {
    MongoMemoryServer,
  } = require("../business-portal/node_modules/mongodb-memory-server");
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("pure_path_lab_preview");
  process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.NODE_ENV = "development";
  process.env.CLIENT_URL = `http://127.0.0.1:${port}/pathlab`;
  process.env.PUBLIC_BASE_URL = process.env.CLIENT_URL;
  process.env.CORS_ORIGIN = `http://127.0.0.1:${port},http://127.0.0.1:5178,http://localhost:5178`;
  // Preview must not send messages or invoke live OAuth using parent .env values.
  process.env.SMS_PROVIDER = 'console';
  process.env.EMAIL_PROVIDER = 'console';
  for (const name of ['SMS_API_KEY','EMAIL_API_KEY','WHATSAPP_TOKEN','WHATSAPP_PHONE_ID','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','FACEBOOK_CLIENT_ID','FACEBOOK_CLIENT_SECRET']) process.env[name] = '';
  // Set explicit local-only values BEFORE the Lab config loads its env files.
  const lab = require("../backend/src/app");
  const app = express();
  app.use((req, res, next) => {
    if (!/^\/hub-api(?:\/|\?|$)/.test(req.url)) return next();
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: 4318,
        path: req.url.replace(/^\/hub-api/, "/api"),
        method: req.method,
        headers: req.headers,
      },
      (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      },
    );
    upstream.on("error", () =>
      res
        .status(503)
        .json({
          error:
            "Start the Business Hub API with npm run dev --prefix business-portal.",
        }),
    );
    req.pipe(upstream);
  });
  app.use((req, res, next) =>
    /^\/(?:api|uploads)(?:\/|\?|$)/.test(req.url)
      ? lab(req, res, next)
      : next(),
  );
  app.get("/r/*", (req, res) =>
    res.redirect(308, `/pathlab${req.originalUrl}`),
  );
  app.get(["/patient/report", "/reports"], (req, res) =>
    res.redirect(308, `/pathlab${req.originalUrl}`),
  );
  app.use(express.static(path.join(root, "dist")));
  app.get(["/pathlab", "/pathlab/*"], (_req, res) =>
    res.sendFile(path.join(root, "dist/pathlab/index.html")),
  );
  app.get("*", (_req, res) => res.sendFile(path.join(root, "dist/index.html")));
  const server = app.listen(port, "127.0.0.1", () =>
    console.log(
      `\nUnified preview: http://127.0.0.1:${port}\nPath Lab: http://127.0.0.1:${port}/pathlab/\nLab preview uses a fresh isolated MongoDB, not your existing records/login. Production uses your original MONGO_URI.\n`,
    ),
  );
  const stop = async () => {
    server.close();
    hubChild?.kill();
    await mongo.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
main().catch(async (e) => {
  console.error(e.message);
  hubChild?.kill();
  if (mongo) await mongo.stop();
  process.exitCode = 1;
});
