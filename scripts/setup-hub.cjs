require("dotenv").config();
const { pathToFileURL } = require("node:url");
const path = require("node:path");

async function main() {
  const uri = process.env.HUB_MONGODB_URI || process.env.MONGODB_URI;
  const database = process.env.HUB_MONGODB_DATABASE || "business_portal";
  if (!uri)
    throw new Error(
      "Set HUB_MONGODB_URI for the separate Business Hub database.",
    );
  const { openStore, bootstrap } = await import(
    pathToFileURL(path.join(__dirname, "../business-portal/server/store.js"))
      .href
  );
  const db = await openStore(uri, database);
  try {
    const existingOwner = await db.User.exists({ role: "owner" });
    if (
      !existingOwner &&
      (!process.env.HUB_OWNER_EMAIL ||
        (process.env.HUB_OWNER_PASSWORD || "").length < 12)
    )
      throw new Error(
        "Set HUB_OWNER_EMAIL and HUB_OWNER_PASSWORD (at least 12 characters) for first setup.",
      );
    await bootstrap(db, {
      email: process.env.HUB_OWNER_EMAIL,
      password: process.env.HUB_OWNER_PASSWORD,
      seedCatalog: process.argv.includes("--demo"),
    });
    console.log(
      `Business Hub setup complete in ${database}. Existing accounts are preserved. No Path Lab data was modified.`,
    );
  } finally {
    await db.connection.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
