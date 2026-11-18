# Asset specification (all PENDING until files are added to assets/)
Paths are defined only in js/assets.js. PNG, no text/lettering inside images, nearest-neighbour friendly (crisp pixels, no anti-aliased blur).
| File | Spec |
|---|---|
| backgrounds/home_hero.png | 1920x1080 Georgian village + library, dusk light, no characters |
| backgrounds/map_georgia.png | ~2000x1000 illustrated map framed to lon 40.0–46.9, lat 40.9–43.7: Black Sea west, Caucasus north, rivers/lakes, landmarks; no labels/markers/path |
| backgrounds/kakheti_{sky,far,mid,fore}.png | height 540, width >=960, horizontally tileable; sky=clouds, far=Caucasus, mid=vineyards+houses+Alazani valley, fore=grass/stones/vines (transparent) |
| characters/{player,iakob,asotsqlapia}_sheet.png | 384x512 transparent: 6 columns x 8 rows of 64x64. Rows: idle(4), walk(6), run(6), talk(4), celebrate(6), surprised(3), sad(4), openbag(6) |
Later levels: {id}_{sky,far,mid,fore}.png, then register in LL.assets.manifest.scenes.
