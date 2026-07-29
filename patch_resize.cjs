const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const oldHandleFileUpload = `  const handleFileUpload = (e) => {
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
  };`;

const newHandleFileUpload = `  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      
      if (!isImage && file.size > 1024 * 1024) {
        showToast(\`File \${file.name} is too large (max 1MB for files).\`, 'error');
        continue;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        let dataUrl = event.target.result;
        
        if (isImage) {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Re-encode compressed
            dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            selectedMediaFiles.push({ file, dataUrl, type: 'image' });
            renderMediaPreviews();
          };
          img.src = dataUrl;
        } else {
          selectedMediaFiles.push({ file, dataUrl, type: 'file' });
          renderMediaPreviews();
        }
      };
      reader.readAsDataURL(file);
    }
    
    e.target.value = '';
  };`;

content = content.replace(oldHandleFileUpload, newHandleFileUpload);
fs.writeFileSync('app.js', content, 'utf8');
