const fs = require('fs');

const cleanupCode = `name: Midnight Supabase Cleanup

on:
  schedule:
    - cron: '0 0 * * *' # Runs every day at midnight (UTC)
  workflow_dispatch: # Allows manual triggering from GitHub UI

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Run cleanup script
        run: |
          npm init -y
          npm install @supabase/supabase-js
          node -e "
            const { createClient } = require('@supabase/supabase-js');
            const url = 'https://fwwvksyewbdfdyegzgfz.supabase.co';
            const key = 'sb_publishable_IED8Q0cnxphV6LWsaOV9cg_qChpAX8H';
            const supabase = createClient(url, key);
            async function cleanup() {
              console.log('Fetching media paths to delete...');
              const { data: messages, error: fetchErr } = await supabase.from('messages').select('type, content').eq('type', 'media');
              if (fetchErr) console.error('Error fetching messages:', fetchErr);
              
              const mediaPaths = [];
              if (messages) {
                for (const msg of messages) {
                   try {
                      const cleanContent = msg.content.replace(/^.*?: /, '');
                      const meta = JSON.parse(cleanContent);
                      if (meta.path) mediaPaths.push(meta.path);
                   } catch(e) {}
                }
              }
              
              if (mediaPaths.length > 0) {
                console.log('Deleting media from storage bucket...', mediaPaths);
                const { error: storageErr } = await supabase.storage.from('chat-media').remove(mediaPaths);
                if (storageErr) console.error('Error deleting from storage:', storageErr);
              }

              console.log('Clearing messages from DB...');
              const { error: msgErr } = await supabase.from('messages').delete().neq('id', 0);
              if (msgErr) console.error('Error clearing messages:', msgErr);
              
              console.log('Clearing subscriptions...');
              const { error: subErr } = await supabase.from('subscriptions').delete().neq('id', 0);
              if (subErr) console.error('Error clearing subscriptions:', subErr);
              
              console.log('Midnight cleanup complete.');
            }
            cleanup();
          "
`;
fs.writeFileSync('cleanup.yml', cleanupCode);
