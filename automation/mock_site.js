import { createServer } from "node:http";

const port = 4174;

const html = `
<!DOCTYPE html>
<html>
<head><title>Mock Job Site</title></head>
<body>
  <div class="job-card">
    <div class="titleline"><a href="/job/1">Développeur Fullstack</a></div>
    <div class="company">Tech Corp</div>
  </div>
  <div class="job-card">
    <div class="titleline"><a href="/job/2">Agent Logistique</a></div>
    <div class="company">Logistix Inc</div>
  </div>
  <div class="job-card">
    <div class="titleline"><a href="/job/3">Analyste Data</a></div>
    <div class="company">Data Solutions</div>
  </div>
</body>
</html>
`;

createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
}).listen(port, () => {
  console.log(`Mock site running at http://localhost:${port}`);
});
