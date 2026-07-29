const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const oldHeartLogic = `  if (typeof selectedMediaFiles !== 'undefined' && selectedMediaFiles.length > 0) {
    for (const media of selectedMediaFiles) {
       if (media.type === 'image') {
         sendChatImageMessage(media.dataUrl);
       } else {
         sendChatFileMessage(media.dataUrl, media.file.name);
       }
    }`;

const newHeartLogic = `  if (typeof selectedMediaFiles !== 'undefined' && selectedMediaFiles.length > 0) {
    for (const media of selectedMediaFiles) {
       if (media.file.size > 1024 * 1024) {
         const peers = getOnlinePeers();
         if (peers.length === 0) {
           showToast('Cannot send files over 1MB, no other user is online', 'error');
           continue;
         }
         peers.forEach(peer => {
           sendFileWebRTC(media.file, peer);
         });
       } else {
         if (media.type === 'image') {
           sendChatImageMessage(media.dataUrl);
         } else {
           sendChatFileMessage(media.dataUrl, media.file.name);
         }
       }
    }`;

content = content.replace(oldHeartLogic, newHeartLogic);
fs.writeFileSync('app.js', content, 'utf8');
