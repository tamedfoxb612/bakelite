const fs = require('fs');
let code = fs.readFileSync('crypto.js', 'utf8');

const target = `  return 'E2EE:' + btoa(String.fromCharCode(...combined));`;
const replacement = `  let binary = '';
  for (let i = 0; i < combined.byteLength; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return 'E2EE:' + btoa(binary);`;
code = code.replace(target, replacement);

const target2 = `  return btoa(String.fromCharCode(...new Uint8Array(encryptedRoomKey)));`;
const replacement2 = `  let binary = '';
  const bytes = new Uint8Array(encryptedRoomKey);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);`;
code = code.replace(target2, replacement2);

fs.writeFileSync('crypto.js', code);
