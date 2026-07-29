const fs = require('fs');
let code = fs.readFileSync('crypto.js', 'utf8');
code = code.replace(/if \(!window.crypto \|\| !window.crypto.subtle\) {\n  alert\("Encryption unsupported in this browser. Messages will be sent in plaintext."\);\n}/, `if (!window.crypto || !window.crypto.subtle) {
  setTimeout(() => showToast("Encryption unsupported in this browser. Messages will be sent in plaintext.", "error", 8000), 1000);
}`);
fs.writeFileSync('crypto.js', code);
