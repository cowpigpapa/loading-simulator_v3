import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
const root = process.cwd();
createServer(async (req, res) => {
  const relative = decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(/^\/+/, "") || "index.html";
  const file = normalize(join(root, relative));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try { await stat(file); res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" }); createReadStream(file).pipe(res); }
  catch { res.writeHead(404).end("Not found"); }
}).listen(Number(process.env.PORT)||4173, "127.0.0.1", function(){console.log(`Local: http://127.0.0.1:${this.address().port}`)});
