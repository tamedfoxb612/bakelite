const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const target = `    if (data && data.length > 0) {
      elements.chatFeed.innerHTML = '';
      data.forEach(msg => {
        appendFeedItem(msg.type, msg.content, msg.content.includes(':') ? msg.content.split(':')[0] : 'Partner', new Date(msg.created_at), false);
      });
    }`;

const replacement = `    if (data && data.length > 0) {
      elements.chatFeed.innerHTML = '';
      for (const msg of data) {
        let content = msg.content;
        let sender = content.includes(':') ? content.split(':')[0] : 'Partner';
        let pureContent = content.substring(sender.length + 1).trim();
        if (msg.type === 'message') {
           pureContent = await decryptMessageContent(pureContent);
        }
        appendFeedItem(msg.type, pureContent, sender, new Date(msg.created_at), false);
      }
    }`;

code = code.replace(target, replacement);
fs.writeFileSync('app.js', code);
