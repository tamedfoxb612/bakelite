const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Replace handleMediaUpload
const mediaUploadTarget = `  const handleMediaUpload = async (e) => {
     const files = e.target.files;
     if (!files || files.length === 0) return;
     for (const file of files) {
        showToast('Encrypting and uploading...', 'info');
        const encryptedBlob = await encryptFile(file);
        const response = await fetch('/api/upload', {
           method: 'POST',
           body: encryptedBlob,
           headers: { 'Content-Type': file.type || 'application/octet-stream' }
        });
        if (response.ok) {
           const result = await response.json();
           const payload = {
              type: 'media',
              content: JSON.stringify({ url: result.url, type: file.type, name: file.name }),
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
        } else {
           showToast('Upload failed', 'error');
        }
     }
     e.target.value = '';
  };`;

const mediaUploadReplacement = `  const handleMediaUpload = async (e) => {
     const files = e.target.files;
     if (!files || files.length === 0) return;
     for (const file of files) {
        showToast('Encrypting and uploading...', 'info');
        const encryptedBlob = await encryptFile(file);
        const fileName = \`\${Date.now()}-\${Math.round(Math.random() * 1E9)}\`;
        
        if (state.supabase) {
           const { data, error } = await state.supabase.storage.from('chat-media').upload(fileName, encryptedBlob, {
              contentType: file.type || 'application/octet-stream',
              upsert: false
           });
           
           if (error) {
              console.error(error);
              showToast('Upload to Supabase failed', 'error');
              continue;
           }
           
           const { data: urlData } = state.supabase.storage.from('chat-media').getPublicUrl(fileName);
           const fileUrl = urlData.publicUrl;
           
           const payload = {
              type: 'media',
              content: JSON.stringify({ url: fileUrl, path: fileName, type: file.type, name: file.name }),
              sender: state.userName,
              timestamp: new Date().toISOString()
           };
           appendFeedItem('media', payload.content, 'You', new Date());
           relaySend(payload);
           
           try {
             await state.supabase.from('messages').insert([{
               room_code: state.roomCode,
               type: 'media',
               content: \`\${state.userName}: \${payload.content}\`
             }]);
           } catch(e) {}
        } else {
           showToast('Supabase is not configured', 'error');
        }
     }
     e.target.value = '';
  };`;
code = code.replace(mediaUploadTarget, mediaUploadReplacement);

// Replace clearRoomMessages
const clearMessagesTarget = `async function clearRoomMessages(broadcast = true) {
  if (!elements.chatFeed) return;
  elements.chatFeed.innerHTML = '<div class="empty-feed">Room messages cleared.</div>';
  state.activitiesCount = 0;
  if (elements.feedCount) elements.feedCount.textContent = '0 messages';
  if (state.supabase && state.roomCode) {
    try {
      // First, get all messages to find media URLs for deletion
      const { data: messages } = await state.supabase.from('messages').select('type, content').eq('room_code', state.roomCode);
      const mediaUrls = [];
      if (messages) {
        for (const msg of messages) {
          if (msg.type === 'media') {
             try {
                const cleanContent = msg.content.replace(/^.*?: /, '');
                const meta = JSON.parse(cleanContent);
                if (meta.url) mediaUrls.push(meta.url);
             } catch(e) {}
          }
        }
      }
      
      // Delete media files from server
      if (mediaUrls.length > 0) {
        await fetch('/api/delete-media', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ urls: mediaUrls })
        });
      }
      
      const { error } = await state.supabase.from('messages').delete().eq('room_code', state.roomCode);
      if (error) console.warn('Supabase delete error:', error);
    } catch (e) { console.warn(e); }
  }
  showToast('🧹 All room messages deleted!', 'success');
  if (broadcast) {
    sendSignaling({ type: 'clear-messages', sender: state.userName });
  }
}`;

const clearMessagesReplacement = `async function clearRoomMessages(broadcast = true) {
  if (!elements.chatFeed) return;
  elements.chatFeed.innerHTML = '<div class="empty-feed">Room messages cleared.</div>';
  state.activitiesCount = 0;
  if (elements.feedCount) elements.feedCount.textContent = '0 messages';
  
  if (state.supabase && state.roomCode) {
    try {
      // First, get all messages to find media paths for deletion
      const { data: messages } = await state.supabase.from('messages').select('type, content').eq('room_code', state.roomCode);
      const mediaPaths = [];
      
      if (messages) {
        for (const msg of messages) {
          if (msg.type === 'media') {
             try {
                const cleanContent = msg.content.replace(/^.*?: /, '');
                const meta = JSON.parse(cleanContent);
                if (meta.path) mediaPaths.push(meta.path);
             } catch(e) {}
          }
        }
      }
      
      // Delete media files from Supabase Storage
      if (mediaPaths.length > 0) {
        const { error: storageError } = await state.supabase.storage.from('chat-media').remove(mediaPaths);
        if (storageError) console.warn('Supabase storage delete error:', storageError);
      }
      
      // Delete from messages table
      const { error } = await state.supabase.from('messages').delete().eq('room_code', state.roomCode);
      if (error) console.warn('Supabase delete error:', error);
      
    } catch (e) { console.warn(e); }
  }
  
  showToast('🧹 All room messages deleted!', 'success');
  
  if (broadcast) {
    sendSignaling({ type: 'clear-messages', sender: state.userName });
  }
}`;
code = code.replace(clearMessagesTarget, clearMessagesReplacement);

fs.writeFileSync('app.js', code);
