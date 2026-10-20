-- Arabic translations extend existing records without changing their identity or chronology.
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
    arabic text;
    item record;
BEGIN
    FOR translation IN SELECT * FROM (VALUES
        ('collections', '0006-neon-tide', 'Neon Tide', 'Ten surreal wallpaper scenes bring glowing pixel patterns into dark coastal landscapes and imagined natural spaces. Black silhouettes and faceted rock give the collection its shape. Violet and magenta dominate the palette, with icy blue water and occasional amber or lime accents. Curved shorelines and living forms sit beside crisp square details, from flower petals to fragments of a moon.

Each scene has separate landscape and portrait compositions for desktop and phone screens.', 'مدّ النيون', 'عشرة مشاهد سريالية تنقل أنماط البكسل المتوهجة إلى سواحل داكنة وفضاءات طبيعية متخيّلة. ترسم الظلال السوداء والصخور متعددة الأوجه ملامح المجموعة. يهيمن البنفسجي والأرجواني، مع مياه زرقاء جليدية ولمسات كهرمانية أو ليمونية متفرقة. تجاور السواحل المنحنية والأشكال الحية تفاصيل مربعة واضحة، من بتلات الزهور إلى شظايا القمر.

لكل مشهد تكوين أفقي مستقل للكمبيوتر وآخر عمودي للهاتف.'),
        ('collections', '0005-a-night-beneath-the-ice', 'A Night Beneath the Ice', 'Five quiet night scenes where ice, dark firs and warm city lights meet blue luminous rings.', 'ليلة تحت الجليد', 'خمسة مشاهد ليلية هادئة يلتقي فيها الجليد والتنوب الداكن وأضواء المدينة الدافئة بحلقات زرقاء مضيئة.'),
        ('collections', '0004-where-stars-graze', 'Where Stars Graze', 'Five night scenes with a shaggy ginger cow, a windmill and a blue-violet comet above misty mountains.', 'حيث ترعى النجوم', 'خمسة مشاهد ليلية تضم بقرة نحاسية كثيفة الشعر وطاحونة هواء ومذنّبًا أزرق بنفسجيًا فوق جبال ضبابية.'),
        ('collections', '0003-path-to-the-light', 'Path to the Light', 'Five quiet journeys towards a golden circle through cities, mountains, forests and ruins.', 'الطريق إلى الضوء', 'خمس رحلات هادئة نحو دائرة ذهبية عبر مدن وجبال وغابات وأطلال.'),
        ('collections', '0002-woven-spectrum', 'Woven Spectrum', 'Bright strands of colour twist, fold and meet against deep red and black.', 'طيف منسوج', 'خيوط لونية زاهية تلتوي وتنثني وتلتقي على خلفية من الأحمر العميق والأسود.'),
        ('collections', '0001-contours-of-silence', 'Contours of Silence', 'Blue and violet forms emerge from the dark: dunes, glass, water and distant light.', 'ملامح الصمت', 'أشكال زرقاء وبنفسجية تظهر من العتمة: كثبان وزجاج وماء وضوء بعيد.'),
        ('wallpapers', 'contours-of-silence-1', 'Violet Horizon', 'Dark dunes with a thin violet glow under a star-filled sky.', 'أفق بنفسجي', 'كثبان داكنة يحدّها وهج بنفسجي رفيع تحت سماء مليئة بالنجوم.'),
        ('wallpapers', 'contours-of-silence-2', 'Edge of Quiet', 'A single luminous ridge cuts diagonally through a dark dune.', 'حافة السكون', 'حافة مضيئة واحدة تشق كثيبًا داكنًا بصورة مائلة.'),
        ('wallpapers', 'contours-of-silence-3', 'Glass Current', 'Translucent blue folds float against an almost black background.', 'تيار زجاجي', 'ثنيات زرقاء شبه شفافة تطفو على خلفية تكاد تكون سوداء.'),
        ('wallpapers', 'contours-of-silence-4', 'Folded Light', 'Sharp metallic folds catch blue and violet light in the dark.', 'ضوء مطوي', 'ثنيات معدنية حادة تلتقط الضوء الأزرق والبنفسجي في العتمة.'),
        ('wallpapers', 'contours-of-silence-5', 'The Quiet Gate', 'A weathered stone arch holds a deep blue glow beneath the night sky.', 'البوابة الهادئة', 'قوس حجري عتيق يحتضن وهجًا أزرق عميقًا تحت سماء الليل.'),
        ('wallpapers', 'contours-of-silence-6', 'Midnight Ribbon', 'A luminous blue-violet ribbon twists across a field of black.', 'شريط منتصف الليل', 'شريط أزرق بنفسجي مضيء يلتوي عبر مساحة سوداء.'),
        ('wallpapers', 'contours-of-silence-7', 'Violet Cloud', 'Soft plumes of purple smoke gather and dissolve in the dark.', 'سحابة بنفسجية', 'خصلات ناعمة من الدخان البنفسجي تتجمع وتتلاشى في العتمة.'),
        ('wallpapers', 'contours-of-silence-8', 'After the Wave', 'A low ocean wave catches electric blue light beneath a dark horizon.', 'بعد الموجة', 'موجة بحرية منخفضة تلتقط ضوءًا أزرق كهربائيًا تحت أفق داكن.'),
        ('wallpapers', 'contours-of-silence-9', 'Suspended Crystal', 'A dark faceted crystal floats above a small pool of blue light.', 'بلّور معلّق', 'بلّورة داكنة متعددة الأوجه تطفو فوق بقعة صغيرة من الضوء الأزرق.'),
        ('wallpapers', 'contours-of-silence-10', 'Lightfall', 'Vertical blue and violet light falls into a quiet nocturnal landscape.', 'انهمار الضوء', 'ينهمر ضوء أزرق وبنفسجي عموديًا على منظر ليلي هادئ.'),
        ('wallpapers', 'contours-of-silence-11', 'Tree of the Night', 'An old tree stands in a violet-lit forest beneath a deep blue sky.', 'شجرة الليل', 'شجرة عتيقة تقف في غابة مضاءة بالبنفسجي تحت سماء زرقاء عميقة.'),
        ('wallpapers', 'contours-of-silence-12', 'Blue Fault', 'A glowing blue fissure runs across a dark rocky surface.', 'صدع أزرق', 'شق أزرق متوهج يمتد على سطح صخري داكن.'),
        ('wallpapers', 'contours-of-silence-13', 'Transparent Planes', 'Geometric glass planes intersect with thin electric blue edges.', 'سطوح شفافة', 'سطوح زجاجية هندسية تتقاطع عند حواف رفيعة زرقاء كهربائية.'),
        ('wallpapers', 'contours-of-silence-14', 'Distant Crescent', 'A narrow blue crescent reveals a distant planet in near-total darkness.', 'هلال بعيد', 'هلال أزرق ضيق يكشف كوكبًا بعيدًا في ظلام شبه تام.'),
        ('wallpapers', 'contours-of-silence-15', 'Night Garden', 'Leaves and flowers emerge from darkness in a faint blue-violet glow.', 'حديقة الليل', 'أوراق وزهور تظهر من العتمة في وهج أزرق بنفسجي خافت.'),
        ('wallpapers', 'woven-spectrum-1', 'Colour in Motion', 'Orange, pink and blue strands flow in broad waves over dark red.', 'لون يتحرك', 'خيوط برتقالية ووردية وزرقاء تتدفق في موجات عريضة فوق أحمر داكن.'),
        ('wallpapers', 'woven-spectrum-2', 'Between the Strands', 'Curved bands of warm and cool colour frame a calm, dark centre.', 'بين الخيوط', 'شرائط منحنية بألوان دافئة وباردة تحيط بمركز هادئ داكن.'),
        ('wallpapers', 'woven-spectrum-3', 'Spectrum Spiral', 'Bright ribbons wind into a vivid spiral of orange, blue and magenta.', 'حلزون الطيف', 'أشرطة زاهية تلتف في حلزون حيّ من البرتقالي والأزرق والأرجواني.'),
        ('wallpapers', 'woven-spectrum-4', 'Colour Rays', 'Fans of luminous colour spread from a single point across the frame.', 'أشعة اللون', 'أطياف لونية مضيئة تنتشر كالمراوح من نقطة واحدة عبر الصورة.'),
        ('wallpapers', 'woven-spectrum-5', 'Endless Loop', 'A bright multicolour loop floats over a deep crimson background.', 'حلقة بلا نهاية', 'حلقة زاهية متعددة الألوان تطفو فوق خلفية قرمزية عميقة.'),
        ('wallpapers', 'path-to-the-light-1', 'City of the Golden Ring', 'A lone traveller crosses a wide bridge toward a glowing ring above a fantasy city.', 'مدينة الحلقة الذهبية', 'مسافر وحيد يعبر جسرًا عريضًا نحو حلقة متوهجة فوق مدينة خيالية.'),
        ('wallpapers', 'path-to-the-light-2', 'Bridge to Dawn', 'A solitary figure follows a lit bridge to a vast golden circle at dusk.', 'جسر إلى الفجر', 'شخص وحيد يتبع جسرًا مضاءً نحو دائرة ذهبية هائلة عند الغسق.'),
        ('wallpapers', 'path-to-the-light-3', 'Still Water, Distant Light', 'A luminous ring rests between purple mountains and reflects in a still lake.', 'ماء ساكن وضوء بعيد', 'حلقة مضيئة تستقر بين جبال بنفسجية وتنعكس في بحيرة ساكنة.'),
        ('wallpapers', 'path-to-the-light-4', 'Forest of the Ring', 'A traveller follows a golden stream through dark trees towards a bright circle.', 'غابة الحلقة', 'مسافر يتبع جدولًا ذهبيًا بين أشجار داكنة نحو دائرة ساطعة.'),
        ('wallpapers', 'path-to-the-light-5', 'The Last Gate', 'A golden ring glows inside ancient ruins at the top of a stone staircase.', 'البوابة الأخيرة', 'حلقة ذهبية تتوهج داخل أطلال قديمة عند قمة درج حجري.'),
        ('wallpapers', 'where-stars-graze-1', 'Pasture Beneath the Comet', 'A shaggy ginger cow grazes among flowers beneath a blue comet, with a windmill and misty mountain valleys in the distance.', 'مرعى تحت المذنّب', 'بقرة نحاسية كثيفة الشعر ترعى بين الزهور تحت مذنّب أزرق، وتظهر في البعيد طاحونة هواء ووديان جبلية ضبابية.'),
        ('wallpapers', 'where-stars-graze-2', 'Windmill Above the Clouds', 'A winding road climbs to a windmill above clouds filling the valleys; a ginger cow rests among flowers beneath a blue-violet comet.', 'طاحونة فوق السحاب', 'طريق متعرج يصعد إلى طاحونة فوق سحب تملأ الوديان؛ وتستريح بقرة نحاسية بين الزهور تحت مذنّب أزرق بنفسجي.'),
        ('wallpapers', 'where-stars-graze-3', 'Across the Starry Valley', 'Travellers and a shaggy cow follow a rocky path above a misty valley, while a comet crosses the starry sky beside palms and a distant windmill.', 'عبر الوادي المرصّع بالنجوم', 'مسافرون وبقرة كثيفة الشعر يتبعون دربًا صخريًا فوق وادٍ ضبابي، بينما يعبر مذنّب السماء المرصّعة بالنجوم بجوار نخيل وطاحونة بعيدة.'),
        ('wallpapers', 'where-stars-graze-4', 'Comet Reflection', 'A ginger cow drinks at the flower-lined shore of a mountain lake, sending ripples through the reflection of a blue comet and the night sky.', 'انعكاس المذنّب', 'بقرة نحاسية تشرب عند شاطئ بحيرة جبلية تحيط به الزهور، فترسل تموجات عبر انعكاس مذنّب أزرق وسماء الليل.'),
        ('wallpapers', 'where-stars-graze-5', 'Under a Sky of Stars', 'A close view of a shaggy ginger cow with long horns, framed by flowers, misty mountains and a windmill beneath a bright blue-violet comet.', 'تحت سماء النجوم', 'لقطة قريبة لبقرة نحاسية كثيفة الشعر طويلة القرون، تحيط بها زهور وجبال ضبابية وطاحونة تحت مذنّب أزرق بنفسجي ساطع.'),
        ('wallpapers', 'a-night-beneath-the-ice-1', 'A Ring Among the Ice Floes', 'A golden dome leaves its reflection in dark water between broken ice floes, framed by a luminous blue ring.', 'حلقة بين قطع الجليد', 'تترك قبة ذهبية انعكاسها في ماء داكن بين قطع جليد متكسرة، تحيط بها حلقة زرقاء مضيئة.'),
        ('wallpapers', 'a-night-beneath-the-ice-2', 'Above the Frozen River', 'A blue ring hangs in heavy clouds above a misty river, ice floes and a waterfront glowing with golden lights.', 'فوق النهر المتجمّد', 'حلقة زرقاء تتدلى بين سحب ثقيلة فوق نهر ضبابي وقطع جليد وواجهة نهرية متوهجة بأضواء ذهبية.'),
        ('wallpapers', 'a-night-beneath-the-ice-3', 'The Blue Lantern', 'A blue ring lights an old wall beside a wet stone lane, while amber lanterns lead through firs towards a distant city.', 'الفانوس الأزرق', 'حلقة زرقاء تضيء جدارًا قديمًا بجوار زقاق حجري مبلل، فيما تقود فوانيس كهرمانية بين أشجار التنوب إلى مدينة بعيدة.'),
        ('wallpapers', 'a-night-beneath-the-ice-4', 'Lights on the Descent', 'Blue ring lamps follow a snowy stone path down through dark firs towards an icy river and a warmly lit city.', 'أضواء على المنحدر', 'مصابيح حلقية زرقاء تتبع دربًا حجريًا مكسوًا بالثلج ينحدر بين تنوب داكن نحو نهر جليدي ومدينة مضاءة بدفء.'),
        ('wallpapers', 'a-night-beneath-the-ice-5', 'A City Within', 'The silhouette of a man in a dark coat blends with firs, a golden waterfront and ice-strewn water beneath a floating blue ring.', 'مدينة في الداخل', 'يتداخل ظل رجل يرتدي معطفًا داكنًا مع أشجار تنوب وواجهة نهرية ذهبية وماء تتناثر فيه قطع الجليد تحت حلقة زرقاء طافية.'),
        ('wallpapers', 'neon-tide-1', 'Pointer archipelago', 'Black rock islands shaped like mouse pointers rise from a violet sea. Hot pink surf traces their stepped shores, while sharp magenta edges catch the light. The islands form a receding chain across broad stretches of open water.', 'أرخبيل المؤشرات', 'جزر صخرية سوداء على هيئة مؤشرات فأرة ترتفع من بحر بنفسجي. ترسم أمواج وردية زاهية شواطئها المتدرجة، وتلتقط حواف أرجوانية حادة الضوء. تصطف الجزر في سلسلة تتراجع إلى البعيد عبر مساحات واسعة من الماء المفتوح.'),
        ('wallpapers', 'neon-tide-2', 'Night herbarium', 'Flowers grow from slender, curved stems against a black background. Their petals are made of glowing squares, with lime buds opening into amber and lavender blooms. A few loose pixels drift away like pollen.', 'معشبة ليلية', 'تنمو زهور على سيقان رفيعة منحنية أمام خلفية سوداء. تتكون بتلاتها من مربعات متوهجة، وتتفتح براعم ليمونية إلى أزهار كهرمانية وخزامية. تنجرف وحدات بكسل قليلة منفلتة كحبوب اللقاح.'),
        ('wallpapers', 'neon-tide-3', 'Manta at dawn', 'A dark manta glides beneath an ink-blue sea, its broad wings edged in pink. Small blue and magenta squares form a constellation across its back. Coral currents trail behind it, following the curve of its long tail.', 'مانتا عند الفجر', 'تنساب سمكة مانتا داكنة تحت بحر أزرق حبري، وتحدّ زعانفها العريضة حواف وردية. تشكّل مربعات صغيرة زرقاء وأرجوانية كوكبة على ظهرها. تتبعها تيارات مرجانية ترسم انحناءة ذيلها الطويل.'),
        ('wallpapers', 'neon-tide-4', 'Ocean in a key', 'A single black keyboard key holds a miniature coastal bay. Violet water meets dark cliffs beneath a coral sky, and a lone tree stands above the shore. A thin stream spills over the front edge into the surrounding darkness.', 'محيط في مفتاح', 'يحتوي مفتاح أسود واحد من لوحة مفاتيح على خليج ساحلي مصغّر. تلتقي مياه بنفسجية بجروف داكنة تحت سماء مرجانية، وتقف شجرة وحيدة فوق الشاطئ. ينسكب جدول رفيع من الحافة الأمامية إلى العتمة المحيطة.'),
        ('wallpapers', 'neon-tide-5', 'Inside the wave', 'An enormous wave curls like a sheet of paper. Its dark outer surface wraps around a bright mosaic that shifts from blue through violet and pink to yellow. Loose squares scatter from the crest, and the colors stretch across the water below.', 'داخل الموجة', 'تلتف موجة هائلة كورقة. يحيط سطحها الخارجي الداكن بفسيفساء مضيئة تتدرج من الأزرق إلى البنفسجي والوردي فالأصفر. تتناثر مربعات منفلتة من القمة، وتمتد الألوان على الماء تحتها.'),
        ('wallpapers', 'neon-tide-6', 'Memory delta', 'An electric blue river branches between black, faceted rocks. Its smooth bends gradually become stepped channels and square-edged islands near the mouth. Magenta light catches the banks as the delta breaks into smaller geometric fragments.', 'دلتا الذاكرة', 'يتفرع نهر أزرق كهربائي بين صخور سوداء متعددة الأوجه. تتحول انحناءاته الملساء تدريجيًا إلى قنوات متدرجة وجزر مربعة الحواف قرب المصب. يلتقط الشاطئ ضوءًا أرجوانيًا مع تفتت الدلتا إلى أجزاء هندسية أصغر.'),
        ('wallpapers', 'neon-tide-7', 'Lunar molt', 'A dark moon sheds square pieces of its shell, exposing a glowing coral interior. The fragments descend toward the violet sea and become small black islands with illuminated shores. A diagonal trail connects the moon to the water.', 'انسلاخ القمر', 'يسقط قمر داكن قطعًا مربعة من قشرته، كاشفًا عن داخل مرجاني متوهج. تهبط الشظايا نحو البحر البنفسجي وتصبح جزرًا سوداء صغيرة مضاءة الشواطئ. يصل أثر مائل بين القمر والماء.'),
        ('wallpapers', 'neon-tide-8', 'Stairway through mist', 'Separate basalt steps float above a valley filled with lilac mist. Their dark stone tops contrast with grids of pink and blue light underneath. The stairway narrows into the distance, where its highest steps dissolve into scattered pixels.', 'درج عبر الضباب', 'درجات بازلتية منفصلة تطفو فوق وادٍ مليء بضباب أرجواني فاتح. تتباين أسطحها الحجرية الداكنة مع شبكات الضوء الوردي والأزرق تحتها. يضيق الدرج في البعيد، وتذوب أعلى درجاته في وحدات بكسل متناثرة.'),
        ('wallpapers', 'neon-tide-9', 'Rings of light', 'A charred tree cross-section reveals uneven growth rings made of colored squares. Amber, lime, coral, and violet bands follow the grain around a dark center. Deep radial cracks split the wood, with light glowing along their inner edges.', 'حلقات الضوء', 'يكشف مقطع جذع متفحم حلقات نمو غير منتظمة من مربعات ملونة. تتبع شرائط كهرمانية وليمونية ومرجانية وبنفسجية عروق الخشب حول مركز داكن. تشق الخشبَ صدوع شعاعية عميقة يضيء باطن حوافها.'),
        ('wallpapers', 'neon-tide-10', 'The lake overhead', 'A still lake rests on the ceiling of a cavern, its surface reflecting the surrounding rocks. Glowing square droplets rise toward it through the open space above a dry stone floor. Magenta and icy blue reflections trace the dark cave walls.', 'بحيرة في الأعلى', 'تستقر بحيرة ساكنة على سقف كهف، ويعكس سطحها الصخور المحيطة. ترتفع نحوها قطرات مربعة متوهجة عبر الفراغ فوق أرضية حجرية جافة. ترسم انعكاسات أرجوانية وزرقاء جليدية جدران الكهف الداكنة.')
    ) AS translations(kind, id, title, description, ar_title, ar_description)
    LOOP
        EXECUTE format('SELECT data FROM public.%I WHERE id = $1', translation.kind)
            INTO existing USING translation.id;
        IF existing IS NULL THEN CONTINUE; END IF;
        updated := existing;
        FOREACH field IN ARRAY ARRAY['title', 'description'] LOOP
            IF NULLIF(btrim(existing #>> ARRAY[field, 'ar']), '') IS NULL THEN
                expected := CASE field WHEN 'title' THEN translation.title ELSE translation.description END;
                arabic := CASE field WHEN 'title' THEN translation.ar_title ELSE translation.ar_description END;
                IF existing #>> ARRAY[field, 'en'] IS DISTINCT FROM expected THEN
                    RAISE EXCEPTION 'Arabic translation source changed: % / %', translation.id, field;
                END IF;
                updated := jsonb_set(updated, ARRAY[field, 'ar'], to_jsonb(arabic));
            END IF;
        END LOOP;
        IF updated IS DISTINCT FROM existing THEN
            EXECUTE format('UPDATE public.%I SET data = $2, version = version + 1 WHERE id = $1', translation.kind)
                USING translation.id, updated;
        END IF;
    END LOOP;
    FOR item IN SELECT id, data FROM public.collections UNION ALL SELECT id, data FROM public.wallpapers LOOP
        FOREACH field IN ARRAY ARRAY['title', 'description'] LOOP
            IF jsonb_typeof(item.data #> ARRAY[field, 'ar']) IS DISTINCT FROM 'string'
               OR NULLIF(btrim(item.data #>> ARRAY[field, 'ar']), '') IS NULL THEN
                RAISE EXCEPTION 'Arabic translation required before upgrade: % / %', item.id, field;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;
