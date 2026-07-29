const { createClient } = require('@supabase/supabase-js');
const url = 'https://fwwvksyewbdfdyegzgfz.supabase.co';
const key = 'sb_publishable_IED8Q0cnxphV6LWsaOV9cg_qChpAX8H';
const supabase = createClient(url, key);
async function check() {
  const { data, error } = await supabase.storage.listBuckets();
  console.log('Buckets:', data);
}
check();
