const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// 1. handleMediaUpload
const mediaUploadRegex = /const handleMediaUpload = async \(e\) => \{[\s\S]*?e\.target\.value = '';\n  \};/;
const mediaUploadReplacement = `  const handleMediaUpload = async (e) => {
     const files = e.target.files;
     if (!files || files.length === 0) return;
     for (const file of files) {
        showToast('Encrypting and uploading...', 'info');
        const encryptedBlob = await encryptFile(file);
        
        const buffer = await encryptedBlob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
           binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);
        
        const fileId = \`\${Date.now()}-\${Math.round(Math.random() * 1E9)}\`;
        const chunkSize = 250000; // 250KB per chunk
        const totalChunks = Math.ceil(base64Data.length / chunkSize);
        
        if (state.supabase) {
           for (let i = 0; i < totalChunks; i++) {
              const chunkData = base64Data.slice(i * chunkSize, (i + 1) * chunkSize);
              const chunkPayload = JSON.stringify({ fileId, chunkIndex: i, totalChunks, data: chunkData });
              try {
                await state.supabase.from('messages').insert([{
                   room_code: state.roomCode,
                   type: 'media-chunk',
                   content: \`\${state.userName}: \${chunkPayload}\`
                }]);
              } catch(err) { console.error('Chunk upload error', err); }
           }
        }
        
        const payload = {
           type: 'media',
           content: JSON.stringify({ fileId, type: file.type, name: file.name }),
           sender: state.userName,
           timestamp: new Date().toISOString()
        };
        appendFeedItem('media', payload.content, 'You', new Date());
        relaySend(payload);
        
        if (state.supabase) {
           try {
             await state.supabase.from('messages').insert([{
               room_code: state.roomCode,
               type: 'media',
               content: \`\${state.userName}: \${payload.content}\`
             }]);
           } catch(e) {}
        }
     }
     e.target.value = '';
  };`;
code = code.replace(mediaUploadRegex, mediaUploadReplacement);

// 2. clearRoomMessages
const clearMessagesRegex = /async function clearRoomMessages\(broadcast = true\) \{[\s\S]*?sendSignaling\(\{ type: 'clear-messages', sender: state\.userName \}\);\n  \}\n\}/;
const clearMessagesReplacement = `async function clearRoomMessages(broadcast = true) {
  if (!elements.chatFeed) return;
  elements.chatFeed.innerHTML = '<div class="empty-feed">Room messages cleared.</div>';
  state.activitiesCount = 0;
  if (elements.feedCount) elements.feedCount.textContent = '0 messages';
  
  if (state.supabase && state.roomCode) {
    try {
      const { error } = await state.supabase.from('messages').delete().eq('room_code', state.roomCode);
      if (error) console.warn('Supabase delete error:', error);
    } catch (e) { console.warn(e); }
  }
  
  showToast('🧹 All room messages deleted!', 'success');
  
  if (broadcast) {
    sendSignaling({ type: 'clear-messages', sender: state.userName });
  }
}`;
code = code.replace(clearMessagesRegex, clearMessagesReplacement);

// 3. fetchMediaBlob & downloadEncryptedMedia
const fetchBlobHelper = `
window.fetchMediaBlob = async (fileId, originalType) => {
   if (!state.supabase) return null;
   try {
       const { data, error } = await state.supabase
           .from('messages')
           .select('content')
           .eq('room_code', state.roomCode)
           .eq('type', 'media-chunk')
           .like('content', \`%\${fileId}%\`);
       
       if (error || !data) return null;
       
       const chunks = [];
       for (const row of data) {
           try {
               const cleanContent = row.content.replace(/^.*?: /, '');
               const parsed = JSON.parse(cleanContent);
               if (parsed.fileId === fileId) {
                   chunks.push(parsed);
               }
           } catch(e) {}
       }
       chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
       
       let base64Data = '';
       for (const c of chunks) {
           base64Data += c.data;
       }
       
       const binaryStr = atob(base64Data);
       const bytes = new Uint8Array(binaryStr.length);
       for (let i = 0; i < binaryStr.length; i++) {
           bytes[i] = binaryStr.charCodeAt(i);
       }
       return new Blob([bytes], { type: 'application/octet-stream' });
   } catch(e) {
       console.error('fetchMediaBlob error:', e);
       return null;
   }
};

window.downloadEncryptedMedia = async (fileId, type, name) => {
   try {
       showToast('Fetching and decrypting download...', 'info');
       const blob = await fetchMediaBlob(fileId, type);
       if (!blob) throw new Error('Blob not found');
       const decryptedBlob = await decryptFile(blob, type);
       const objUrl = URL.createObjectURL(decryptedBlob);
       const a = document.createElement('a');
       a.href = objUrl;
       a.download = name;
       a.click();
       URL.revokeObjectURL(objUrl);
   } catch(e) {
       showToast('Decryption failed', 'error');
   }
};
`;

code = code.replace(/window\.downloadEncryptedMedia = async \(url, type, name\) => \{[\s\S]*?\};\n/, fetchBlobHelper);

// 4. Update the appendFeedItem logic to use fileId instead of URL
const appendFeedRegex = /const res = await fetch\(meta\.url\);\n\s*const blob = await res\.blob\(\);/g;
const appendFeedReplacement = `const blob = await fetchMediaBlob(meta.fileId, meta.type);\n                  if (!blob) throw new Error('Blob not found');`;
code = code.replace(appendFeedRegex, appendFeedReplacement);

const onclickRegex = /downloadEncryptedMedia\('\${meta\.url}',/g;
code = code.replace(onclickRegex, `downloadEncryptedMedia('\${meta.fileId}',`);

// 5. In loadPastMessages, ignore 'media-chunk'
const loadPastMessagesRegex = /\.eq\('room_code', state\.roomCode\)\n\s*\.order\('created_at', \{ ascending: true \}\)/;
code = code.replace(loadPastMessagesRegex, `.eq('room_code', state.roomCode)\n      .neq('type', 'media-chunk')\n      .order('created_at', { ascending: true })`);

// Also ignore 'media-chunk' in handleIncomingPayload just in case
const handleIncomingPayloadRegex = /if \(sender === state\.userName\) return; \/\/ ignore self broadcast echoes/;
code = code.replace(handleIncomingPayloadRegex, `if (sender === state.userName) return; // ignore self broadcast echoes\n  if (type === 'media-chunk') return;`);

fs.writeFileSync('app.js', code);
