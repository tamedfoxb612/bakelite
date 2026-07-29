const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const oldIncomingLogic = `  if (type === 'heart') {
    showToast(\`❤️ Heart Page received from \${sender || 'Partner'}!\`, 'success');
    showNativeNotification(\`❤️ Heart Page!\`, \`\${sender || 'Partner'} sent you a giant heart!\`);
  } else if (type === 'message') {
    showToast(\`💌 New message from \${sender || 'Partner'}: "\${content}"\`, 'info');
    showNativeNotification(\`💌 \${sender || 'Partner'}\`, content);
  }
}`;

const newIncomingLogic = `  if (type === 'heart') {
    showToast(\`❤️ Heart Page received from \${sender || 'Partner'}!\`, 'success');
    showNativeNotification(\`❤️ Heart Page!\`, \`\${sender || 'Partner'} sent you a giant heart!\`);
  } else if (type === 'image') {
    showToast(\`📸 New image from \${sender || 'Partner'}\`, 'info');
    showNativeNotification(\`📸 \${sender || 'Partner'}\`, 'Sent an image');
  } else if (type === 'message') {
    showToast(\`💌 New message from \${sender || 'Partner'}: "\${content}"\`, 'info');
    showNativeNotification(\`💌 \${sender || 'Partner'}\`, content);
  }
}`;

content = content.replace(oldIncomingLogic, newIncomingLogic);
fs.writeFileSync('app.js', content, 'utf8');
