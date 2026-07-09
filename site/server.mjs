import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const root = fileURLToPath(new URL(".", import.meta.url));
const port = process.env.PORT ? Number(process.env.PORT) : 4173;
const host = process.env.HOST || "0.0.0.0";
const DB_PATH = join(root, "..", "database", "jobhunter.db");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

async function getDb() {
    return await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
}

function safePath(urlPath) {
  const cleaned = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  return cleaned === "/" ? "/index.html" : cleaned;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // API Routes
  if (pathname === "/api/jobs" && req.method === "GET") {
    try {
      const db = await getDb();
      const jobs = await db.all('SELECT * FROM jobs ORDER BY created_at DESC');
      await db.close();
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(jobs));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Error reading database");
    }
    return;
  }
...

  if (pathname === "/api/jobs" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", async () => {
      try {
        const { title, company, link, country, score, letter, analysis } = JSON.parse(body);
        
        if (!title || !company) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Missing required fields");
          return;
        }

        const db = await getDb();
        await db.run(
          'INSERT INTO jobs (title, company, link, country, score, letter, analysis) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [title, company, link, country, score, letter, analysis]
        );
        await db.close();
        
        res.writeHead(201, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Invalid JSON");
      }
    });
    return;
  }

  // Static File Serving
  try {
    const target = safePath(pathname);
    const filePath = join(root, target);
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}).listen(port, host, () => {
  console.log(`JobHunter-AI site running on http://${host}:${port}`);
});

