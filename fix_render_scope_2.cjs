const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const oldCodeStart = "  function renderMediaPreviews() {\n    if (!elements.mediaPreviewContainer) return;";
const oldCodeEnd = "        renderMediaPreviews();\n      });\n    });\n  }";

const startIndex = content.lastIndexOf(oldCodeStart);
const endIndex = content.lastIndexOf(oldCodeEnd) + oldCodeEnd.length;

if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
  content = content.substring(0, startIndex) + content.substring(endIndex);
}

fs.writeFileSync('app.js', content, 'utf8');
