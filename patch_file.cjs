const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const oldHeartLogic = `function handleRoomHeartClick(e) {
  if (e) e.preventDefault();
  const text = elements.messageInput?.value.trim();
  
  if (typeof selectedMediaFiles !== 'undefined' && selectedMediaFiles.length > 0) {
    for (const media of selectedMediaFiles) {
       sendChatImageMessage(media.dataUrl);
    }
    selectedMediaFiles.length = 0; // clear array
    if (typeof renderMediaPreviews === 'function') renderMediaPreviews();
    
    if (text) {
      sendChatMessageText(text);
    }
  } else if (!text) {
    handleSendHeart();
  } else {
    sendChatMessageText(text);
  }`;

const newHeartLogic = `function handleRoomHeartClick(e) {
  if (e) e.preventDefault();
  const text = elements.messageInput?.value.trim();
  
  if (typeof selectedMediaFiles !== 'undefined' && selectedMediaFiles.length > 0) {
    for (const media of selectedMediaFiles) {
       if (media.type === 'image') {
         sendChatImageMessage(media.dataUrl);
       } else {
         sendChatFileMessage(media.dataUrl, media.file.name);
       }
    }
    selectedMediaFiles.length = 0; // clear array
    if (typeof renderMediaPreviews === 'function') renderMediaPreviews();
    
    if (text) {
      sendChatMessageText(text);
    }
  } else if (!text) {
    handleSendHeart();
  } else {
    sendChatMessageText(text);
  }`;

content = content.replace(oldHeartLogic, newHeartLogic);

// Add sendChatFileMessage
const fileMessageFunction = `
async function sendChatFileMessage(dataUrl, fileName) {
  if (!dataUrl) return;

  const payload = {
    type: 'file',
    content: dataUrl,
    fileName: fileName,
    sender: state.userName,
    timestamp: new Date().toISOString()
  };

  appendFeedItem('file', \`\${fileName}|\${dataUrl}\`, 'You', new Date());

  relaySend(payload);

  if (state.supabase) {
    try {
      await state.supabase.from('messages').insert([{
        room_code: state.roomCode,
        type: 'file',
        content: \`\${state.userName}: \${fileName}|\${dataUrl}\`
      }]);
    } catch (err) {
      console.error('Supabase message insert error:', err);
    }
  }
}
`;

content = content.replace("async function sendChatImageMessage", fileMessageFunction + "\nasync function sendChatImageMessage");

// Add 'file' to appendFeedItem
const oldAppendLogic = `  } else if (type === 'image') {
    const cleanContent = content.replace(/^.*?: /, '');
    item.className = \`feed-item \${isSelf ? 'self' : 'partner'} \${animate ? '' : 'no-animate'}\`;
    item.innerHTML = \`
      <div class="feed-meta"><span class="sender">\${isSelf ? 'You' : sender}</span> <span>\${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content"><img src="\${cleanContent}" style="max-width: 100%; border-radius: 8px; margin-top: 4px;" alt="Image message" /></div>
    \`;
    showCircleSpeechBubble(isSelf ? 'local' : sender, '📸 Image');
  } else {`;

const newAppendLogic = `  } else if (type === 'image') {
    const cleanContent = content.replace(/^.*?: /, '');
    item.className = \`feed-item \${isSelf ? 'self' : 'partner'} \${animate ? '' : 'no-animate'}\`;
    item.innerHTML = \`
      <div class="feed-meta"><span class="sender">\${isSelf ? 'You' : sender}</span> <span>\${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content"><img src="\${cleanContent}" style="max-width: 100%; border-radius: 8px; margin-top: 4px;" alt="Image message" /></div>
    \`;
    showCircleSpeechBubble(isSelf ? 'local' : sender, '📸 Image');
  } else if (type === 'file') {
    const cleanContent = content.replace(/^.*?: /, '');
    const [fileName, ...dataParts] = cleanContent.split('|');
    const fileDataUrl = dataParts.join('|');
    item.className = \`feed-item \${isSelf ? 'self' : 'partner'} \${animate ? '' : 'no-animate'}\`;
    item.innerHTML = \`
      <div class="feed-meta"><span class="sender">\${isSelf ? 'You' : sender}</span> <span>\${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content">
        <a href="\${fileDataUrl}" download="\${fileName}" style="display: flex; align-items: center; gap: 8px; text-decoration: none; color: inherit; background: rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">
          <span style="font-size: 24px;">📄</span>
          <span style="word-break: break-all; font-weight: 500;">\${fileName || 'Download File'}</span>
        </a>
      </div>
    \`;
    showCircleSpeechBubble(isSelf ? 'local' : sender, '📄 File');
  } else {`;

content = content.replace(oldAppendLogic, newAppendLogic);

// Add 'file' to handleIncomingPayload
const oldIncomingLogic = `  } else if (type === 'image') {
    showToast(\`📸 New image from \${sender || 'Partner'}\`, 'info');
    showNativeNotification(\`📸 \${sender || 'Partner'}\`, 'Sent an image');
  } else if (type === 'message') {`;

const newIncomingLogic = `  } else if (type === 'image') {
    showToast(\`📸 New image from \${sender || 'Partner'}\`, 'info');
    showNativeNotification(\`📸 \${sender || 'Partner'}\`, 'Sent an image');
  } else if (type === 'file') {
    showToast(\`📄 New file from \${sender || 'Partner'}\`, 'info');
    showNativeNotification(\`📄 \${sender || 'Partner'}\`, 'Sent a file');
  } else if (type === 'message') {`;

content = content.replace(oldIncomingLogic, newIncomingLogic);

fs.writeFileSync('app.js', content, 'utf8');
