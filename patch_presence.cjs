const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const oldChannelLogic = `    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(\`Subscribed to Realtime channel: \${channelName}\`);
      }
    });`;

const newChannelLogic = `    .on('presence', { event: 'sync' }, () => {
      state.presenceState = state.channel.presenceState();
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(\`Subscribed to Realtime channel: \${channelName}\`);
        state.channel.track({ user: state.userName, online_at: new Date().toISOString() });
      }
    });`;

content = content.replace(oldChannelLogic, newChannelLogic);
fs.writeFileSync('app.js', content, 'utf8');
