import { fork, ChildProcess } from "child_process";
import path from "path";
import { app } from "electron";
import http from "http";

let serverProcess: ChildProcess | null = null;

function findFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = http.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 3000;
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(port: number, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("Server startup timeout"));
      }
      const req = http.get(`http://127.0.0.1:${port}/api/filters`, (res) => {
        // Any HTTP response means the server is running (DB errors are handled by the UI)
        resolve();
        res.resume();
      });
      req.on("error", () => setTimeout(check, 300));
    }
    check();
  });
}

export async function startNextServer(env: Record<string, string>): Promise<number> {
  const port = await findFreePort();
  const isProd = app.isPackaged;

  if (isProd) {
    // Production: run the standalone server.js
    const serverPath = path.join(process.resourcesPath!, "standalone", "server.js");

    serverProcess = fork(serverPath, [], {
      env: {
        ...process.env,
        ...env,
        NODE_ENV: "production",
        PORT: String(port),
        HOSTNAME: "127.0.0.1",
      },
      stdio: "pipe",
    });
  } else {
    // Dev: run next dev via the CLI
    const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");

    serverProcess = fork(nextBin, ["dev", "--port", String(port)], {
      env: {
        ...process.env,
        ...env,
        PORT: String(port),
      },
      stdio: "pipe",
      cwd: process.cwd(),
    });
  }

  serverProcess.stdout?.on("data", (data: Buffer) => {
    console.log(`[next] ${data.toString().trim()}`);
  });

  serverProcess.stderr?.on("data", (data: Buffer) => {
    console.error(`[next] ${data.toString().trim()}`);
  });

  await waitForServer(port);
  console.log(`Next.js server ready on http://127.0.0.1:${port}`);
  return port;
}

export function stopNextServer(): void {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}
