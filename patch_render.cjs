const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const oldAppend = `  } else if (type === 'file') {
    const cleanContent = content.replace(/^.*?: /, '');
    const [fileName, ...dataParts] = cleanContent.split('|');`;

const newAppend = `  } else if (type === 'p2p-file') {
    const cleanContent = content.replace(/^.*?: /, '');
    const [fileName, fileId, fileSize] = cleanContent.split('|');
    item.className = \`feed-item \${isSelf ? 'self' : 'partner'} \${animate ? '' : 'no-animate'}\`;
    item.dataset.fileId = fileId;
    
    // Placeholder content, will be re-rendered asynchronously
    item.innerHTML = \`
      <div class="feed-meta"><span class="sender">\${isSelf ? 'You' : sender}</span> <span>\${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content" data-file-content="\${fileId}">
        <div style="display:flex; align-items:center; gap:8px;">
          <div class="spinner" style="width:16px; height:16px; border:2px solid var(--primary); border-top:2px solid transparent; border-radius:50%; animation:spin 1s linear infinite;"></div>
          <span>Loading \${fileName}...</span>
        </div>
      </div>
    \`;
    showCircleSpeechBubble(isSelf ? 'local' : sender, '📄 File');
    
    // Asynchronously render the bubble
    renderFileBubbleContent(item, fileId, fileName, fileSize);
  } else if (type === 'file') {
    const cleanContent = content.replace(/^.*?: /, '');
    const [fileName, ...dataParts] = cleanContent.split('|');`;

content = content.replace(oldAppend, newAppend);

const renderFileBubbleLogic = `
async function renderFileBubbleContent(bubbleEl, fileId, fallbackName, fallbackSize) {
  const contentContainer = bubbleEl.querySelector(\`[data-file-content="\${fileId}"]\`);
  if (!contentContainer) return;

  try {
    const fileRecord = await getFileFromDB(fileId);
    if (!fileRecord) {
      contentContainer.innerHTML = \`
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 24px; opacity:0.5;">📄</span>
            <div>
              <div style="font-weight: 500; word-break: break-all; opacity:0.7;">\${fallbackName || 'Unknown file'}</div>
              <div style="font-size: 0.75rem; opacity: 0.5;">File unavailable on this device</div>
            </div>
          </div>
        </div>
      \`;
      return;
    }

    const { fileName, fileType, fileSize, blob } = fileRecord;
    const url = URL.createObjectURL(blob);
    const sizeStr = (fileSize / (1024 * 1024)).toFixed(2) + ' MB';
    
    let previewHtml = '';
    
    if (fileType.startsWith('image/')) {
      previewHtml = \`<img src="\${url}" style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-bottom: 8px; cursor: pointer;" onclick="window.open('\${url}', '_blank')" alt="\${fileName}" />\`;
    } else if (fileType.startsWith('video/')) {
      previewHtml = \`<video src="\${url}" controls style="max-width: 100%; max-height: 300px; border-radius: 8px; margin-bottom: 8px;"></video>\`;
    } else if (fileType === 'application/pdf') {
      previewHtml = \`<iframe src="\${url}" style="width: 100%; height: 300px; border-radius: 8px; border: none; margin-bottom: 8px;"></iframe>\`;
    }

    contentContainer.innerHTML = \`
      \${previewHtml}
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; background: rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">
        <div style="display: flex; align-items: center; gap: 8px; overflow:hidden;">
          <span style="font-size: 24px;">📄</span>
          <div style="overflow:hidden;">
            <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;" title="\${fileName}">\${fileName}</div>
            <div style="font-size: 0.75rem; opacity: 0.7;">\${sizeStr}</div>
          </div>
        </div>
        <button type="button" class="btn btn-icon-small download-btn" data-id="\${fileId}" style="width:36px; height:36px; flex-shrink:0;">⬇️</button>
      </div>
    \`;

    const downloadBtn = contentContainer.querySelector('.download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        downloadFileFromDB(fileRecord);
      });
    }

  } catch (err) {
    console.error('Error rendering file bubble:', err);
  }
}

function downloadFileFromDB(fileRecord) {
  const url = URL.createObjectURL(fileRecord.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileRecord.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
`;

content += '\n' + renderFileBubbleLogic;
fs.writeFileSync('app.js', content, 'utf8');
