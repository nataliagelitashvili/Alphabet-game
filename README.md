# დაკარგული ასოების საიდუმლო — Phase 1
Static site (HTML/CSS/vanilla JS). Run: `python3 -m http.server` then open http://localhost:8000 (needed for `data/alphabet.json`).
## Supabase
1. Create a project at supabase.com. 2. Project Settings → API: copy the URL and the **publishable (anon)** key into `js/supabase.js` (`LL.config`). Never use the service-role key.
3. Authentication → Providers → enable Email (disable "Confirm email" for quick local tests). 4. Test: Register (email, nickname, password), then Login; Profile shows your nickname.
5. SQL for later progress saving:
`create table progress(user_id uuid primary key references auth.users, levels_completed int default 0, letters int[] default '{}'); alter table progress enable row level security; create policy own on progress using (auth.uid()=user_id) with check (auth.uid()=user_id);`
## Structure
index/game/profile.html · css/{main,responsive,game}.css · js/{supabase,auth,progress,navigation,sprites,worldmap,app}.js · data/alphabet.json (33 letters, 3 per world) · assets/*
Namespace `LL`. Routes: `navigation.js`. Level/map data: `worldmap.js`. Integration stubs in `progress.js`: `LL.engine, alphabetBook, achievements, levels, audio`.
## Implemented
Title screen, animated floating letters, pixel sprites, intro dialogue (skip), auth UI + validation (works only once Supabase is configured), profile, nav, Georgia-shaped map with 11 locked locations and winding path.
## Placeholders
Levels, alphabet book, audio, achievements, progress saving, avatar. Iakob sprite is a generic bearded-suit sprite: no photo was supplied. Map outline is approximate; refine in `worldmap.js`. Location illustrations (vineyards, Svan towers, etc.) are for Phase 2.
