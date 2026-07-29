const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const setupEvtsTarget = `  elements.messageInput?.addEventListener('focus', clearUnreadMessages);
  elements.messageInput?.addEventListener('click', clearUnreadMessages);`;

const setupEvtsReplacement = `  const mediaMenuBtn = document.getElementById('media-menu-btn');
  const mediaMenu = document.getElementById('media-menu');
  const mediaPhotoBtn = document.getElementById('media-photo-btn');
  const mediaFileBtn = document.getElementById('media-file-btn');
  const mediaPhotoInput = document.getElementById('media-photo-input');
  const mediaFileInput = document.getElementById('media-file-input');
  
  if (mediaMenuBtn) {
    mediaMenuBtn.addEventListener('click', (e) => {
       e.preventDefault();
       e.stopPropagation();
       mediaMenu.classList.toggle('hidden');
    });
    
    document.addEventListener('click', (e) => {
       if (mediaMenu && !mediaMenu.contains(e.target) && e.target !== mediaMenuBtn) {
          mediaMenu.classList.add('hidden');
       }
    });
  }
  
  if (mediaPhotoBtn) mediaPhotoBtn.addEventListener('click', () => { mediaPhotoInput.click(); mediaMenu.classList.add('hidden'); });
  if (mediaFileBtn) mediaFileBtn.addEventListener('click', () => { mediaFileInput.click(); mediaMenu.classList.add('hidden'); });
  
  const handleMediaUpload = async (e) => {
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
        } else {
           showToast('Upload failed', 'error');
        }
     }
     e.target.value = '';
  };
  
  if (mediaPhotoInput) mediaPhotoInput.addEventListener('change', handleMediaUpload);
  if (mediaFileInput) mediaFileInput.addEventListener('change', handleMediaUpload);

  elements.messageInput?.addEventListener('focus', clearUnreadMessages);
  elements.messageInput?.addEventListener('click', clearUnreadMessages);`;

code = code.replace(setupEvtsTarget, setupEvtsReplacement);

const appendTarget = `    const cleanContent = content.replace(/^.*?: /, '');
    item.className = \`feed-item \${isSelf ? 'self' : 'partner'} \${animate ? '' : 'no-animate'}\`;
    item.innerHTML = \`
      <div class="feed-meta"><span class="sender">\${isSelf ? 'You' : sender}</span> <span>\${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content">\${cleanContent}</div>
    \`;
    showCircleSpeechBubble(isSelf ? 'local' : sender, cleanContent);
  }`;

const appendReplacement = `    const cleanContent = content.replace(/^.*?: /, '');
    item.className = \`feed-item \${isSelf ? 'self' : 'partner'} \${animate ? '' : 'no-animate'}\`;
    
    let innerContent = cleanContent;
    if (type === 'media') {
       try {
           const meta = JSON.parse(cleanContent);
           const uniqueId = 'media-' + Math.random().toString(36).substr(2, 9);
           innerContent = \`<div id="\${uniqueId}" class="media-container">
               <button class="btn btn-primary" onclick="downloadEncryptedMedia('\${meta.url}', '\${meta.type}', '\${meta.name}')">Download \${meta.name}</button>
           </div>\`;
           
           // Automatically attempt to decrypt and display inline
           setTimeout(async () => {
              try {
                  const res = await fetch(meta.url);
                  const blob = await res.blob();
                  const decryptedBlob = await decryptFile(blob, meta.type);
                  const objUrl = URL.createObjectURL(decryptedBlob);
                  const container = document.getElementById(uniqueId);
                  if (container) {
                     if (meta.type.startsWith('image/')) {
                         container.innerHTML = \`<img src="\${objUrl}" style="max-width: 100%; border-radius: 8px;" alt="media"/>\`;
                     } else if (meta.type.startsWith('video/')) {
                         container.innerHTML = \`<video src="\${objUrl}" controls style="max-width: 100%; border-radius: 8px;"></video>\`;
                     } else {
                         container.innerHTML = \`<a href="\${objUrl}" download="\${meta.name}" class="btn btn-primary" style="display:inline-block">Download \${meta.name}</a>\`;
                     }
                  }
              } catch (e) { console.error('Media load error', e); }
           }, 100);
       } catch (e) {
           innerContent = \`[Encrypted Media]\`;
       }
    }
    
    item.innerHTML = \`
      <div class="feed-meta"><span class="sender">\${isSelf ? 'You' : sender}</span> <span>\${timeStr} <button class="msg-delete-btn" title="Delete message">×</button></span></div>
      <div class="feed-content">\${innerContent}</div>
    \`;
    if (type !== 'media') showCircleSpeechBubble(isSelf ? 'local' : sender, cleanContent);
  }`;

code = code.replace(appendTarget, appendReplacement);

fs.writeFileSync('app.js', code);
