/* global URL, console, process */

import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = await realpath(
  resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
);
const allowedRoutes = await Promise.all(
  [
    ["/examples/at-fixture/", "examples/at-fixture"],
    ["/packages/core/dist/", "packages/core/dist"],
    ["/packages/dom/dist/", "packages/dom/dist"],
  ].map(async ([route, path]) => ({
    route,
    root: await realpath(resolve(repositoryRoot, path)),
  })),
);
const argumentPort = process.argv
  .find((argument) => argument.startsWith("--port="))
  ?.slice("--port=".length);
const requestedPort = Number(argumentPort ?? process.env.AT_FIXTURE_PORT ?? 0);

if (
  !Number.isInteger(requestedPort) ||
  requestedPort < 0 ||
  requestedPort > 65_535
) {
  throw new RangeError("port must be an integer from 0 to 65535");
}

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function withinRoot(path, root) {
  return path === root || path.startsWith(`${root}${sep}`);
}

async function resolveRequestPath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(requestUrl, "http://fixture.test").pathname,
    );
  } catch {
    return { status: 400 };
  }
  if (pathname.includes("\0")) return { status: 400 };

  const allowed = allowedRoutes.find(({ route }) => pathname.startsWith(route));
  if (!allowed) return { status: 404 };

  const candidate = resolve(repositoryRoot, `.${pathname}`);
  if (!withinRoot(candidate, allowed.root)) return { status: 404 };

  let selected = candidate;
  try {
    const details = await stat(selected);
    if (details.isDirectory()) selected = resolve(selected, "index.html");
    const canonical = await realpath(selected);
    if (!withinRoot(canonical, allowed.root)) return { status: 404 };
    const fileDetails = await stat(canonical);
    if (!fileDetails.isFile()) return { status: 404 };
    return { status: 200, path: canonical, size: fileDetails.size };
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return { status: 404 };
    }
    throw error;
  }
}

const server = createServer(async (request, response) => {
  const hostname = request.headers.host?.replace(/:\d+$/u, "").toLowerCase();
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    response.writeHead(421, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Misdirected request\n");
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed\n");
    return;
  }

  try {
    const selected = await resolveRequestPath(request.url ?? "/");
    if (selected.status !== 200) {
      response.writeHead(selected.status, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end(`${selected.status}\n`);
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": selected.size,
      "Content-Type":
        mimeTypes.get(extname(selected.path)) ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method === "HEAD") response.end();
    else {
      try {
        await pipeline(createReadStream(selected.path), response);
      } catch (error) {
        if (!response.destroyed) response.destroy();
        console.error(error);
      }
    }
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal server error\n");
    console.error(error);
  }
});

await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(requestedPort, "127.0.0.1", resolveListen);
});

const address = server.address();
if (!address || typeof address === "string")
  throw new Error("server address unavailable");
console.log(`AT fixture server listening at http://127.0.0.1:${address.port}`);

let closing = false;
function close() {
  if (closing) return;
  closing = true;
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", close);
process.once("SIGTERM", close);
