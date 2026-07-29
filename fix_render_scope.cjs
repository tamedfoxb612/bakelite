const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const renderCode = `  function renderMediaPreviews() {
    if (!elements.mediaPreviewContainer) return;
    elements.mediaPreviewContainer.innerHTML = '';
    
    selectedMediaFiles.forEach((media, index) => {
      const item = document.createElement('div');
      item.className = 'media-preview-item';
      
      if (media.type === 'image') {
        item.innerHTML = \\\`
          <img src="\${media.dataUrl}" alt="Preview" />
          <button type="button" class="remove-media-btn" data-index="\${index}">×</button>
        \\\`;
      } else {
        item.innerHTML = \\\`
          <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 24px; background: var(--surface-light); color: var(--text-main);">📄</div>
          <button type="button" class="remove-media-btn" data-index="\${index}">×</button>
        \\\`;
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
  }`;

content = content.replace(renderCode, "");

content = content.replace("let selectedMediaFiles = [];", "let selectedMediaFiles = [];\n" + renderCode.replace(/\\\\`/g, '`'));

fs.writeFileSync('app.js', content, 'utf8');
