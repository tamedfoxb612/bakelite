const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const target = `  if (elements.statusBadge) {
    elements.statusBadge.className = 'status-badge online';
    elements.statusBadge.textContent = 'Online';
  }

  // Connect to Realtime Channel`;

const replacement = `  if (elements.statusBadge) {
    elements.statusBadge.className = 'status-badge online';
    elements.statusBadge.textContent = 'Online';
  }

  const headerRoomCode = document.getElementById('header-room-code');
  if (headerRoomCode) headerRoomCode.textContent = state.roomCode;

  // Crypto Setup
  await initMyKeyPair();
  const hasKey = await loadRoomKey(state.roomCode);

  // Connect to Realtime Channel`;

code = code.replace(target, replacement);

const target2 = `  // Load past history if connected to live DB
  loadPastMessages();
}`;

const replacement2 = `  // Load past history if connected to live DB
  loadPastMessages();
  
  if (!hasKey) {
     relaySend({
       type: 'key-request',
       sender: state.userName,
       publicKey: await crypto.subtle.exportKey('jwk', cryptoState.myKeyPair.publicKey)
     });
     setTimeout(() => {
        if (!cryptoState.isEncryptionReady) {
           generateRoomKey(state.roomCode);
        }
     }, 2000);
  }
}`;

code = code.replace(target2, replacement2);
fs.writeFileSync('app.js', code);
