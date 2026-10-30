const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");

function build(folder, extraEnv) {
  const npm = process.env.npm_execpath;
  if (!npm)
    throw new Error(
      "Run this build using npm run build from the repository root.",
    );
  const result = spawnSync(process.execPath, [npm, "run", "build"], {
    cwd: path.join(root, folder),
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

build("frontend", { PATHLAB_BASE_PATH: "/pathlab/" });
build("business-portal", { VITE_HUB_API_BASE: "/hub-api" });
// This deletion is restricted to the generated repository-root dist directory.
if (path.resolve(output) !== path.join(root, "dist"))
  throw new Error("Unexpected build output path.");
fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(path.join(root, "business-portal", "dist"), output, {
  recursive: true,
});
fs.cpSync(path.join(root, "frontend", "dist"), path.join(output, "pathlab"), {
  recursive: true,
});
// Existing Lab templates use this public root asset. Keep those references intact.
fs.copyFileSync(
  path.join(root, "frontend", "public", "logo.jpg"),
  path.join(output, "logo.jpg"),
);
console.log(
  "\nUnified output ready: portal at /, original Path Lab at /pathlab/.",
);
