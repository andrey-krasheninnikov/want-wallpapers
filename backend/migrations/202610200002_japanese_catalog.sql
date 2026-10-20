-- Japanese translations extend existing records without changing their identity or chronology.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(18204001);

DO $$
DECLARE
    translation record;
    existing jsonb;
    updated jsonb;
    field text;
    expected text;
    japanese text;
    item record;
BEGIN
    FOR translation IN SELECT * FROM (VALUES
        ('collections', '0006-neon-tide', 'Neon Tide', 'Ten surreal wallpaper scenes bring glowing pixel patterns into dark coastal landscapes and imagined natural spaces. Black silhouettes and faceted rock give the collection its shape. Violet and magenta dominate the palette, with icy blue water and occasional amber or lime accents. Curved shorelines and living forms sit beside crisp square details, from flower petals to fragments of a moon.

Each scene has separate landscape and portrait compositions for desktop and phone screens.', 'ネオンの潮', '十の幻想的な壁紙が、暗い海辺や空想の自然に光るピクセル模様を描きます。黒いシルエットと多面体の岩が風景の骨格を作ります。紫と赤紫を中心に、氷のような青い水、ところどころに琥珀色や黄緑色の光が重なります。曲線を描く岸辺や生き物のそばには、花びらから月の欠片まで、くっきりした四角い細部が現れます。

それぞれの風景に、パソコン向けの横長とスマートフォン向けの縦長を別々に構成しています。'),
        ('collections', '0005-a-night-beneath-the-ice', 'A Night Beneath the Ice', 'Five quiet night scenes where ice, dark firs and warm city lights meet blue luminous rings.', '氷の下の夜', '氷、暗いモミの木、暖かな街の灯りが青く輝く輪と出会う、五つの静かな夜景。'),
        ('collections', '0004-where-stars-graze', 'Where Stars Graze', 'Five night scenes with a shaggy ginger cow, a windmill and a blue-violet comet above misty mountains.', '星が草を食むところ', '毛の長い赤茶色の牛と風車、霧深い山々の上を渡る青紫の彗星を描く、五つの夜の風景。'),
        ('collections', '0003-path-to-the-light', 'Path to the Light', 'Five quiet journeys towards a golden circle through cities, mountains, forests and ruins.', '光へ続く道', '街、山、森、遺跡を抜けて金色の輪へ向かう、五つの静かな旅。'),
        ('collections', '0002-woven-spectrum', 'Woven Spectrum', 'Bright strands of colour twist, fold and meet against deep red and black.', '織りなすスペクトル', '鮮やかな色の糸がねじれ、折れ重なり、深い赤と黒を背景に交わります。'),
        ('collections', '0001-contours-of-silence', 'Contours of Silence', 'Blue and violet forms emerge from the dark: dunes, glass, water and distant light.', '静寂の輪郭', '砂丘、ガラス、水面、遠くの光。青と紫の形が闇から浮かび上がります。'),
        ('wallpapers', 'contours-of-silence-1', 'Violet Horizon', 'Dark dunes with a thin violet glow under a star-filled sky.', '紫の地平線', '星空の下、暗い砂丘の縁に細い紫の光が走ります。'),
        ('wallpapers', 'contours-of-silence-2', 'Edge of Quiet', 'A single luminous ridge cuts diagonally through a dark dune.', '静寂の縁', '一本の光る稜線が、暗い砂丘を斜めに横切ります。'),
        ('wallpapers', 'contours-of-silence-3', 'Glass Current', 'Translucent blue folds float against an almost black background.', 'ガラスの流れ', 'ほとんど黒い背景に、半透明の青いひだが浮かびます。'),
        ('wallpapers', 'contours-of-silence-4', 'Folded Light', 'Sharp metallic folds catch blue and violet light in the dark.', '折り重なる光', '暗闇の中、鋭く折れた金属の面に青と紫の光が映ります。'),
        ('wallpapers', 'contours-of-silence-5', 'The Quiet Gate', 'A weathered stone arch holds a deep blue glow beneath the night sky.', '静かな門', '風雨にさらされた石のアーチが、夜空の下で深い青の光をたたえます。'),
        ('wallpapers', 'contours-of-silence-6', 'Midnight Ribbon', 'A luminous blue-violet ribbon twists across a field of black.', '真夜中のリボン', '光る青紫のリボンが、一面の黒の上でねじれます。'),
        ('wallpapers', 'contours-of-silence-7', 'Violet Cloud', 'Soft plumes of purple smoke gather and dissolve in the dark.', '紫の雲', '柔らかな紫の煙が、闇の中で集まり、ほどけていきます。'),
        ('wallpapers', 'contours-of-silence-8', 'After the Wave', 'A low ocean wave catches electric blue light beneath a dark horizon.', '波のあと', '暗い水平線の下、低い海の波に鮮烈な青い光が映ります。'),
        ('wallpapers', 'contours-of-silence-9', 'Suspended Crystal', 'A dark faceted crystal floats above a small pool of blue light.', '浮かぶ結晶', '多面体の暗い結晶が、小さな青い光のたまりの上に浮かびます。'),
        ('wallpapers', 'contours-of-silence-10', 'Lightfall', 'Vertical blue and violet light falls into a quiet nocturnal landscape.', '降りそそぐ光', '静かな夜の風景に、青と紫の光が垂直に降りそそぎます。'),
        ('wallpapers', 'contours-of-silence-11', 'Tree of the Night', 'An old tree stands in a violet-lit forest beneath a deep blue sky.', '夜の木', '深い青の空の下、紫に照らされた森に古い木が立っています。'),
        ('wallpapers', 'contours-of-silence-12', 'Blue Fault', 'A glowing blue fissure runs across a dark rocky surface.', '青い裂け目', '暗い岩の表面を、青く光る裂け目が横切ります。'),
        ('wallpapers', 'contours-of-silence-13', 'Transparent Planes', 'Geometric glass planes intersect with thin electric blue edges.', '透明な平面', '幾何学的なガラスの面が交わり、細い縁に鮮烈な青が光ります。'),
        ('wallpapers', 'contours-of-silence-14', 'Distant Crescent', 'A narrow blue crescent reveals a distant planet in near-total darkness.', '遠い三日月', 'ほぼ真っ暗な空間で、細い青の弧が遠くの惑星を浮かび上がらせます。'),
        ('wallpapers', 'contours-of-silence-15', 'Night Garden', 'Leaves and flowers emerge from darkness in a faint blue-violet glow.', '夜の庭', 'かすかな青紫の光に、葉と花が闇から現れます。'),
        ('wallpapers', 'woven-spectrum-1', 'Colour in Motion', 'Orange, pink and blue strands flow in broad waves over dark red.', '動きの中の色', '暗い赤の上を、橙、桃色、青の糸が大きな波となって流れます。'),
        ('wallpapers', 'woven-spectrum-2', 'Between the Strands', 'Curved bands of warm and cool colour frame a calm, dark centre.', '糸のあいだ', '暖色と寒色の曲線が、静かで暗い中心を囲みます。'),
        ('wallpapers', 'woven-spectrum-3', 'Spectrum Spiral', 'Bright ribbons wind into a vivid spiral of orange, blue and magenta.', 'スペクトルの渦', '鮮やかなリボンが、橙、青、赤紫の渦を巻きます。'),
        ('wallpapers', 'woven-spectrum-4', 'Colour Rays', 'Fans of luminous colour spread from a single point across the frame.', '色の光線', '光る色の束が、一点から画面いっぱいに扇状に広がります。'),
        ('wallpapers', 'woven-spectrum-5', 'Endless Loop', 'A bright multicolour loop floats over a deep crimson background.', '終わりのない輪', '深紅の背景に、鮮やかな多色の輪が浮かびます。'),
        ('wallpapers', 'path-to-the-light-1', 'City of the Golden Ring', 'A lone traveller crosses a wide bridge toward a glowing ring above a fantasy city.', '金色の輪の街', '一人の旅人が広い橋を渡り、幻想の街の上に輝く輪へ向かいます。'),
        ('wallpapers', 'path-to-the-light-2', 'Bridge to Dawn', 'A solitary figure follows a lit bridge to a vast golden circle at dusk.', '夜明けへの橋', '夕暮れの中、一人の人影が明かりの灯る橋を進み、巨大な金色の円へ向かいます。'),
        ('wallpapers', 'path-to-the-light-3', 'Still Water, Distant Light', 'A luminous ring rests between purple mountains and reflects in a still lake.', '静かな水、遠くの光', '紫の山々の間に光の輪が浮かび、静かな湖に映ります。'),
        ('wallpapers', 'path-to-the-light-4', 'Forest of the Ring', 'A traveller follows a golden stream through dark trees towards a bright circle.', '光の輪の森', '旅人が金色の小川に沿って暗い木々を抜け、明るい円へ向かいます。'),
        ('wallpapers', 'path-to-the-light-5', 'The Last Gate', 'A golden ring glows inside ancient ruins at the top of a stone staircase.', '最後の門', '石段の頂にある古い遺跡の中で、金色の輪が輝きます。'),
        ('wallpapers', 'where-stars-graze-1', 'Pasture Beneath the Comet', 'A shaggy ginger cow grazes among flowers beneath a blue comet, with a windmill and misty mountain valleys in the distance.', '彗星の下の牧草地', '青い彗星の下、毛の長い赤茶色の牛が花の間で草を食みます。遠くには風車と霧深い山の谷が見えます。'),
        ('wallpapers', 'where-stars-graze-2', 'Windmill Above the Clouds', 'A winding road climbs to a windmill above clouds filling the valleys; a ginger cow rests among flowers beneath a blue-violet comet.', '雲の上の風車', '曲がりくねった道が、谷を満たす雲の上の風車へのぼります。青紫の彗星の下、赤茶色の牛が花の間で休んでいます。'),
        ('wallpapers', 'where-stars-graze-3', 'Across the Starry Valley', 'Travellers and a shaggy cow follow a rocky path above a misty valley, while a comet crosses the starry sky beside palms and a distant windmill.', '星降る谷を越えて', '旅人たちと毛の長い牛が霧の谷の上の岩道を進みます。ヤシと遠い風車のそばで、彗星が星空を横切ります。'),
        ('wallpapers', 'where-stars-graze-4', 'Comet Reflection', 'A ginger cow drinks at the flower-lined shore of a mountain lake, sending ripples through the reflection of a blue comet and the night sky.', '彗星の映る湖', '赤茶色の牛が、花に縁取られた山の湖で水を飲みます。青い彗星と夜空の反射に波紋が広がります。'),
        ('wallpapers', 'where-stars-graze-5', 'Under a Sky of Stars', 'A close view of a shaggy ginger cow with long horns, framed by flowers, misty mountains and a windmill beneath a bright blue-violet comet.', '星空の下で', '長い角と豊かな赤茶色の毛を持つ牛を間近に描きます。花、霧の山々、風車の上で、明るい青紫の彗星が輝きます。'),
        ('wallpapers', 'a-night-beneath-the-ice-1', 'A Ring Among the Ice Floes', 'A golden dome leaves its reflection in dark water between broken ice floes, framed by a luminous blue ring.', '流氷の間の輪', '金色のドームが割れた流氷の間の暗い水に映り、青く光る輪に囲まれています。'),
        ('wallpapers', 'a-night-beneath-the-ice-2', 'Above the Frozen River', 'A blue ring hangs in heavy clouds above a misty river, ice floes and a waterfront glowing with golden lights.', '凍った川の上で', '霧の川と流氷、金色の灯りに照らされた河岸の上、厚い雲の中に青い輪が浮かびます。'),
        ('wallpapers', 'a-night-beneath-the-ice-3', 'The Blue Lantern', 'A blue ring lights an old wall beside a wet stone lane, while amber lanterns lead through firs towards a distant city.', '青い灯り', '濡れた石畳の脇の古い壁を青い輪が照らします。琥珀色の灯りがモミの木々を抜け、遠い街へ続きます。'),
        ('wallpapers', 'a-night-beneath-the-ice-4', 'Lights on the Descent', 'Blue ring lamps follow a snowy stone path down through dark firs towards an icy river and a warmly lit city.', '坂道の灯り', '青い輪の灯りが雪の石道に沿って並び、暗いモミの森から氷の川と暖かな街への下り道を照らします。'),
        ('wallpapers', 'a-night-beneath-the-ice-5', 'A City Within', 'The silhouette of a man in a dark coat blends with firs, a golden waterfront and ice-strewn water beneath a floating blue ring.', '内なる街', '浮かぶ青い輪の下で、暗いコートの男の輪郭が、モミの木、金色の河岸、氷の浮かぶ水と重なります。'),
        ('wallpapers', 'neon-tide-1', 'Pointer archipelago', 'Black rock islands shaped like mouse pointers rise from a violet sea. Hot pink surf traces their stepped shores, while sharp magenta edges catch the light. The islands form a receding chain across broad stretches of open water.', 'ポインターの群島', '紫の海から、マウスポインターの形をした黒い岩の島々がそびえます。鮮やかな桃色の波が段状の岸を縁取り、鋭い赤紫の稜線に光が映ります。島々は広い水面を横切り、遠くへ連なります。'),
        ('wallpapers', 'neon-tide-2', 'Night herbarium', 'Flowers grow from slender, curved stems against a black background. Their petals are made of glowing squares, with lime buds opening into amber and lavender blooms. A few loose pixels drift away like pollen.', '夜の植物標本', '黒い背景に、細く曲がった茎から花が咲きます。花びらは光る四角でできていて、黄緑の蕾が琥珀色や薄紫の花へ開きます。いくつかのピクセルが花粉のように漂います。'),
        ('wallpapers', 'neon-tide-3', 'Manta at dawn', 'A dark manta glides beneath an ink-blue sea, its broad wings edged in pink. Small blue and magenta squares form a constellation across its back. Coral currents trail behind it, following the curve of its long tail.', '夜明けのマンタ', 'インクのような青い海を、暗いマンタが滑るように泳ぎます。広いひれは桃色に縁取られ、背には青と赤紫の小さな四角が星座を作ります。長い尾の曲線に沿って、珊瑚色の流れが続きます。'),
        ('wallpapers', 'neon-tide-4', 'Ocean in a key', 'A single black keyboard key holds a miniature coastal bay. Violet water meets dark cliffs beneath a coral sky, and a lone tree stands above the shore. A thin stream spills over the front edge into the surrounding darkness.', 'キーの中の海', '一つの黒いキーボードのキーに、小さな海辺の入り江が収まっています。珊瑚色の空の下、紫の水が暗い崖に触れ、岸の上には一本の木が立っています。細い流れが手前の縁から周囲の闇へこぼれます。'),
        ('wallpapers', 'neon-tide-5', 'Inside the wave', 'An enormous wave curls like a sheet of paper. Its dark outer surface wraps around a bright mosaic that shifts from blue through violet and pink to yellow. Loose squares scatter from the crest, and the colors stretch across the water below.', '波の内側', '巨大な波が紙のように巻き上がります。暗い外側の内には、青から紫、桃色、黄色へ変わる明るいモザイクが広がります。波頭から四角い欠片が散り、その下の水面へ色が伸びます。'),
        ('wallpapers', 'neon-tide-6', 'Memory delta', 'An electric blue river branches between black, faceted rocks. Its smooth bends gradually become stepped channels and square-edged islands near the mouth. Magenta light catches the banks as the delta breaks into smaller geometric fragments.', '記憶の三角州', '鮮烈な青い川が、黒い多面体の岩の間で枝分かれします。河口に近づくにつれ、滑らかな曲がりは段状の水路と四角い島に変わります。三角州が細かな幾何学の欠片へ分かれる岸を、赤紫の光が照らします。'),
        ('wallpapers', 'neon-tide-7', 'Lunar molt', 'A dark moon sheds square pieces of its shell, exposing a glowing coral interior. The fragments descend toward the violet sea and become small black islands with illuminated shores. A diagonal trail connects the moon to the water.', '月の脱皮', '暗い月が四角い殻の欠片を落とし、光る珊瑚色の内部を見せています。欠片は紫の海へ降り、岸辺の光る小さな黒い島になります。月と水面を斜めの軌跡がつないでいます。'),
        ('wallpapers', 'neon-tide-8', 'Stairway through mist', 'Separate basalt steps float above a valley filled with lilac mist. Their dark stone tops contrast with grids of pink and blue light underneath. The stairway narrows into the distance, where its highest steps dissolve into scattered pixels.', '霧を抜ける階段', '薄紫の霧に満たされた谷の上に、玄武岩の段が一つずつ浮かびます。暗い石の上面と、下側の桃色や青の光の格子が対照をなします。階段は遠くへ向かって細くなり、一番高い段は散らばるピクセルにほどけます。'),
        ('wallpapers', 'neon-tide-9', 'Rings of light', 'A charred tree cross-section reveals uneven growth rings made of colored squares. Amber, lime, coral, and violet bands follow the grain around a dark center. Deep radial cracks split the wood, with light glowing along their inner edges.', '光の年輪', '焦げた木の断面に、色の四角からできた不揃いの年輪が現れます。琥珀、黄緑、珊瑚色、紫の帯が、暗い中心の周りで木目に沿って巡ります。放射状の深い割れ目が木を分け、その内縁に光がにじみます。'),
        ('wallpapers', 'neon-tide-10', 'The lake overhead', 'A still lake rests on the ceiling of a cavern, its surface reflecting the surrounding rocks. Glowing square droplets rise toward it through the open space above a dry stone floor. Magenta and icy blue reflections trace the dark cave walls.', '頭上の湖', '洞窟の天井に静かな湖があり、周りの岩を映しています。乾いた石の床の上を、光る四角い水滴が湖へ向かって昇ります。赤紫と氷のような青の反射が、洞窟の暗い壁をなぞります。')
    ) AS translations(kind, id, title, description, ja_title, ja_description)
    LOOP
        EXECUTE format('SELECT data FROM public.%I WHERE id = $1', translation.kind)
            INTO existing USING translation.id;
        IF existing IS NULL THEN CONTINUE; END IF;
        updated := existing;
        FOREACH field IN ARRAY ARRAY['title', 'description'] LOOP
            IF NULLIF(btrim(existing #>> ARRAY[field, 'ja']), '') IS NULL THEN
                expected := CASE field WHEN 'title' THEN translation.title ELSE translation.description END;
                japanese := CASE field WHEN 'title' THEN translation.ja_title ELSE translation.ja_description END;
                IF existing #>> ARRAY[field, 'en'] IS DISTINCT FROM expected THEN
                    RAISE EXCEPTION 'Japanese translation source changed: % / %', translation.id, field;
                END IF;
                updated := jsonb_set(updated, ARRAY[field, 'ja'], to_jsonb(japanese));
            END IF;
        END LOOP;
        IF updated IS DISTINCT FROM existing THEN
            EXECUTE format('UPDATE public.%I SET data = $2, version = version + 1 WHERE id = $1', translation.kind)
                USING translation.id, updated;
        END IF;
    END LOOP;
    FOR item IN SELECT id, data FROM public.collections UNION ALL SELECT id, data FROM public.wallpapers LOOP
        FOREACH field IN ARRAY ARRAY['title', 'description'] LOOP
            IF jsonb_typeof(item.data #> ARRAY[field, 'ja']) IS DISTINCT FROM 'string'
               OR NULLIF(btrim(item.data #>> ARRAY[field, 'ja']), '') IS NULL THEN
                RAISE EXCEPTION 'Japanese translation required before upgrade: % / %', item.id, field;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;
