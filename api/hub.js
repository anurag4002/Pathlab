// Business Hub only. Path Lab continues to use its original api/index.js entry.
function createHubHandler(loadApp) {
  return async function hubHandler(req, res) {
    try {
      const app = await loadApp();
      // Express keeps its existing internal /api routes; only the public namespace differs.
      const original = req.url;
      if (!/^\/hub-api(?:\/|\?|$)/.test(original || "")) {
        return res.status(404).json({ error: "Use the /hub-api endpoints." });
      }
      req.url = original.replace(/^\/hub-api(?=\/|\?|$)/, "/api");
      return app(req, res);
    } catch (error) {
      console.error("Business Hub initialization failed:", error.message);
      return res
        .status(503)
        .json({
          error:
            "Business Hub is not configured yet. Check its database and run the setup script.",
        });
    }
  };
}

const handler = createHubHandler(async () => {
  const { getHubApp } = await import("../business-portal/server/runtime.js");
  return getHubApp();
});
module.exports = handler;
module.exports.createHubHandler = createHubHandler;
