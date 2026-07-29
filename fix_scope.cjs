const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

content = content.replace("  let selectedMediaFiles = [];", "");
content = content.replace("const state = {", "let selectedMediaFiles = [];\nconst state = {");

fs.writeFileSync('app.js', content, 'utf8');
