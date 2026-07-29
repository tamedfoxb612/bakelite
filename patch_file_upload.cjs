const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const oldCheck = `      if (!isImage && file.size > 1024 * 1024) {
        showToast(\`File \${file.name} is too large (max 1MB for files).\`, 'error');
        continue;
      }`;

const newCheck = `      if (file.size > 100 * 1024 * 1024) {
        showToast(\`File \${file.name} is too large (max 100MB).\`, 'error');
        continue;
      }`;

content = content.replace(oldCheck, newCheck);

const oldImgCheck = `        if (isImage) {`;

const newImgCheck = `        if (isImage && file.size <= 1024 * 1024) {`;

content = content.replace(oldImgCheck, newImgCheck);

const oldElseCheck = `        } else {
          selectedMediaFiles.push({ file, dataUrl, type: 'file' });
          renderMediaPreviews();
        }`;

const newElseCheck = `        } else {
          selectedMediaFiles.push({ file, dataUrl, type: isImage ? 'image' : 'file' });
          renderMediaPreviews();
        }`;

content = content.replace(oldElseCheck, newElseCheck);

fs.writeFileSync('app.js', content, 'utf8');
