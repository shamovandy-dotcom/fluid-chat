import http from "node:http";

const host = "0.0.0.0";
const publicPort = Number(process.env.PORT ?? 10000);
const webPort = 3000;
const realtimePort = 3001;

function targetPort(url = "/") {
  const pathname = new URL(url, "http://localhost").pathname;

  if (
    pathname === "/socket.io" ||
    pathname.startsWith("/socket.io/") ||
    pathname === "/health" ||
    pathname === "/publish"
  ) {
    return realtimePort;
  }

  return webPort;
}

function forwardRequest(req, res, port) {
  const headers = {
    ...req.headers,
    "x-forwarded-host": req.headers["x-forwarded-host"] ?? req.headers.host ?? "",
    "x-forwarded-proto": req.headers["x-forwarded-proto"] ?? "https"
  };

  const proxyReq = http.request(
    {
      hostname: "127.0.0.1",
      port,
      method: req.method,
      path: req.url,
      headers
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", (error) => {
    console.error(`Proxy request failed on port ${port}:`, error.message);

    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    }

    if (!res.destroyed) {
      res.end("Upstream service unavailable");
    }
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  forwardRequest(req, res, targetPort(req.url));
});

server.on("upgrade", (req, socket, head) => {
  const port = targetPort(req.url);

  if (port !== realtimePort) {
    socket.destroy();
    return;
  }

  const proxyReq = http.request({
    hostname: "127.0.0.1",
    port,
    method: req.method,
    path: req.url,
    headers: {
      ...req.headers,
      "x-forwarded-host": req.headers["x-forwarded-host"] ?? req.headers.host ?? "",
      "x-forwarded-proto": req.headers["x-forwarded-proto"] ?? "https"
    }
  });

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    const status = proxyRes.statusCode ?? 101;
    const statusMessage = proxyRes.statusMessage ?? "Switching Protocols";

    socket.write(`HTTP/1.1 ${status} ${statusMessage}\r\n`);

    for (const [name, value] of Object.entries(proxyRes.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          socket.write(`${name}: ${item}\r\n`);
        }
      } else if (value !== undefined) {
        socket.write(`${name}: ${value}\r\n`);
      }
    }

    socket.write("\r\n");

    if (proxyHead.length) socket.write(proxyHead);
    if (head.length) proxySocket.write(head);

    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on("response", (proxyRes) => {
    socket.write(
      `HTTP/1.1 ${proxyRes.statusCode ?? 502} ${proxyRes.statusMessage ?? "Bad Gateway"}\r\n\r\n`
    );
    proxyRes.resume();
    socket.destroy();
  });

  proxyReq.on("error", (error) => {
    console.error("WebSocket proxy failed:", error.message);
    socket.destroy();
  });

  proxyReq.end();
});

server.listen(publicPort, host, () => {
  console.log(`Fluid Chat proxy listening on ${host}:${publicPort}`);
});
