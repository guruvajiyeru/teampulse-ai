import { existsSync } from "fs";
import { execSync } from "child_process";
import { resolve } from "path";

const root = resolve();
const serverDir = resolve(root, "server");
const distFile = resolve(serverDir, "dist/server.cjs");

if (!existsSync(distFile)) {
  console.log("Backend dist not found. Installing backend dependencies and building server...");
  execSync("npm install", { cwd: serverDir, stdio: "inherit" });
  execSync("npm run build", { cwd: serverDir, stdio: "inherit" });
}

execSync("node dist/server.cjs", { cwd: serverDir, stdio: "inherit" });
