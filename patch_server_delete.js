const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const target = `app.post('/api/upload', express.raw({ type: '*/*', limit: '100mb' }), (req, res) => {
  const fileId = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const filePath = path.join(uploadsDir, fileId);
  fs.writeFileSync(filePath, req.body);
  res.json({ url: \`/uploads/\${fileId}\` });
});`;

const replacement = `app.post('/api/upload', express.raw({ type: '*/*', limit: '100mb' }), (req, res) => {
  const fileId = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const filePath = path.join(uploadsDir, fileId);
  fs.writeFileSync(filePath, req.body);
  res.json({ url: \`/uploads/\${fileId}\` });
});

app.post('/api/delete-media', (req, res) => {
  const { urls } = req.body;
  if (Array.isArray(urls)) {
    urls.forEach(url => {
      const fileName = url.replace('/uploads/', '');
      const filePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    });
  }
  res.json({ success: true });
});`;

code = code.replace(target, replacement);
fs.writeFileSync('server.js', code);
