const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const uploadCode = `  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      
      if (file.size > 100 * 1024 * 1024) {
        showToast(\`File \${file.name} is too large (max 100MB).\`, 'error');
        continue;
      }
      
      if (file.size > 1024 * 1024) {
         // large file, don't read into memory as base64
         let dataUrl = URL.createObjectURL(file);
         selectedMediaFiles.push({ file, dataUrl, type: isImage ? 'image' : 'file' });
         renderMediaPreviews();
      } else {
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
    }
    
    e.target.value = '';
  };`;

// replace the old one
const startIndex = content.indexOf("const handleFileUpload = (e) => {");
const endIndex = content.indexOf("  elements.hiddenPhotoVideoInput?.addEventListener('change', handleFileUpload);");

if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
  content = content.substring(0, startIndex) + uploadCode + "\n" + content.substring(endIndex);
}

fs.writeFileSync('app.js', content, 'utf8');
