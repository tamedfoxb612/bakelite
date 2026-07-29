const fs = require('fs');

let content = fs.readFileSync('app.js', 'utf8');

const newUploadLogic = `
  // Media Upload Logic
  let selectedMediaFiles = [];

  function renderMediaPreviews() {
    if (!elements.mediaPreviewContainer) return;
    elements.mediaPreviewContainer.innerHTML = '';
    
    selectedMediaFiles.forEach((media, index) => {
      const item = document.createElement('div');
      item.className = 'media-preview-item';
      
      if (media.type === 'image') {
        item.innerHTML = \`
          <img src="\${media.dataUrl}" alt="Preview" />
          <button type="button" class="remove-media-btn" data-index="\${index}">×</button>
        \`;
      } else {
        item.innerHTML = \`
          <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 24px; background: var(--surface-light); color: var(--text-main);">📄</div>
          <button type="button" class="remove-media-btn" data-index="\${index}">×</button>
        \`;
      }
      
      elements.mediaPreviewContainer.appendChild(item);
    });
    
    elements.mediaPreviewContainer.querySelectorAll('.remove-media-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'));
        selectedMediaFiles.splice(idx, 1);
        renderMediaPreviews();
      });
    });
  }

  elements.mediaUploadBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.mediaUploadMenu?.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!elements.mediaUploadBtn?.contains(e.target) && !elements.mediaUploadMenu?.contains(e.target)) {
      elements.mediaUploadMenu?.classList.add('hidden');
    }
  });

  elements.uploadPhotoVideoBtn?.addEventListener('click', () => {
    elements.mediaUploadMenu?.classList.add('hidden');
    elements.hiddenPhotoVideoInput?.click();
  });

  elements.uploadFileBtn?.addEventListener('click', () => {
    elements.mediaUploadMenu?.classList.add('hidden');
    elements.hiddenFileInput?.click();
  });

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        showToast(\`File \${file.name} is too large (max 5MB).\`, 'error');
        continue;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        selectedMediaFiles.push({ file, dataUrl, type: file.type.startsWith('image/') ? 'image' : 'file' });
        renderMediaPreviews();
      };
      reader.readAsDataURL(file);
    }
    
    e.target.value = '';
  };
`;

// Replace the old handleFileUpload logic with the new one
// First we need to find the old one
const oldLogicStart = "// Media Upload Logic";
const oldLogicEnd = "elements.hiddenFileInput?.addEventListener('change', handleFileUpload);";
const startIndex = content.indexOf(oldLogicStart);
const endIndex = content.indexOf(oldLogicEnd) + oldLogicEnd.length;

if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
  content = content.substring(0, startIndex) + newUploadLogic + "\n  elements.hiddenPhotoVideoInput?.addEventListener('change', handleFileUpload);\n  elements.hiddenFileInput?.addEventListener('change', handleFileUpload);" + content.substring(endIndex);
}

// Now replace handleRoomHeartClick
const oldHeartLogic = `function handleRoomHeartClick(e) {
  if (e) e.preventDefault();
  const text = elements.messageInput?.value.trim();
  if (!text) {
    // press heart without text inputted to send notification pager heart
    handleSendHeart();
  } else {
    // if text is present send message with notification
    sendChatMessageText(text);
    if (elements.messageInput) elements.messageInput.value = '';
  }
}`;

const newHeartLogic = `function handleRoomHeartClick(e) {
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
  }
  
  if (elements.messageInput) elements.messageInput.value = '';
}`;

content = content.replace(oldHeartLogic, newHeartLogic);

// Add sendChatImageMessage function
const imageMessageFunction = `
async function sendChatImageMessage(dataUrl) {
  if (!dataUrl) return;

  const payload = {
    type: 'image',
    content: dataUrl,
    sender: state.userName,
    timestamp: new Date().toISOString()
  };

  appendFeedItem('image', dataUrl, 'You', new Date());

  relaySend(payload);

  if (state.supabase) {
    try {
      await state.supabase.from('messages').insert([{
        room_code: state.roomCode,
        type: 'image',
        content: \`\${state.userName}: \${dataUrl}\`
      }]);
    } catch (err) {
      console.error('Supabase message insert error:', err);
    }
  }
}
`;

content = content.replace("async function sendChatMessageText", imageMessageFunction + "\nasync function sendChatMessageText");

fs.writeFileSync('app.js', content, 'utf8');
