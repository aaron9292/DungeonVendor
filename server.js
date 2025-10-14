const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 5173;
const root = __dirname;

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
  let filePath = path.join(root, req.url.split('?')[0]);
  if (req.url === '/' || req.url === '') filePath = path.join(root, 'index.html');

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      res.end(content);
    }
  });
});

server.listen(port, () => {
  console.log(`Dungeon Vendor running at http://localhost:${port}`);
});
