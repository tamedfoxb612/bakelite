const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const oldSigLogic = `  if (data.type === 'play-together') {`;

const newSigLogic = `  if (['file-offer', 'file-answer', 'file-ice-candidate'].includes(data.type)) {
    handleFileTransferSignaling(data);
    return;
  }
  if (data.type === 'play-together') {`;

content = content.replace(oldSigLogic, newSigLogic);
fs.writeFileSync('app.js', content, 'utf8');
