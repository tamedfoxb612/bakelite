const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const oldLogic = `  } else if (type === 'file') {
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

const newLogic = `  } else if (type === 'file') {
    const cleanContent = content.replace(/^.*?: /, '');
    const [fileName, ...dataParts] = cleanContent.split('|');
    const fileDataUrl = dataParts.join('|');
    
    // Estimate size from Base64
    let sizeStr = 'Unknown size';
    if (fileDataUrl.startsWith('data:')) {
      const base64Len = fileDataUrl.length - (fileDataUrl.indexOf(',') + 1);
      const sizeBytes = Math.floor(base64Len * 0.75);
      if (sizeBytes < 1024 * 1024) {
        sizeStr = (sizeBytes / 1024).toFixed(1) + ' KB';
      } else {
        sizeStr = (sizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
      }
    }
    
    item.className = \`feed-item \${isSelf ? 'self' : 'partner'} \${animate ? '' : 'no-animate'}\`;
    item.innerHTML = \`
      <div class="feed-meta"><span class="sender">\${isSelf ? 'You' : sender}</span> <span>\${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">
          <div style="display: flex; align-items: center; gap: 8px; overflow:hidden;">
            <span style="font-size: 24px;">📄</span>
            <div style="overflow:hidden;">
              <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;" title="\${fileName}">\${fileName}</div>
              <div style="font-size: 0.75rem; opacity: 0.7;">\${sizeStr}</div>
            </div>
          </div>
          <a href="\${fileDataUrl}" download="\${fileName}" class="btn btn-icon-small" style="width:36px; height:36px; flex-shrink:0; display:flex; align-items:center; justify-content:center; text-decoration:none; color:inherit;">⬇️</a>
        </div>
      </div>
    \`;
    showCircleSpeechBubble(isSelf ? 'local' : sender, '📄 File');
  } else {`;

content = content.replace(oldLogic, newLogic);

// Also add a download button for small image files!
const oldImgAppend = `  } else if (type === 'image') {
    const cleanContent = content.replace(/^.*?: /, '');
    item.className = \`feed-item \${isSelf ? 'self' : 'partner'} \${animate ? '' : 'no-animate'}\`;
    item.innerHTML = \`
      <div class="feed-meta"><span class="sender">\${isSelf ? 'You' : sender}</span> <span>\${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content"><img src="\${cleanContent}" style="max-width: 100%; border-radius: 8px; margin-top: 4px;" alt="Image message" /></div>
    \`;
    showCircleSpeechBubble(isSelf ? 'local' : sender, '📸 Image');`;

const newImgAppend = `  } else if (type === 'image') {
    const cleanContent = content.replace(/^.*?: /, '');
    item.className = \`feed-item \${isSelf ? 'self' : 'partner'} \${animate ? '' : 'no-animate'}\`;
    
    // Estimate size
    let sizeStr = 'Image';
    if (cleanContent.startsWith('data:')) {
      const base64Len = cleanContent.length - (cleanContent.indexOf(',') + 1);
      const sizeBytes = Math.floor(base64Len * 0.75);
      if (sizeBytes < 1024 * 1024) {
        sizeStr = (sizeBytes / 1024).toFixed(1) + ' KB';
      } else {
        sizeStr = (sizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
      }
    }
    
    item.innerHTML = \`
      <div class="feed-meta"><span class="sender">\${isSelf ? 'You' : sender}</span> <span>\${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content">
        <img src="\${cleanContent}" style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-bottom: 8px; cursor: pointer;" onclick="window.open('\${cleanContent}', '_blank')" alt="Image message" />
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">
          <div style="display: flex; align-items: center; gap: 8px; overflow:hidden;">
            <span style="font-size: 24px;">📄</span>
            <div style="overflow:hidden;">
              <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">Attached Image</div>
              <div style="font-size: 0.75rem; opacity: 0.7;">\${sizeStr}</div>
            </div>
          </div>
          <a href="\${cleanContent}" download="image.jpg" class="btn btn-icon-small" style="width:36px; height:36px; flex-shrink:0; display:flex; align-items:center; justify-content:center; text-decoration:none; color:inherit;">⬇️</a>
        </div>
      </div>
    \`;
    showCircleSpeechBubble(isSelf ? 'local' : sender, '📸 Image');`;

content = content.replace(oldImgAppend, newImgAppend);

fs.writeFileSync('app.js', content, 'utf8');
