const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const target = `           appendFeedItem('media', payload.content, 'You', new Date());
           relaySend(payload);
        } else {`;
const replacement = `           appendFeedItem('media', payload.content, 'You', new Date());
           relaySend(payload);
           
           if (state.supabase) {
             try {
               await state.supabase.from('messages').insert([{
                 room_code: state.roomCode,
                 type: 'media',
                 content: \`\${state.userName}: \${payload.content}\`
               }]);
             } catch(e) {}
           }
        } else {`;
code = code.replace(target, replacement);

fs.writeFileSync('app.js', code);
