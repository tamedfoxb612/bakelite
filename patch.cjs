const fs = require('fs');

let content = fs.readFileSync('app.js', 'utf8');

// Insert new elements
content = content.replace(
  "messageInput: document.getElementById('message-input'),",
  "messageInput: document.getElementById('message-input'),\n  mediaUploadBtn: document.getElementById('media-upload-btn'),\n  mediaUploadMenu: document.getElementById('media-upload-menu'),\n  uploadPhotoVideoBtn: document.getElementById('upload-photo-video-btn'),\n  uploadFileBtn: document.getElementById('upload-file-btn'),\n  hiddenPhotoVideoInput: document.getElementById('hidden-photo-video-input'),\n  hiddenFileInput: document.getElementById('hidden-file-input'),"
);

// Insert event listeners
const listenerCode = `
  // Media Upload Logic
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

  // Handle file selections
  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      showToast(\`Selected \${files.length} file(s). Upload not yet implemented.\`, 'info');
      // Reset input so the same file can be selected again
      e.target.value = '';
    }
  };

  elements.hiddenPhotoVideoInput?.addEventListener('change', handleFileUpload);
  elements.hiddenFileInput?.addEventListener('change', handleFileUpload);
`;

content = content.replace(
  "elements.messageForm?.addEventListener('submit', handleRoomFormSubmit);",
  "elements.messageForm?.addEventListener('submit', handleRoomFormSubmit);\n" + listenerCode
);

fs.writeFileSync('app.js', content, 'utf8');
