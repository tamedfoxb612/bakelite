const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const ftmLogic = `
// ==========================================
// WebRTC P2P File Transfer Logic
// ==========================================
const dbName = 'B612FilesDB';
const storeName = 'files';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'fileId' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveFileToDB(fileRecord) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(fileRecord);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getFileFromDB(fileId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(fileId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const FileTransfers = {
  connections: {}, // peerName -> RTCPeerConnection
  dataChannels: {}, // peerName -> RTCDataChannel
  receivers: {}, // fileId -> state
  chunkSize: 16384 // 16KB
};

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getOnlinePeers() {
  if (!state.presenceState) return [];
  const peers = [];
  for (const key of Object.keys(state.presenceState)) {
    if (key !== state.userName) {
      peers.push(key);
    }
  }
  return peers;
}

async function handleFileTransferSignaling(data) {
  const peer = data.sender;
  if (!peer) return;

  if (data.type === 'file-offer') {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    FileTransfers.connections[peer] = pc;
    
    pc.ondatachannel = (event) => {
      setupFileTransferDataChannel(event.channel, peer);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignaling({ type: 'file-ice-candidate', sender: state.userName, target: peer, candidate: e.candidate });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    sendSignaling({ type: 'file-answer', sender: state.userName, target: peer, answer: answer });
  } 
  else if (data.type === 'file-answer') {
    const pc = FileTransfers.connections[peer];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  } 
  else if (data.type === 'file-ice-candidate') {
    const pc = FileTransfers.connections[peer];
    if (pc) {
      pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(e => console.error(e));
    }
  }
}

function setupFileTransferDataChannel(dc, peer) {
  FileTransfers.dataChannels[peer] = dc;
  dc.binaryType = 'arraybuffer';
  
  let currentFileId = null;

  dc.onmessage = async (e) => {
    if (typeof e.data === 'string') {
      try {
        const msg = JSON.parse(e.data);
        if (msg.fileId && msg.fileName && msg.fileType) {
          // Metadata message
          currentFileId = msg.fileId;
          FileTransfers.receivers[currentFileId] = {
            fileId: msg.fileId,
            fileName: msg.fileName,
            fileType: msg.fileType,
            fileSize: msg.fileSize,
            totalChunks: msg.totalChunks,
            receivedChunks: [],
            receivedCount: 0
          };
          updateTransferProgress(msg.fileId, 0, 'Receiving...');
        } else if (msg.status === 'complete' && msg.fileId) {
          // Complete message
          const transfer = FileTransfers.receivers[msg.fileId];
          if (transfer) {
            const blob = new Blob(transfer.receivedChunks, { type: transfer.fileType });
            await saveFileToDB({
              fileId: transfer.fileId,
              fileName: transfer.fileName,
              fileType: transfer.fileType,
              fileSize: transfer.fileSize,
              blob: blob,
              receivedAt: new Date().toISOString()
            });
            delete FileTransfers.receivers[msg.fileId];
            updateTransferProgress(msg.fileId, 100, 'Complete');
            setTimeout(() => {
              const el = document.getElementById(\`progress-\${msg.fileId}\`);
              if (el) el.remove();
            }, 3000);
            
            // UI refresh logic here handled by appendFeedItem automatically catching up
            // actually, we don't need to append feed item here, since the metadata message broadcasted via Realtime will do it.
            // Wait, we need to refresh the UI for the specific file bubble.
            const bubble = document.querySelector(\`[data-file-id="\${msg.fileId}"]\`);
            if (bubble) {
               renderFileBubbleContent(bubble, msg.fileId);
            }
          }
        }
      } catch (err) {
        console.error('Failed to parse DataChannel string message:', err);
      }
    } else if (e.data instanceof ArrayBuffer) {
      if (currentFileId) {
        const transfer = FileTransfers.receivers[currentFileId];
        if (transfer) {
          transfer.receivedChunks.push(e.data);
          transfer.receivedCount++;
          const percent = Math.floor((transfer.receivedCount / transfer.totalChunks) * 100);
          updateTransferProgress(currentFileId, percent, 'Receiving...');
        }
      }
    }
  };

  dc.onclose = () => {
    delete FileTransfers.dataChannels[peer];
    delete FileTransfers.connections[peer];
  };
}

async function startP2PConnection(peer) {
  if (FileTransfers.connections[peer] && FileTransfers.dataChannels[peer] && FileTransfers.dataChannels[peer].readyState === 'open') {
    return FileTransfers.dataChannels[peer];
  }

  return new Promise(async (resolve, reject) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    FileTransfers.connections[peer] = pc;
    
    const dc = pc.createDataChannel('file-transfer');
    setupFileTransferDataChannel(dc, peer);

    let timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, 5000);

    dc.onopen = () => {
      clearTimeout(timeout);
      resolve(dc);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignaling({ type: 'file-ice-candidate', sender: state.userName, target: peer, candidate: e.candidate });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignaling({ type: 'file-offer', sender: state.userName, target: peer, offer: offer });
  });
}

function updateTransferProgress(fileId, percent, text) {
  let container = document.getElementById('transfer-progress-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'transfer-progress-container';
    container.style.position = 'fixed';
    container.style.bottom = '80px';
    container.style.right = '20px';
    container.style.zIndex = '1000';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    document.body.appendChild(container);
  }

  let el = document.getElementById(\`progress-\${fileId}\`);
  if (!el) {
    el = document.createElement('div');
    el.id = \`progress-\${fileId}\`;
    el.className = 'transfer-progress-toast';
    el.style.background = 'var(--card-bg)';
    el.style.color = 'var(--text-main)';
    el.style.padding = '8px 12px';
    el.style.borderRadius = '8px';
    el.style.border = '1px solid var(--border-color)';
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    el.style.fontSize = '0.85rem';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.gap = '8px';
    
    el.innerHTML = \`
      <div style="flex:1;">
        <div style="margin-bottom:4px; font-weight:500;">\${text}</div>
        <div style="height:4px; background:var(--surface-light); border-radius:2px; overflow:hidden;">
          <div class="progress-bar" style="height:100%; width:0%; background:var(--primary); transition:width 0.1s;"></div>
        </div>
      </div>
      <div class="progress-text">0%</div>
    \`;
    container.appendChild(el);
  }

  el.querySelector('.progress-bar').style.width = \`\${percent}%\`;
  el.querySelector('.progress-text').innerText = \`\${percent}%\`;
}

async function sendFileWebRTC(file, peer) {
  try {
    const dc = await startP2PConnection(peer);
    
    const fileId = generateUUID();
    const buffer = await file.arrayBuffer();
    const totalChunks = Math.ceil(buffer.byteLength / FileTransfers.chunkSize);
    
    const metadata = {
      fileId: fileId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      totalChunks: totalChunks
    };
    
    dc.send(JSON.stringify(metadata));
    
    // Save locally for ourselves as well
    const blob = new Blob([buffer], { type: file.type });
    await saveFileToDB({
      fileId: fileId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      blob: blob,
      receivedAt: new Date().toISOString()
    });

    let offset = 0;
    let chunkCount = 0;

    const sendNextChunk = () => {
      while (offset < buffer.byteLength) {
        if (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
          dc.onbufferedamountlow = () => {
            dc.onbufferedamountlow = null;
            sendNextChunk();
          };
          return;
        }

        const chunk = buffer.slice(offset, offset + FileTransfers.chunkSize);
        dc.send(chunk);
        
        offset += FileTransfers.chunkSize;
        chunkCount++;
        const percent = Math.floor((chunkCount / totalChunks) * 100);
        updateTransferProgress(fileId, percent, \`Sending to \${peer}...\`);
      }

      if (offset >= buffer.byteLength) {
        dc.send(JSON.stringify({ fileId: fileId, status: 'complete' }));
        updateTransferProgress(fileId, 100, 'Sent successfully');
        setTimeout(() => {
          const el = document.getElementById(\`progress-\${fileId}\`);
          if (el) el.remove();
        }, 3000);
      }
    };
    
    // Announce file in chat
    const payload = {
      type: 'p2p-file',
      content: \`\${file.name}|\${fileId}|\${file.size}\`,
      sender: state.userName,
      timestamp: new Date().toISOString()
    };
    appendFeedItem('p2p-file', payload.content, 'You', new Date());
    relaySend(payload);
    
    if (state.supabase) {
      state.supabase.from('messages').insert([{
        room_code: state.roomCode,
        type: 'p2p-file',
        content: \`\${state.userName}: \${file.name}|\${fileId}|\${file.size}\`
      }]).catch(e => console.error(e));
    }

    dc.bufferedAmountLowThreshold = 65536;
    sendNextChunk();

  } catch (err) {
    console.error('Failed to send file via WebRTC:', err);
    showToast(\`Could not connect to \${peer}, try again\`, 'error');
  }
}
`;

content += '\n' + ftmLogic;
fs.writeFileSync('app.js', content, 'utf8');
