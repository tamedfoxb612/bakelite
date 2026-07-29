const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

content = content.replace(/item\.innerHTML = \\`/g, 'item.innerHTML = `');

fs.writeFileSync('app.js', content, 'utf8');
