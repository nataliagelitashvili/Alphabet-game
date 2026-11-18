/* Supabase client. Put your PUBLISHABLE (anon) key here. NEVER put a service-role key in frontend code. */
window.LL=window.LL||{};
LL.config={SUPABASE_URL:'https://pjhnxvqldapgcsluxglm.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_FiocTDxpCmLc0nBt6dmrzA_4KOIU_xY'};
LL.isConfigured=()=>!LL.config.SUPABASE_URL.startsWith('YOUR_')&&!LL.config.SUPABASE_PUBLISHABLE_KEY.startsWith('YOUR_');
LL.sb=(LL.isConfigured()&&window.supabase)?window.supabase.createClient(LL.config.SUPABASE_URL,LL.config.SUPABASE_PUBLISHABLE_KEY):null;
