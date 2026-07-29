const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const target = `async function clearRoomMessages(broadcast = true) {
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

const replacement = `async function clearRoomMessages(broadcast = true) {
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

code = code.replace(target, replacement);
fs.writeFileSync('app.js', code);
