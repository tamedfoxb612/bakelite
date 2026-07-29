const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const target = `async function sendChatMessageText(text) {
  if (!text) return;

  const payload = {
    type: 'message',
    content: text,
    sender: state.userName,
    timestamp: new Date().toISOString()
  };

  appendFeedItem('message', text, 'You', new Date());

  relaySend(payload);

  if (state.supabase) {
    try {
      await state.supabase.from('messages').insert([{
        room_code: state.roomCode,
        type: 'message',
        content: \`\${state.userName}: \${text}\`
      }]);
    } catch (e) { /* ignore */ }
  }

  triggerRemotePushNotification(\`💌 \${state.userName}\`, text);
}`;

const replacement = `async function sendChatMessageText(text) {
  if (!text) return;

  const encryptedText = await encryptMessageContent(text);
  
  const payload = {
    type: 'message',
    content: encryptedText,
    sender: state.userName,
    timestamp: new Date().toISOString()
  };

  // We append plaintext to our own UI
  appendFeedItem('message', text, 'You', new Date());

  relaySend(payload);

  if (state.supabase) {
    try {
      await state.supabase.from('messages').insert([{
        room_code: state.roomCode,
        type: 'message',
        content: \`\${state.userName}: \${encryptedText}\`
      }]);
    } catch (e) { /* ignore */ }
  }

  triggerRemotePushNotification(\`💌 \${state.userName}\`, "Encrypted message");
}`;

code = code.replace(target, replacement);
fs.writeFileSync('app.js', code);
