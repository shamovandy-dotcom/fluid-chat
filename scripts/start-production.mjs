import { spawn } from "node:child_process";
import net from "node:net";

const processes = [];
let stopping = false;

function start(name, args, extraEnv = {}) {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...extraEnv },
    stdio: "inherit"
  });

  processes.push({ name, child });

  child.on("error", (error) => {
    console.error(`[${name}]`, error);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (!stopping) {
      console.error(
        `[${name}] stopped: code=${code}, signal=${signal}`
      );
      shutdown(code ?? 1);
    }
  });

  return child;
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;

  for (const { child } of processes) {
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGTERM");
    }
  }

  process.exitCode = code;
}

function portIsOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: "127.0.0.1",
      port
    });

    socket.setTimeout(1000);

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(port, name) {
  const deadline = Date.now() + 60000;

  while (!stopping && Date.now() < deadline) {
    const running = processes.some(
      ({ child }) => child.exitCode !== null
    );

    if (running) {
      throw new Error("A service stopped during startup");
    }

    if (await portIsOpen(port)) {
      console.log(`${name} is ready on port ${port}`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`${name} did not start on port ${port}`);
}

async function main() {
  start(
    "web",
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3000"
    ],
    { PORT: "3000" }
  );

  start(
    "realtime",
    ["--import", "tsx", "src/realtime/server.ts"],
    { REALTIME_PORT: "3001" }
  );

  await Promise.all([
    waitForPort(3000, "Next.js"),
    waitForPort(3001, "Realtime")
  ]);

  if (stopping) return;

  start("proxy", ["scripts/proxy.mjs"]);
  console.log("All Fluid Chat services started");
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

main().catch((error) => {
  console.error("Startup failed:", error);
  shutdown(1);
});
