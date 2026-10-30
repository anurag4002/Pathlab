const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const express = require("express");
const {
  MongoMemoryServer,
} = require("../business-portal/node_modules/mongodb-memory-server");
const { createHubHandler } = require("../api/hub");
const root = path.resolve(__dirname, "..");

test("unified build and Vercel routing preserve both applications", () => {
  const config = JSON.parse(
    fs.readFileSync(path.join(root, "vercel.json"), "utf8"),
  );
  assert.equal(config.outputDirectory, "dist");
  const route = (url) =>
    config.routes.find((r) => r.src && new RegExp(`^${r.src}$`).test(url));
  assert.equal(route("/hub-api/login").dest, "/api/hub.js");
  assert.equal(route("/api/auth/login").dest, "/api/index.js");
  assert.equal(route("/pathlab/admin/login").dest, "/pathlab/index.html");
  assert.equal(route("/admin/bills").dest, "/index.html");
  assert.equal(route("/r/token").headers.Location, "/pathlab/r/$1");
  assert.ok(
    config.routes.findIndex((r) => r.handle === "filesystem") <
      config.routes.findIndex((r) => r.dest === "/pathlab/index.html"),
  );
  for (const [folder, label] of [
    ["", "Business Hub"],
    ["pathlab", "Pure Path Lab"],
  ]) {
    const html = fs.readFileSync(
      path.join(root, "dist", folder, "index.html"),
      "utf8",
    );
    assert.ok(html.includes(label));
    const scripts = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].filter(
      ([, value]) => value.includes("/assets/"),
    );
    assert.ok(scripts.length);
    for (const [, asset] of scripts)
      assert.ok(
        fs.existsSync(path.join(root, "dist", asset.replace(/^\//, ""))),
        `Missing asset ${asset}`,
      );
    if (folder === "pathlab") assert.match(html, /src="\/pathlab\/assets\//);
  }
});

test("one domain serves independent Lab and Hub APIs/logins", async (t) => {
  const mongo = await MongoMemoryServer.create();
  // All Lab config is isolated before loading its unchanged app/environment.
  process.env.MONGO_URI = mongo.getUri("pathlab_unified_test");
  process.env.JWT_SECRET = "unified-lab-test-secret-with-at-least-32-chars";
  process.env.NODE_ENV = "test";
  process.env.CORS_ORIGIN = "http://127.0.0.1";
  const { openStore, bootstrap } = await import(
    pathToFileURL(path.join(root, "business-portal/server/store.js")).href
  );
  const { createApp } = await import(
    pathToFileURL(path.join(root, "business-portal/server/app.js")).href
  );
  const db = await openStore(mongo.getUri(), "hub_unified_test");
  await bootstrap(db, {
    email: "hub-owner@example.test",
    password: "Hub-owner-test-password-123",
  });
  let lab;
  const app = express();
  app.use((req, res, next) =>
    req.url.startsWith("/hub-api")
      ? createHubHandler(async () => createApp(db))(req, res)
      : next(),
  );
  app.use((req, res, next) =>
    req.url.startsWith("/api/") ? lab(req, res, next) : next(),
  );
  app.use(express.static(path.join(root, "dist")));
  app.get(["/pathlab", "/pathlab/*"], (_req, res) =>
    res.sendFile(path.join(root, "dist/pathlab/index.html")),
  );
  app.get("*", (_req, res) => res.sendFile(path.join(root, "dist/index.html")));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.CORS_ORIGIN = base;
  lab = require("../backend/src/app");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await db.connection.close();
    await require("../backend/node_modules/mongoose").disconnect();
    delete global.mongoose;
    await mongo.stop();
  });
  async function req(url, body, headers = {}) {
    return fetch(base + url, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Origin: base, ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  const portal = await req("/hotel");
  assert.equal(portal.status, 200);
  assert.match(await portal.text(), /Business Hub/);
  const loginPage = await req("/pathlab/admin/login");
  assert.equal(loginPage.status, 200);
  assert.match(await loginPage.text(), /Pure Path Lab/);
  const hubHealth = await req("/hub-api/health");
  assert.equal((await hubHealth.json()).database, "MongoDB");
  const labHealth = await req("/api/health");
  assert.equal((await labHealth.json()).service, "Pure Path Lab Backend");
  const login = await req("/hub-api/login", {
    email: "hub-owner@example.test",
    password: "Hub-owner-test-password-123",
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await req("/hub-api/me", null, { Cookie: cookie })).status,
    200,
  );
  assert.equal(
    (await req("/api/patients", null, { Cookie: cookie })).status,
    401,
    "Hub cookie must not authenticate into Path Lab",
  );
  assert.equal(
    (await req("/hub-api/me", null, { Authorization: "Bearer lab-test-token" }))
      .status,
    401,
    "Lab bearer tokens must not authenticate into Hub",
  );
  assert.equal(
    (
      await req("/api/auth/login", {
        email: "hub-owner@example.test",
        password: "Hub-owner-test-password-123",
      })
    ).status,
    401,
    "Hub users must not exist in Lab",
  );
  assert.equal(
    await require("../backend/node_modules/mongoose")
      .connection.collection("users")
      .countDocuments({}),
    0,
  );
  const script = fs
    .readFileSync(path.join(root, "dist/pathlab/index.html"), "utf8")
    .match(/src="([^"]+\.js)"/)[1];
  assert.equal((await req(script)).status, 200);
  // The wrapper creates a fresh Express app per call in this test. Limiting
  // must still span those instances through MongoDB rather than an in-memory Map.
  for (let i = 0; i < 25; i++) {
    assert.equal((await req('/hub-api/public/requests', { website: 'test-bot' })).status, 400);
  }
  assert.equal((await req('/hub-api/public/requests', { website: 'test-bot' })).status, 429);
  assert.ok(await db.RateBucket.exists({ count: { $gte: 26 } }));
  const cleanDb = await openStore(mongo.getUri(), 'hub_clean_setup_test');
  try {
    await bootstrap(cleanDb, { email: 'new-owner@example.test', password: 'New-owner-test-password-123', seedCatalog: false });
    assert.equal(await cleanDb.User.countDocuments(), 1);
    assert.equal(await cleanDb.Menu.countDocuments(), 0);
    assert.equal(await cleanDb.Room.countDocuments(), 0);
    assert.equal(await cleanDb.Service.countDocuments(), 0);
  } finally { await cleanDb.connection.close(); }
  const bad = express();
  bad.use(
    createHubHandler(async () => {
      throw new Error("Missing deployment config");
    }),
  );
  const badServer = bad.listen(0, "127.0.0.1");
  await new Promise((r) => badServer.once("listening", r));
  const unavailable = await fetch(
    `http://127.0.0.1:${badServer.address().port}/hub-api/health`,
  );
  assert.equal(unavailable.status, 503);
  await new Promise((r) => badServer.close(r));
});
