import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist/client/vendor", { recursive: true });
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });

for (const file of ["index.html", "styles.css", "layout-fixes.css", "v2.css", "app.js"]) {
  await cp(file, `dist/client/${file}`);
}
await cp("vendor/three.min.js", "dist/client/vendor/three.min.js");
await cp("public/og.png", "dist/client/og.png");
await cp(".openai/hosting.json", "dist/.openai/hosting.json");

const worker = `export default { async fetch(request, env) {\n  const url = new URL(request.url);\n  if (url.pathname === \"/\") url.pathname = \"/index.html\";\n  const response = await env.ASSETS.fetch(new Request(url, request));\n  return response.status === 404 ? env.ASSETS.fetch(new Request(new URL(\"/index.html\", request.url), request)) : response;\n} };\n`;
await writeFile("dist/server/index.js", worker);

const html = await readFile("dist/client/index.html", "utf8");
if (!html.includes("LoadSpace v2")) throw new Error("v2 metadata missing");
console.log("LoadSpace v2 build complete");
