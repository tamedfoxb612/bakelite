const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const target = `function handleIncomingPayload(data) {
  if (!data) return;
  if (data.signaling || ['offer', 'answer', 'ice-candidate', 'call-invite', 'call-accept', 'call-decline', 'theme-change', 'cam-toggle', 'screen-share-toggle', 'toggle-circle-speech', 'end-call', 'clear-messages', 'clear-video-messages', 'play-together', 'arcade-input', 'arcade-mouse', 'arcade-chat-msg', 'leave-arcade', 'key-request', 'key-response'].includes(data.type)) {
    handleSignalingMessage(data);
    return;
  }
  const { type, content, sender, timestamp } = data;
  if (sender === state.userName) return; // ignore self broadcast echoes
  
  appendFeedItem(type, content, sender || 'Partner', new Date(timestamp || Date.now()));
  
  if (type === 'heart') {
    showToast(\`❤️ Heart Page received from \${sender || 'Partner'}!\`, 'success');
    showNativeNotification(\`❤️ Heart Page!\`, \`\${sender || 'Partner'} sent you a giant heart!\`);
  } else if (type === 'message') {
    showToast(\`💌 New message from \${sender || 'Partner'}: "\${content}"\`, 'info');
    showNativeNotification(\`💌 \${sender || 'Partner'}\`, content);
  }
}`;

const replacement = `async function handleIncomingPayload(data) {
  if (!data) return;
  if (data.signaling || ['offer', 'answer', 'ice-candidate', 'call-invite', 'call-accept', 'call-decline', 'theme-change', 'cam-toggle', 'screen-share-toggle', 'toggle-circle-speech', 'end-call', 'clear-messages', 'clear-video-messages', 'play-together', 'arcade-input', 'arcade-mouse', 'arcade-chat-msg', 'leave-arcade', 'key-request', 'key-response'].includes(data.type)) {
    handleSignalingMessage(data);
    return;
  }
  const { type, content, sender, timestamp } = data;
  if (sender === state.userName) return; // ignore self broadcast echoes
  
  let decryptedContent = content;
  if (type === 'message') {
     decryptedContent = await decryptMessageContent(content);
  } else if (type === 'media') {
     // content is the media URL or blob info
  }
  
  appendFeedItem(type, decryptedContent, sender || 'Partner', new Date(timestamp || Date.now()));
  
  if (type === 'heart') {
    showToast(\`❤️ Heart Page received from \${sender || 'Partner'}!\`, 'success');
    showNativeNotification(\`❤️ Heart Page!\`, \`\${sender || 'Partner'} sent you a giant heart!\`);
  } else if (type === 'message') {
    showToast(\`💌 New message from \${sender || 'Partner'}: "\${decryptedContent}"\`, 'info');
    showNativeNotification(\`💌 \${sender || 'Partner'}\`, decryptedContent);
  } else if (type === 'media') {
    showToast(\`📎 New media from \${sender || 'Partner'}\`, 'info');
    showNativeNotification(\`📎 \${sender || 'Partner'}\`, "Sent a file");
  }
}`;

code = code.replace(target, replacement);
fs.writeFileSync('app.js', code);
