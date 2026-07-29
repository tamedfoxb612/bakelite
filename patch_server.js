const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const target = `// File upload endpoint for encrypted media
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

app.post('/api/upload', express.raw({ type: '*/*', limit: '100mb' }), (req, res) => {
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
});

app.use('/uploads', express.static(uploadsDir));`;

code = code.replace(target, '');
fs.writeFileSync('server.js', code);
