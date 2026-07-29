const DB_NAME = 'B612_CryptoDB';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('keys')) {
        db.createObjectStore('keys', { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveKeyToDB(id, keyData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keys', 'readwrite');
    const store = tx.objectStore('keys');
    const request = store.put({ id, keyData });
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getKeyFromDB(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keys', 'readonly');
    const store = tx.objectStore('keys');
    const request = store.get(id);
    request.onsuccess = (e) => resolve(e.target.result ? e.target.result.keyData : null);
    request.onerror = (e) => reject(e.target.error);
  });
}

const cryptoState = {
  myKeyPair: null,
  roomKey: null,
  isEncryptionReady: false
};

async function initMyKeyPair() {
  if (!window.crypto || !window.crypto.subtle) {
    console.warn("Web Crypto API not supported");
    return;
  }
  const savedPair = await getKeyFromDB('my_rsa_keypair');
  if (savedPair) {
    cryptoState.myKeyPair = {
      publicKey: await crypto.subtle.importKey('jwk', savedPair.publicKeyJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']),
      privateKey: await crypto.subtle.importKey('jwk', savedPair.privateKeyJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt'])
    };
  } else {
    cryptoState.myKeyPair = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt']
    );
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', cryptoState.myKeyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', cryptoState.myKeyPair.privateKey);
    await saveKeyToDB('my_rsa_keypair', { publicKeyJwk, privateKeyJwk });
  }
}

async function generateRoomKey(roomCode) {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  cryptoState.roomKey = key;
  const rawKey = await crypto.subtle.exportKey('raw', key);
  await saveKeyToDB(`room_key_${roomCode}`, rawKey);
  cryptoState.isEncryptionReady = true;
  updateEncryptionUI();
  return key;
}

async function loadRoomKey(roomCode) {
  const rawKey = await getKeyFromDB(`room_key_${roomCode}`);
  if (rawKey) {
    cryptoState.roomKey = await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
    cryptoState.isEncryptionReady = true;
    updateEncryptionUI();
    return true;
  }
  return false;
}

async function saveReceivedRoomKey(roomCode, encryptedKeyBase64) {
  const encryptedKeyBytes = Uint8Array.from(atob(encryptedKeyBase64), c => c.charCodeAt(0));
  const rawKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    cryptoState.myKeyPair.privateKey,
    encryptedKeyBytes
  );
  cryptoState.roomKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
  await saveKeyToDB(`room_key_${roomCode}`, rawKey);
  cryptoState.isEncryptionReady = true;
  updateEncryptionUI();
}

async function handleKeyRequest(senderPublicKeyJwk, targetUser) {
  if (!cryptoState.isEncryptionReady || !cryptoState.roomKey) return null;
  const importedPubKey = await crypto.subtle.importKey(
    'jwk',
    senderPublicKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  );
  const rawRoomKey = await crypto.subtle.exportKey('raw', cryptoState.roomKey);
  const encryptedRoomKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    importedPubKey,
    rawRoomKey
  );
  let binary = '';
  const bytes = new Uint8Array(encryptedRoomKey);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function encryptMessageContent(text) {
  if (!cryptoState.isEncryptionReady || !cryptoState.roomKey) return text;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    cryptoState.roomKey,
    encoded
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  let binary = '';
  for (let i = 0; i < combined.byteLength; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return 'E2EE:' + btoa(binary);
}

async function decryptMessageContent(encryptedText) {
  if (!encryptedText || !encryptedText.startsWith('E2EE:')) return encryptedText;
  if (!cryptoState.isEncryptionReady || !cryptoState.roomKey) return '🔒 [Encrypted Message]';
  try {
    const b64 = encryptedText.substring(5);
    const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoState.roomKey,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error('Decryption failed', e);
    return '🔒 [Decryption Failed]';
  }
}

async function encryptFile(file) {
  if (!cryptoState.isEncryptionReady || !cryptoState.roomKey) return file;
  const arrayBuffer = await file.arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    cryptoState.roomKey,
    arrayBuffer
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  // Return a Blob combining original file info but encrypted content
  return new Blob([combined], { type: 'application/octet-stream' });
}

async function decryptFile(blob, originalType) {
  if (!cryptoState.isEncryptionReady || !cryptoState.roomKey) return blob;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const combined = new Uint8Array(arrayBuffer);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoState.roomKey,
      ciphertext
    );
    return new Blob([decrypted], { type: originalType || 'application/octet-stream' });
  } catch (e) {
    console.error('File decryption failed', e);
    return blob;
  }
}

function updateEncryptionUI() {
  const icon = document.getElementById('encryption-status-icon');
  if (icon) {
    if (cryptoState.isEncryptionReady) {
      icon.textContent = '✅';
      icon.className = 'encryption-icon active';
      icon.setAttribute('aria-label', 'End-to-end encrypted');
      icon.setAttribute('title', 'End-to-end encrypted');
      icon.style.color = '#10b981';
      icon.style.cursor = 'help';
    } else {
      icon.textContent = '⏳';
      icon.className = 'encryption-icon pending';
      icon.setAttribute('aria-label', 'Encrypting...');
      icon.setAttribute('title', 'Encrypting...');
      icon.style.color = '#9ca3af';
    }
  }
}
if (!window.crypto || !window.crypto.subtle) {
  setTimeout(() => showToast("Encryption unsupported in this browser. Messages will be sent in plaintext.", "error", 8000), 1000);
}
