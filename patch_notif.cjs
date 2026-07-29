const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const oldNotif = `  } else if (type === 'file') {
    showToast(\`📄 New file from \${sender || 'Partner'}\`, 'info');
    showNativeNotification(\`📄 \${sender || 'Partner'}\`, 'Sent a file');
  } else if (type === 'message') {`;

const newNotif = `  } else if (type === 'file' || type === 'p2p-file') {
    showToast(\`📄 New file from \${sender || 'Partner'}\`, 'info');
    showNativeNotification(\`📄 \${sender || 'Partner'}\`, 'Sent a file');
  } else if (type === 'message') {`;

content = content.replace(oldNotif, newNotif);
fs.writeFileSync('app.js', content, 'utf8');
