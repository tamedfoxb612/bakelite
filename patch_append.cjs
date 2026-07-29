const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const oldAppendLogic = `  if (type === 'heart') {
    item.className = \`feed-item heart-event \${animate ? '' : 'no-animate'}\`;
    item.innerHTML = \`
      <div class="feed-meta"><span>\${isSelf ? 'You sent a page' : \`Page from <b>\${sender}</b>\`}</span> <span>\${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content" style="font-size: 1.5rem; margin: 4px 0;">❤️❤️❤️</div>
    \`;
    showCircleSpeechBubble(isSelf ? 'local' : sender, '❤️❤️❤️');
  } else {
    const cleanContent = content.replace(/^.*?: /, '');
    item.className = \`feed-item \${isSelf ? 'self' : 'partner'} \${animate ? '' : 'no-animate'}\`;
    item.innerHTML = \`
      <div class="feed-meta"><span class="sender">\${isSelf ? 'You' : sender}</span> <span>\${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content">\${cleanContent}</div>
    \`;
    showCircleSpeechBubble(isSelf ? 'local' : sender, cleanContent);
  }`;

const newAppendLogic = `  if (type === 'heart') {
    item.className = \`feed-item heart-event \${animate ? '' : 'no-animate'}\`;
    item.innerHTML = \`
      <div class="feed-meta"><span>\${isSelf ? 'You sent a page' : \`Page from <b>\${sender}</b>\`}</span> <span>\${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content" style="font-size: 1.5rem; margin: 4px 0;">❤️❤️❤️</div>
    \`;
    showCircleSpeechBubble(isSelf ? 'local' : sender, '❤️❤️❤️');
  } else if (type === 'image') {
    const cleanContent = content.replace(/^.*?: /, '');
    item.className = \`feed-item \${isSelf ? 'self' : 'partner'} \${animate ? '' : 'no-animate'}\`;
    item.innerHTML = \`
      <div class="feed-meta"><span class="sender">\${isSelf ? 'You' : sender}</span> <span>\${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content"><img src="\${cleanContent}" style="max-width: 100%; border-radius: 8px; margin-top: 4px;" alt="Image message" /></div>
    \`;
    showCircleSpeechBubble(isSelf ? 'local' : sender, '📸 Image');
  } else {
    const cleanContent = content.replace(/^.*?: /, '');
    item.className = \`feed-item \${isSelf ? 'self' : 'partner'} \${animate ? '' : 'no-animate'}\`;
    item.innerHTML = \`
      <div class="feed-meta"><span class="sender">\${isSelf ? 'You' : sender}</span> <span>\${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content">\${cleanContent}</div>
    \`;
    showCircleSpeechBubble(isSelf ? 'local' : sender, cleanContent);
  }`;

content = content.replace(oldAppendLogic, newAppendLogic);
fs.writeFileSync('app.js', content, 'utf8');
