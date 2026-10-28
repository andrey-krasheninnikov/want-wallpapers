import publications from './collection-publications.json';
import type { Locale } from './catalog';

// Editorial copy stays outside the catalog snapshot refreshed by catalog:pull.
export const editorialCopy = {
  en: { title: 'Stories from the collections', story: 'The collection story', works: 'Scenes in this collection', sizes: 'Original PNG dimensions in pixels', files: 'Each design has a landscape PNG for desktop and a portrait PNG for mobile. The sizes below belong to these original files; gallery previews are smaller WebP images.', license: 'Usage license', licenseText: 'Personal, noncommercial wallpaper use and cropping for your own devices are permitted. Selling, redistributing wallpaper packs, claiming the images as your own work and commercial use are not permitted.', topics: 'Related themes' },
  ru: { title: 'Истории коллекций', story: 'История коллекции', works: 'Сцены коллекции', sizes: 'Размеры оригинальных PNG в пикселях', files: 'У каждой работы есть горизонтальный PNG для компьютера и вертикальный PNG для телефона. Ниже указаны размеры исходных файлов; в галерее используются уменьшенные изображения WebP.', license: 'Условия использования', licenseText: 'Разрешены личное некоммерческое использование обоев и обрезка для собственных устройств. Продажа, распространение наборов, публикация изображений как своих работ и коммерческое использование не разрешены.', topics: 'Похожие темы' },
  'zh-cn': { title: '系列中的故事', story: '这个系列的故事', works: '系列里的画面', sizes: '原始 PNG 的像素尺寸', files: '每张壁纸分别提供适合电脑的横向 PNG 和适合手机的纵向 PNG。下方列出的是这两个原始文件的像素尺寸；画廊展示的是尺寸较小的 WebP 预览图。', license: '使用许可', licenseText: '许可允许在自己的设备上将图片用作个人、非商业壁纸，也允许为自己的屏幕裁切图片。不允许出售图片、重新分发壁纸包、声称图片是自己的作品，或将图片用于商业项目。', topics: '相关主题' },
  'pt-br': { title: 'Histórias das coleções', story: 'A história da coleção', works: 'Cenas desta coleção', sizes: 'Dimensões dos PNG originais em pixels', files: 'Cada imagem tem um PNG horizontal para computador e um PNG vertical para celular. As dimensões abaixo são dos arquivos originais; a galeria mostra prévias menores em WebP.', license: 'Licença de uso', licenseText: 'É permitido usar as imagens como papéis de parede pessoais, sem finalidade comercial, e recortá-las para seus aparelhos. Não é permitido vender, redistribuir pacotes, apresentar as imagens como trabalho próprio ou usá-las comercialmente.', topics: 'Temas relacionados' },
  ja: {
    "title": "コレクションの物語",
    "story": "このコレクションの物語",
    "works": "コレクションの風景",
    "sizes": "オリジナル PNG のサイズ（ピクセル）",
    "files": "それぞれのデザインに、パソコン向けの横長 PNG とスマートフォン向けの縦長 PNG があります。以下はオリジナルファイルのピクセル寸法です。ギャラリーには容量の小さい WebP プレビューを使用しています。",
    "license": "利用ライセンス",
    "licenseText": "個人の非商用の壁紙としての利用と、ご自身の端末に合わせたトリミングが可能です。販売、壁紙パックの再配布、自作と偽ること、商用利用は認められていません。",
    "topics": "関連するテーマ"
  },

  ar: {
    "title": "حكايات المجموعات",
    "story": "حكاية المجموعة",
    "works": "مشاهد هذه المجموعة",
    "sizes": "أبعاد ملفات PNG الأصلية بالبكسل",
    "files": "لكل تصميم ملف PNG أفقي للكمبيوتر وملف PNG عمودي للهاتف. الأبعاد التالية تخص الملفات الأصلية؛ أما معاينات المعرض فهي صور WebP أصغر حجمًا.",
    "license": "ترخيص الاستخدام",
    "licenseText": "يُسمح بالاستخدام الشخصي غير التجاري كخلفية وبالاقتصاص لأجهزتك الخاصة. لا يُسمح بالبيع أو إعادة توزيع حزم الخلفيات أو ادعاء ملكية الأعمال أو الاستخدام التجاري.",
    "topics": "موضوعات ذات صلة"
  },
} satisfies Record<Locale, { title: string; story: string; works: string; sizes: string; files: string; license: string; licenseText: string; topics: string }>;

const legacyCollectionStories: Record<string, Record<Locale, string[]>> = {
  "trick-or-pixel": {
    "en": [
      "The tram bell rings once above the canal. On the bridge, a passenger holds a ticket so thin that the amber light passes through it. Below, a ferryman lifts his pole from the water. Blue squares slide off the wood and settle beside the boat, where three lanterns rock against their hooks. The passenger leans over the parapet to watch them drift beneath the arch. A witch crosses the moon, and her broom scatters sparks across the roofs. One catches on the tram wire and runs ahead toward the library.",
      "Inside, an open book lies beneath shelves that disappear into the vaulted ceiling. A bat climbs out of a sentence, shaking gold dust from its wings. The passenger lays the ticket between the pages. The paper folds itself into a small white ghost and slips through the window. Beyond the cemetery gate, a violet doorway opens. Stones along the path light up one after another as the ghost approaches. Its trailing edge leaves blue pieces among the grass. The tram arrives without a driver. Two pale faces wait at its amber windows. Farther down the line, the houses lose their windows and become black space. The carriage shrinks to a violet block with a dotted track. A pumpkin spider lowers itself beside the final stop, carrying the last orange light on its thread. Under the bridge, the ferryman catches a loose lantern with the crook of his pole. Its reflection stretches into a narrow orange ladder across the canal. He brings the boat alongside the cemetery steps and waits while the ghost folds its ticket back into a rectangle. The spider climbs a little higher. Beyond the library window, a single illuminated page turns toward the water, and another bat settles on the empty conductor's seat."
    ],
    "ru": [
      "Над каналом один раз звякнул трамвайный колокольчик. На мосту пассажир держал билет, такой тонкий, что янтарный свет проходил насквозь. Внизу перевозчик вытащил шест из воды. С дерева соскользнули голубые квадраты и легли возле лодки, где на крюках качались три фонаря. Пассажир перегнулся через парапет, провожая их под каменную арку. Ведьма пересекла луну, её метла рассыпала искры над крышами. Одна зацепилась за трамвайный провод и побежала вперёд, к библиотеке. Пассажир спрятал билет в рукав и спустился по мокрой лестнице, стараясь не наступать на свет между ступенями.",
      "Внутри на столе лежала раскрытая книга. Полки уходили под свод, и верхних рядов уже не было видно. Из строчки выбралась летучая мышь, стряхнула с крыльев золотую пыль и повисла под лампой. Пассажир положил билет между страницами. Бумага сама сложилась в маленького белого призрака и выскользнула в окно. За кладбищенской оградой открылся фиолетовый проход. Камни на дорожке загорались по очереди, пока призрак плыл к нему. Его край оставлял в траве голубые обрывки. Трамвай подошёл без водителя. В янтарных окнах ждали два бледных лица. Дальше по линии дома лишились окон и исчезли в чёрном пространстве. Вагон уменьшился до фиолетового прямоугольника, за ним остался короткий пунктир пути. Возле последней остановки спустился паук с тыквенным брюшком. Последний оранжевый огонёк держался на его нити, а под колёсами ещё мерцали два квадрата. Под мостом перевозчик подхватил сорвавшийся фонарь крючком шеста. Отражение вытянулось поперёк канала узкой оранжевой лестницей. Он подвёл лодку к кладбищенским ступеням и подождал, пока призрак снова сложит свой билет прямоугольником. Паук поднялся чуть выше по нити. За библиотечным окном освещённая страница повернулась к воде. Ещё одна летучая мышь устроилась на пустом месте кондуктора и зацепилась когтями за край сиденья. Под её крылом осталось золотое пятно. Фонарь перестал качаться, когда лодка коснулась нижней каменной ступени."
    ],
    "zh-cn": [
      "运河上方，电车铃只响了一声。桥上的乘客捏着一张薄薄的车票，琥珀色灯光从纸背透过。桥下，摆渡人把长篙提离水面，蓝色方块沿木头滑落，聚在小船旁边。三盏灯笼在挂钩上轻轻摇晃。乘客伏在栏杆上，看着光点漂进石拱下面。一位女巫从月亮前飞过，扫帚把火花撒向屋顶。其中一粒挂住电车线，沿着金属细线奔向图书馆。乘客把票塞进袖口，顺着湿阶梯下桥，鞋尖避开石缝里发亮的水。他推开木门，门上的铁环又碰了两下。",
      "桌上摊着一本书，书架一直升进看不见的拱顶。一只蝙蝠从文字间爬出，抖落翅膀上的金色粉末。乘客把票放进书页。薄纸自己折成一只白色幽灵，从窗缝溜了出去。墓园栏杆后，一道紫色门缓缓打开。幽灵经过时，小径上的石块依次亮起，蓝色碎片从它身后落进草里。电车停下，驾驶座上空无一人，两张苍白的脸贴在琥珀色车窗后。线路向远处延伸，房屋渐渐失去窗户，隐入大片黑暗。车厢缩成紫色小方块，身后只剩几格短短的轨道。一只南瓜蜘蛛沿细线降到终点旁，最后一粒橙色光停在线上。车轮下还有两块石头亮着，桥底的水带着灯影继续往前。 桥下，摆渡人用长篙的弯钩接住一盏松脱的灯笼。倒影横过运河，变成窄窄的橙色梯子。他把船靠向墓园的石阶，等幽灵把车票重新折成长方形。蜘蛛沿细线爬高了一点。图书馆窗内，一页发亮的纸转向水面。又一只蝙蝠落在空着的售票员座位上，爪子钩住椅边，翅膀下面留着一块金色光斑。小船碰到最低的石阶，灯笼终于不再摇动。"
    ],
    "pt-br": [
      "O sino do bonde toca uma vez sobre o canal. Na ponte, um passageiro segura um bilhete tão fino que a luz âmbar atravessa o papel. Lá embaixo, o barqueiro retira a vara da água. Quadrados azuis escorrem da madeira e se juntam ao barco, onde três lanternas balançam nos ganchos. O passageiro se inclina sobre o parapeito para vê-los passar sob o arco. Uma bruxa cruza a lua e espalha faíscas com a vassoura. Uma delas prende no fio do bonde e corre em direção à biblioteca. Ele guarda o bilhete na manga e desce a escada molhada.",
      "Um livro aberto espera sobre a mesa, sob estantes que somem na abóbada. Um morcego sai de uma frase, sacudindo poeira dourada das asas. O passageiro deixa o bilhete entre as páginas. O papel se dobra sozinho, vira um pequeno fantasma branco e escapa pela janela. Atrás do portão do cemitério, uma passagem violeta se abre. As pedras do caminho acendem uma por uma enquanto o fantasma se aproxima, deixando fragmentos azuis na grama. O bonde chega sem motorista. Dois rostos pálidos esperam nas janelas âmbar. Adiante, as casas perdem as janelas e desaparecem no espaço preto. O vagão diminui até virar um bloco violeta com um trilho pontilhado. Uma aranha de corpo de abóbora desce junto ao ponto final, levando a última luz laranja no fio. Sob a ponte, o barqueiro recolhe uma lanterna solta com a ponta curva da vara. O reflexo vira uma escada laranja sobre o canal. Ele encosta nos degraus do cemitério e espera o fantasma dobrar o bilhete. A aranha sobe pelo fio. Na biblioteca, uma página iluminada se volta para a água, enquanto outro morcego ocupa o assento vazio do cobrador."
    ],
    "ja": [
      "運河の上で電車のベルが一度鳴った。橋に立つ乗客は、琥珀色の光が透けるほど薄い切符を持っている。下では渡し守が水から竿を引き上げた。青い四角が木を伝って滑り落ち、舟のそばに集まる。三つの灯りが鉤に揺れている。乗客は欄干から身を乗り出し、光の粒が石のアーチの下へ流れるのを見送った。月の前を魔女が横切り、ほうきが屋根に火花を散らす。一粒が電線に引っかかり、図書館へ走っていった。乗客は切符を袖に入れ、濡れた階段を降りた。石の隙間にたまる光を、靴の先で踏まないように歩く。木の扉を押すと、鉄の輪が二度小さく鳴った。",
      "机に開いた本があり、棚は見えない天井まで続いていた。一行の文字からコウモリが這い出し、羽の金の粉を払う。乗客が切符をページに挟むと、紙は自分で折れて白い小さな幽霊になり、窓から抜け出した。墓地の柵の向こうで紫の門が開く。幽霊が近づくたびに小道の石が順番に灯り、裾から青い欠片が草へ落ちる。運転手のいない電車が停まった。琥珀色の窓で二つの白い顔が待っている。線路の先では家の窓が消え、建物も黒い空間に溶けていった。車体は紫の小さな塊になり、短い点線だけが後ろに残る。終点のそばにカボチャのクモが下りてきた。その糸に最後の橙色の光が留まり、車輪の下では二つの四角がまだ瞬いていた。 橋の下で渡し守が竿の鉤に外れた灯りを引っかけた。反射が運河を横切る細い橙の階段になる。舟を墓地の石段へ寄せ、幽霊が切符を長方形に折り直すのを待った。クモが糸を少しのぼる。図書館の窓では光る一枚の紙が水へ向きを変え、別のコウモリが車掌の空いた座席にとまった。舟が一番下の段に触れると、灯りの揺れが止まった。"
    ],
    "ar": [
      "رن جرس الترام مرة واحدة فوق القناة. على الجسر، حمل راكب تذكرة رقيقة يعبر الضوء الكهرماني ورقها. في الأسفل، رفع الملاح عصاه من الماء. انزلقت مربعات زرقاء على الخشب وتجمعت بجوار القارب، حيث تأرجحت ثلاثة فوانيس في خطاطيفها. انحنى الراكب فوق الحاجز يتابعها وهي تمر تحت القوس الحجري. عبرت ساحرة أمام القمر ونثرت مكنستها شررًا فوق الأسطح. تعلقت شرارة بسلك الترام وانطلقت نحو المكتبة. وضع الرجل تذكرته في كمه ونزل الدرج المبلل. تجنب بطرف حذائه الضوء المتجمع بين الحجارة، ثم دفع الباب الخشبي بكتفه. اصطدمت الحلقة الحديدية بالباب مرتين، وتحرك غبار خفيف تحت المصباح.",
      "كان كتاب مفتوح ينتظر على الطاولة، تحت رفوف تختفي في سقف مقوس. خرج خفاش من سطر ونفض عن جناحيه غبارًا ذهبيًا. وضع الراكب التذكرة بين الصفحات. طوى الورق نفسه وصار شبحًا أبيض صغيرًا تسلل عبر النافذة. خلف سياج المقبرة، انفتح ممر بنفسجي. أضاءت حجارة الطريق واحدة بعد أخرى كلما اقترب الشبح، وتناثرت من حافته قطع زرقاء بين العشب. وصل الترام بلا سائق. انتظر وجهان شاحبان خلف نافذتيه الكهرمانيتين. بعد المحطة، فقدت البيوت نوافذها ثم اختفت في فضاء أسود واسع. تقلصت العربة إلى كتلة بنفسجية تتبعها سكة قصيرة من النقاط. هبط عنكبوت ببطن يشبه اليقطينة قرب المحطة الأخيرة، يحمل الضوء البرتقالي الأخير على خيطه. وتحت العجلات، بقي مربعان يومضان بينما حمل ماء القناة انعكاس الفوانيس إلى ما وراء الجسر. تحت الجسر، التقط الملاح فانوسًا انفلت من خطافه بطرف العصا المعقوف. امتد انعكاسه عبر القناة كسلم برتقالي ضيق. قرب القارب من درجات المقبرة وانتظر الشبح ليطوي تذكرته مستطيلًا من جديد. صعد العنكبوت قليلًا على الخيط. وراء نافذة المكتبة، استدارت صفحة مضيئة نحو الماء، واستقر خفاش آخر على مقعد المحصل الفارغ. علقت مخالبه بحافة المقعد، وبقيت بقعة ذهبية تحت جناحه. توقف الفانوس عن التأرجح عندما لامس القارب أدنى درجة حجرية."
    ]
  },
  "tiny-impossibilities": {
    "en": [
      "She opens the matchbox beside the kitchen sink. A small lime sun rises from the drawer and warms one corner of the counter. The match lying along its edge casts a long blue shadow. Outside the window, someone has clipped a cloud to the washing line. Strips of color hang from it, their ends stopping just above the yard. She takes her cup outside and reaches for a peg. A square comes loose from the cloud, slips between two brackets on the wall and knocks the right one into pieces.",
      "A mouse waits below the line. When it turns toward the sun, a dragon shadow climbs across the lime wall, spreading wings over the window. The mouse sniffs the broken bracket and carries one fragment under the gate. She sets the cup on the step. Coffee rises from it in a narrow stream, pauses above the rim and breaks into square drops. One lands in her palm without leaving a mark. Another becomes an indigo droplet large enough to hold a whale. Its little fountain taps against the inside of the water. She shifts her hand, and the whale turns with the light. The cloud drips a final strip onto the step. Behind the gate, the mouse pulls its blue fragment through the gap, and the dragon shadow folds one wing against the wall. She carries the matchbox out through the doorway and sets it underneath the hanging cloud. The clothespins cast narrow indigo shadows over the drawer. A thread of coffee loops around one peg without touching the washing line. Beneath the gate, the mouse pushes back a triangular chip of blue. She places it beside the cup, where the whale's reflection travels across its surface, following the last slowly turning droplet toward the warm open box."
    ],
    "ru": [
      "Она открыла спичечный коробок возле кухонной раковины. Из лотка поднялось маленькое салатовое солнце и согрело угол столешницы. Спичка у края отбрасывала длинную синюю тень. За окном кто-то прицепил облако к бельевой верёвке. С него свисали цветные полосы, их концы останавливались над самым двором. Она вынесла чашку на крыльцо и потянулась к прищепке. От облака отделился квадрат, проскользнул между двумя скобками на стене и выбил из правой несколько кусочков. Они упали без звука. Она присела на нижнюю ступеньку, поставив чашку возле босой ноги, и заглянула под верёвку, которая едва заметно дрожала на ветру.",
      "Внизу сидела мышь. Когда она повернулась к солнцу, по салатовой стене поднялась тень дракона, раскинув крылья над окном. Мышь обнюхала сломанную скобку и утащила один обломок под калитку. Из оставленной на ступени чашки потянулась вверх узкая струя кофе. Она замерла над краем и распалась на квадратные капли. Одна легла на ладонь, не оставив следа. Другая превратилась в индиговую каплю, достаточно большую, чтобы вместить кита. Маленький фонтан упирался в воду изнутри. Она повернула ладонь, и кит развернулся вслед за светом. Облако уронило на ступеньку последнюю цветную полосу. За калиткой мышь протащила синий обломок через щель. Тень дракона сложила одно крыло вдоль стены, а второе осталось над кухонным окном. В коробке у раковины медленно светился край солнца. Она вынесла коробок через дверной проём и поставила под подвешенным облаком. От прищепок легли узкие индиговые тени на открытый лоток. Струйка кофе обогнула одну из них, не коснувшись верёвки. Из-под калитки мышь вытолкнула обратно треугольный синий осколок. Женщина положила его возле чашки. По поверхности прошёл отблеск кита, следуя за последней медленно вращающейся каплей к тёплому коробку. Спичка съехала к краю, и женщина придержала её пальцем. Над двором качнулся свободный конец салатовой полосы."
    ],
    "zh-cn": [
      "她在厨房水槽旁拉开火柴盒。抽屉里升起一轮小小的青柠色太阳，照暖了台面的一角。靠在盒边的火柴投出长长的蓝影。窗外，有人把一朵云夹在晾衣绳上。彩色条带从云底垂下，末端停在院子上方。她端着杯子走到门阶，伸手去够夹子。一块小方块从云中脱落，钻过墙上的两只括号，把右边撞碎了几格。碎片无声落下。她坐在最低一级台阶，把杯子放在脚边，弯腰看向轻轻摇动的绳子下面。小院里没有别的脚步声，只有杯柄碰到石头时响了一下。",
      "一只老鼠等在那里。它转向太阳，身后巨大的龙影爬上青柠色墙面，翅膀张过窗框。老鼠闻了闻破括号，拖着一块碎片钻到院门下面。杯里的咖啡向上拉出细线，停在杯口上方，随后分成方形液滴。一滴落在她掌心，没有留下湿痕。另一滴变成靛蓝色的水珠，宽得足以容下一头鲸鱼。鲸的小喷泉从里面轻轻碰着水面。她转动手掌，鲸鱼跟着光转身。云朵滴下最后一条颜色，搭在她身旁的石阶上。门外，老鼠把蓝色碎片拖过窄缝。墙上的龙影收拢一边翅膀，另一边仍遮着厨房窗户。水槽旁的火柴盒没有关上，一道细细的亮边留在抽屉口，照着那根火柴。 她把火柴盒从门里端出来，放到悬着的云下面。夹子在打开的抽屉上投下窄窄的靛蓝影子。一线咖啡绕过其中一只夹子，没有碰到晾衣绳。院门底下，老鼠把一块蓝色三角碎片推了回来。她把它放在杯边，鲸鱼的倒影划过表面，跟着最后一滴缓缓转动的水珠靠近温暖的盒子。火柴向边缘滑去，她伸出一根手指挡住。院子上方，青柠色条带松开的末端轻轻摆了一下。"
    ],
    "pt-br": [
      "Ela abre a caixa de fósforos ao lado da pia. Um pequeno sol verde-lima nasce na gaveta e aquece um canto da bancada. O fósforo apoiado na borda projeta uma sombra azul comprida. Pela janela, ela vê uma nuvem presa ao varal. Tiras coloridas pendem dela, parando pouco acima do quintal. Ela leva a xícara para fora e estica a mão até um pregador. Um quadrado se solta da nuvem, passa entre dois colchetes na parede e quebra o da direita em pedaços. Ela senta no degrau de baixo, deixando a xícara junto ao pé.",
      "Um rato espera debaixo do varal. Quando se vira para o sol, uma sombra de dragão sobe pela parede verde-lima, abrindo asas sobre a janela. O rato cheira o colchete quebrado e arrasta um fragmento por baixo do portão. Da xícara no degrau, o café sobe num fio estreito, para acima da borda e se divide em gotas quadradas. Uma pousa na palma dela sem deixar marca. Outra vira uma gota índigo grande o bastante para abrigar uma baleia. Seu pequeno esguicho toca a água por dentro. Ela gira a mão, e a baleia acompanha a luz. A nuvem deixa cair a última tira de cor no degrau. Atrás do portão, o rato puxa o fragmento azul pela fresta, e a sombra do dragão dobra uma asa contra a parede. Ela traz a caixa para fora e a põe sob a nuvem. Os pregadores desenham sombras índigo na gaveta aberta. Um fio de café contorna um deles sem tocar o varal. O rato devolve uma lasca azul por baixo do portão. Ela a deixa ao lado da xícara, onde o reflexo da baleia acompanha a última gota girando em direção à caixa morna."
    ],
    "ja": [
      "彼女は台所の流しのそばでマッチ箱を開けた。引き出しから小さなライム色の太陽が昇り、台の隅を暖める。縁に置かれたマッチは長い青い影を落としていた。窓の外では、誰かが物干し綱に雲を留めている。色の帯が雲から下がり、庭に届く少し前で止まっていた。彼女はカップを外へ運び、洗濯ばさみに手を伸ばす。一つの四角が雲から離れ、壁の二つの括弧の間を抜けて、右側をばらばらにした。欠片は音もなく落ちた。彼女は一番下の段に座り、裸足のそばにカップを置いて、細く揺れる綱の下をのぞいた。庭にはほかの足音がなく、石に触れた取っ手が小さく鳴った。",
      "そこにネズミがいた。太陽へ向きを変えると、大きな竜の影がライム色の壁をのぼり、窓の上に翼を広げる。ネズミは壊れた括弧の匂いを嗅ぎ、一片を門の下へ引いていった。段の上のカップから、コーヒーが細い流れになって昇る。縁の上で止まり、四角いしずくに分かれた。一つが手のひらに乗ったが、濡れた跡はつかない。もう一つは、クジラが入るほど大きな藍色のしずくになった。小さな潮が内側から水面を叩いている。彼女が手を傾けると、クジラも光を追って向きを変えた。雲から最後の色の帯が落ち、石段にかかる。門の向こうでは、ネズミが青い欠片を隙間に引き込み、竜の影が片方の翼を壁に沿って畳んだ。もう片方は台所の窓の上に残っていた。 彼女はマッチ箱を戸口から外へ運び、雲の下に置いた。洗濯ばさみの細い藍色の影が開いた引き出しに落ちる。コーヒーの糸が一つのばさみを回り、綱には触れなかった。門の下からネズミが青い三角の欠片を押し戻してきた。彼女がカップの隣に置くと、その表面をクジラの反射が通り、最後のゆっくり回るしずくを追って暖かい箱へ近づいた。縁へ滑るマッチを指で止めると、雲の帯の端が庭の上で揺れた。"
    ],
    "ar": [
      "فتحت علبة الثقاب قرب حوض المطبخ. ارتفعت شمس صغيرة خضراء ليمونية من درجها ودفأت زاوية من الطاولة. ألقت عود الثقاب المستند إلى الحافة ظلًا أزرق طويلًا. خارج النافذة، علق أحدهم سحابة على حبل الغسيل. تدلت منها شرائط ملونة، وتوقفت أطرافها فوق أرض الفناء بقليل. حملت فنجانها إلى الخارج ومدت يدها إلى مشبك. انفصل مربع عن السحابة، وانزلق بين قوسين على الجدار، وكسر القوس الأيمن إلى قطع صغيرة. سقطت القطع من دون صوت. جلست على الدرجة السفلى ووضعت الفنجان قرب قدمها الحافية، ثم انحنت تنظر تحت الحبل الذي كان يهتز قليلًا. لم تسمع خطوات أخرى في الفناء، ولامس مقبض الفنجان الحجر بنقرة قصيرة.",
      "انتظر فأر تحت الحبل. وعندما استدار نحو الشمس، صعد ظل تنين هائل على الجدار الأخضر وفرد جناحيه فوق النافذة. شم الفأر القوس المكسور وسحب قطعة منه تحت البوابة. صعدت القهوة من الفنجان في خيط رفيع، وتوقفت فوق الحافة، ثم تفرقت إلى قطرات مربعة. استقرت واحدة في كفها ولم تترك أثرًا. وتحولت أخرى إلى قطرة نيلية تتسع لحوت صغير. لامست نافورته سطح الماء من الداخل. أدارت كفها، فاستدار الحوت مع الضوء. أسقطت السحابة آخر شريط ملون على الدرجة. خلف البوابة، جر الفأر القطعة الزرقاء عبر الشق، وطوى ظل التنين جناحًا على امتداد الجدار. ظل الجناح الآخر فوق نافذة المطبخ، وبقي طرف الشمس يضيء بهدوء داخل العلبة المفتوحة قرب الحوض. حملت العلبة عبر الباب ووضعتها تحت السحابة المعلقة. ألقت المشابك ظلالًا نيلية ضيقة فوق الدرج المفتوح. التف خيط من القهوة حول مشبك من دون أن يلمس حبل الغسيل. من تحت البوابة، دفع الفأر قطعة زرقاء مثلثة إلى الخارج. وضعتها قرب الفنجان، حيث عبر انعكاس الحوت سطحها متتبعًا آخر قطرة تدور ببطء نحو العلبة الدافئة. انزلقت عود الثقاب إلى الحافة، فأوقفته بإصبعها. وفوق الفناء تأرجح الطرف الحر للشريط الأخضر مرة واحدة."
    ]
  },
  "midnight-bloom": {
    "en": [
      "At midnight, the gardener carries a shallow tray into the dark room. A petal lies inside it, folded around a thin cyan current. When she tilts the tray, the current stays in place and the petal turns beneath it. Above her workbench, three flowers hang from the underside of a blue oval. Their stems move when she passes, though the room has no open window. A grain of pollen leaves the nearest flower and joins a broken violet orbit. She follows it with the corner of a glass frame, keeping her fingers outside the ring.",
      "On the bench, three square frames overlap around a pressed blossom. Beneath them, a droplet waits above rings of water that reflect petals from somewhere beyond the ceiling. The gardener sets a dark stone beside the tray. A cyan crack crosses it; a small flower has opened in the narrowest part. She turns the stone to make room for a ribbon with flowering ends. Its pink fold brushes the glass. At the far edge of the bench, a grass blade bends over a dewdrop. A black disk passes through its colored rim. The gardener lays down a bare twig. Its shadow reaches past the tray, and flowers open along the shadow while the wood stays pale. A separated petal settles beside her wrist. She moves the empty frame over it and leaves the corner resting against the stone. From the drawer beneath the bench, she takes a pair of narrow tweezers and places them beside the separated petals. The smallest petal turns on its edge, exposing a coral square on the underside. She holds the empty frame above the tray until the cyan current passes through its opening. A reflected flower slides across the glass. Behind her chair, the twig's shadow bends around the leg and opens one more blossom near the floor."
    ],
    "ru": [
      "В полночь садовница внесла в тёмную комнату неглубокий поднос. На нём лежал лепесток, сложенный вокруг тонкого бирюзового течения. Она наклонила поднос, но течение осталось на месте, а лепесток повернулся под ним. Над рабочим столом с нижней стороны синего овала свисали три цветка. Стебли качнулись, когда она прошла мимо, хотя в комнате не было открытого окна. Пылинка покинула ближайший цветок и пристроилась к разомкнутой фиолетовой орбите. Садовница повела за ней углом стеклянной рамки, удерживая пальцы за пределами кольца. Стекло поймало голубой отсвет и на мгновение осветило пустую стену. Она подвинула стул, чтобы сесть ближе к краю стола.",
      "На столе три квадратные рамки пересекались вокруг засушенного венчика. Под ними капля ждала над кольцами воды, отражавшими лепестки откуда-то из-за потолка. Садовница положила рядом с подносом тёмный камень. Его пересекала бирюзовая трещина, и в самом узком месте уже раскрылся маленький цветок. Она повернула камень, освобождая место для ленты с цветущими концами. Розовая складка задела стекло. У дальнего края стола травинка склонилась над росинкой. Внутри цветного ободка медленно прошёл чёрный диск. Садовница опустила на стол голую светлую ветку. Её тень вытянулась за поднос, и вдоль тени начали раскрываться цветы, пока сама древесина оставалась бледной. Отдельный лепесток лёг возле запястья. Садовница подвела к нему пустую рамку и оставила её угол опираться на камень. Из ящика под столом она достала узкий пинцет и положила рядом с отдельными лепестками. Самый маленький повернулся на ребро, открыв коралловый квадрат снизу. Садовница подняла пустую рамку над подносом и дождалась, пока бирюзовое течение пройдёт через её проём. По стеклу скользнул отражённый цветок. За стулом тень ветки обогнула ножку и раскрыла ещё один бутон у самого пола. Пинцет остался на столе. В его сомкнутых концах отразилась тонкая голубая полоска, а рядом медленно повернулась самая нижняя рамка."
    ],
    "zh-cn": [
      "午夜，园丁把一只浅盘端进暗室。盘里躺着一片花瓣，围着细细的青色水流折起。她倾斜托盘，水流没有移动，花瓣却在下面转了个方向。工作台上方，三朵花从蓝色椭圆的底面垂下。她经过时，花茎轻轻摇摆，房间里却没有打开的窗。一粒花粉离开最近的花，加入一道断开的紫色轨道。她举起玻璃框的一角跟着它移动，手指始终留在光环外侧。玻璃接住蓝色反光，在空墙上照出一小块亮面。她拖动椅子，坐到靠近台边的位置，袖口擦过托盘，发出很轻的一声响。",
      "台上，三层方框围着一朵压平的花互相交错。框下有一滴水悬在波纹上方，水环里映出像是来自天花板外面的花瓣。她把深色石块放在盘旁，青色裂纹穿过石面，最窄的地方已经开出一朵小花。她转开石头，给末端带花的丝带腾出地方。粉色折痕轻触玻璃。工作台远端，一根草弯在露珠上方，黑色圆盘缓缓经过彩色边缘。园丁放下一段浅色裸枝。它的影子伸过托盘，影枝上渐渐开花，木头本身仍然苍白。一片散开的花瓣落到她手腕旁。她把空框移过去，让一角靠着石块。屋里没有风，三根下垂的花茎仍轻轻晃动，那粒花粉从断开的轨道口经过，又回到玻璃的另一边。 她从台下抽屉取出细长的镊子，放在散开的花瓣旁。最小的一片侧过来，露出背面一格珊瑚色。她把空框举到浅盘上方，等青色水流穿过方形开口。玻璃上滑过一朵花的倒影。椅子后面，枝影绕过椅腿，又在靠近地板的地方开出一朵花。镊子留在台上，合拢的尖端映出细细的蓝线，旁边最下层的方框慢慢转动，边角始终没有离开石面。"
    ],
    "pt-br": [
      "À meia-noite, a jardineira leva uma bandeja rasa para o quarto escuro. Uma pétala está dobrada em torno de uma corrente fina de água ciano. Ela inclina a bandeja, mas a corrente fica no lugar e a pétala gira por baixo. Acima da bancada, três flores pendem da parte inferior de uma forma oval azul. Os caules se movem quando ela passa, embora não haja janela aberta. Um grão de pólen sai da flor mais próxima e entra numa órbita violeta interrompida. Ela o acompanha com o canto de uma moldura de vidro, mantendo os dedos fora do anel.",
      "Na bancada, três molduras quadradas se sobrepõem ao redor de uma flor prensada. Abaixo delas, uma gota espera sobre anéis de água que refletem pétalas vindas de algum ponto além do teto. A jardineira põe uma pedra escura junto à bandeja. Uma fenda ciano a atravessa, e uma pequena flor se abriu no trecho mais estreito. Ela gira a pedra para acomodar uma fita com pontas floridas. A dobra rosa roça o vidro. Na outra ponta da bancada, uma folha de grama se curva sobre uma gota de orvalho. Um disco preto passa pelo aro colorido. A jardineira deixa um galho sem folhas na mesa. A sombra alcança o outro lado da bandeja e flores se abrem nela, enquanto a madeira continua pálida. Uma pétala solta pousa junto ao pulso. Ela apoia a moldura vazia sobre a pedra, deixando a pétala dentro do quadrado. Da gaveta, ela tira uma pinça estreita e a deixa junto às pétalas soltas. A menor vira de lado, mostrando um quadrado coral. A jardineira ergue a moldura até a corrente ciano atravessar sua abertura. Uma flor refletida desliza pelo vidro. Atrás da cadeira, a sombra do galho contorna uma perna e abre outra flor perto do chão."
    ],
    "ja": [
      "真夜中、庭師は浅い盆を暗い部屋へ運んだ。中には細い水色の流れを包むように折れた花びらがある。盆を傾けても流れは動かず、花びらだけがその下で向きを変えた。作業台の上では、青い楕円の裏側から三輪の花が下がっている。彼女が通ると茎が揺れたが、部屋に開いた窓はない。近い花から花粉が一粒離れ、途切れた紫の軌道へ入った。彼女はガラスの枠の角でそれを追い、指は輪の外に置いた。ガラスに青い反射が映り、何もない壁が一瞬明るくなる。彼女は椅子を引いて台の縁に近づき、盆に触れた袖を静かにずらした。",
      "台には三つの四角い枠が重なり、押し花を囲んでいた。その下で一滴の水が波紋の上に留まっている。輪には天井の向こうから来たような花びらが映る。庭師は盆の隣に暗い石を置いた。水色の裂け目が石を横切り、一番細いところに小さな花が開いていた。彼女は石を回し、先端に花のついたリボンの場所を空ける。桃色の折り目がガラスをかすめた。台の向こう側では、草が露の上に曲がり、色の輪の内側を黒い円がゆっくり通り過ぎる。庭師は淡い裸枝を下ろした。影が盆の向こうへ伸び、木は白いまま、影の枝だけに花が開いていく。離れた花びらが手首のそばに落ちた。彼女は空の枠を寄せ、その角を石に預けた。 台の下の引き出しから細いピンセットを出し、離れた花びらの隣に置いた。一番小さい花びらが縁を立て、裏側の珊瑚色の四角を見せる。庭師は空の枠を盆の上へ持ち上げ、水色の流れが穴を抜けるまで待った。ガラスを花の反射がすべる。椅子の後ろでは枝の影が脚を回り込み、床に近いところでもう一輪開いた。机に残したピンセットの先に青い細い線が映り、下の枠が石に触れたまま少し回った。"
    ],
    "ar": [
      "عند منتصف الليل، حملت البستانية صينية ضحلة إلى الغرفة المظلمة. استقرت فيها بتلة مطوية حول تيار سماوي رفيع. أمالت الصينية، فبقي التيار في مكانه ودارت البتلة تحته. فوق طاولة العمل، تدلت ثلاث أزهار من أسفل شكل بيضاوي أزرق. تحركت السيقان حين مرت بجوارها، مع أن الغرفة لم تضم نافذة مفتوحة. انفصلت حبة لقاح عن أقرب زهرة وانضمت إلى مدار بنفسجي مقطوع. تبعتها البستانية بزاوية إطار زجاجي، وأبقت أصابعها خارج الحلقة. التقط الزجاج انعكاسًا أزرق فأضاء بقعة من الجدار الفارغ للحظة. سحبت كرسيها لتجلس قرب حافة الطاولة، ثم أبعدت كمها عن الصينية برفق، من دون أن تلمس التيار المعلق داخل البتلة.",
      "تداخلت ثلاثة إطارات مربعة حول زهرة مجففة على الطاولة. تحتها، انتظرت قطرة فوق حلقات ماء تعكس بتلات قادمة من مكان وراء السقف. وضعت البستانية حجرًا داكنًا بجوار الصينية. عبره شق سماوي، وتفتحت زهرة صغيرة في أضيق موضع منه. أدارت الحجر لتفسح مكانًا لشريط تنتهي أطرافه بأزهار. لامست ثنيته الوردية الزجاج. عند الطرف البعيد، انحنت ورقة عشب فوق قطرة ندى. مر قرص أسود ببطء داخل حافتها الملونة. وضعت البستانية غصنًا عاريًا فاتحًا على الطاولة. امتد ظله إلى ما وراء الصينية، وتفتحت الأزهار على أغصان الظل، بينما ظل الخشب شاحبًا. استقرت بتلة منفصلة قرب معصمها. قربت منها الإطار الفارغ، وتركت زاويته تستند إلى الحجر. وفي الأعلى، ظلت السيقان الثلاث تتأرجح برفق فوق المساحة السوداء. أخرجت من الدرج تحت الطاولة ملقطًا رفيعًا ووضعته بجوار البتلات المنفصلة. استدارت أصغر بتلة على حافتها وكشفت مربعًا مرجانيًا في أسفلها. رفعت الإطار الفارغ فوق الصينية وانتظرت حتى مر التيار السماوي عبر فتحته. انزلقت زهرة منعكسة على الزجاج. خلف كرسيها، انحنى ظل الغصن حول الساق وفتح زهرة أخرى قرب الأرض. بقي الملقط على الطاولة، وانعكس بين طرفيه المغلقين خط أزرق رفيع. وبجواره دارت الطبقة السفلى من الإطارات قليلًا، من دون أن تفارق زاويتها سطح الحجر."
    ]
  },
  'neon-tide': {
    ja: [
      "舟が係留を解く前に、潮は一番低い黒い島へ届いている。桃色の水が段状の岸をのぼり、尖った岩板の下にたまる。沖の島々は、紫の空の同じ一角へ傾いている。一片の四角い光が舳先を流れ過ぎる。岩の割れ目から伸びた茎に引っかかり、その先では小さな黄色い花が開き始めている。",
      "舟の下でマンタがゆっくりと向きを変える。青い模様が背を横切り、ひれの影へ消えていく。尾が流れの中に珊瑚色の線を描く。舟はその線をたどり、四方を黒い縁に囲まれた狭い入り江へ入る。一本の木が水辺に立っている。根の向こうでは細い流れが縁を越え、その下の景色が見えるより先に、一粒ずつの滴へほどけていく。",
      "戻ってきた波が舟を横から持ち上げる。巻いた波の内側で、黄色い四角が桃色や青へ変わり、その上に暗い表面が折り重なる。舟は隙間をすり抜け、枝分かれする川へ入る。曲がるたび、滑らかな岸が小さな四角い島々に変わっていく。その上で月から殻の一片が落ちる。音もなく着水し、また一つ、光る岸辺を残す。",
      "洞窟の入口には玄武岩の階段が浮かんでいる。舟は一番下の段の陰で止まり、割れた幹に寄り添う。その裂け目には、色のついた年輪がまだ光っている。琥珀色の光が木の中心から外へ動く。割れ目を伝って樹皮へ届くと、黄緑色の四角がいくつか離れていく。濡れた綱にとまり、滴が通る間に消える。乾いた床から明るい四角い水滴が昇る。はるか頭上の湖には岩の影が映っている。最初の滴が水面へ届く。天井に波紋が広がり、映った舟が二つの黒い峰の間で揺れる。"
    ],
    "en": [
      "The tide reaches the lowest black island before the boat leaves its mooring. Pink water climbs the stepped shore and gathers beneath a pointed slab. Farther out, the islands lean towards the same patch of violet sky. A loose square of light drifts past the bow. It catches on a stem growing from a crack in the rock, where small yellow flowers have begun to open.",
      "Below the boat, a manta turns slowly. Blue marks cross its back and disappear under the shadow of a wing. Its tail draws a coral line through the current. The boat follows that line into a narrow bay contained by four raised black edges. A tree stands above the water. Beyond its roots, a thin stream falls over the edge and breaks into separate drops before anything can be seen beneath it.",
      "The returning wave lifts the boat sideways. Inside its curl, yellow squares pass through pink and blue, while the dark outer skin folds over them. The boat slips through an opening and enters a branching river. At each bend, smooth banks give way to small square islands. Above them, a piece falls from the moon. It lands without a sound, leaving another illuminated shore behind.",
      "Basalt steps hang over the mouth of a cavern. The boat settles beneath the lowest one, beside a split trunk with colored rings still glowing in its cracks. Amber light moves out from the center of the wood. A crack carries it to the bark, where a few lime squares break loose. They settle on the wet rope and fade as the drops pass. Water rises from the dry floor in bright square drops. High overhead, a lake holds the reflections of the rocks. The first drop reaches its surface. A ripple crosses the ceiling, and the reflected boat shifts between two dark peaks."
    ],
    "ru": [
      "Прилив добирается до нижнего чёрного острова, пока лодка ещё стоит у причала. Розовая вода поднимается по ступенчатому берегу и собирается под заострённой плитой. Дальше острова наклонены к одному участку фиолетового неба. Мимо носа лодки проплывает светящийся квадрат. Он цепляется за стебель, выросший из трещины в скале. На стебле раскрываются маленькие жёлтые цветы, и на воду сыплются отдельные искры. Лодка отходит от камня вместе с течением.",
      "Под лодкой медленно поворачивает манта. Синие отметины пересекают её спину и исчезают в тени плавника. Хвост прочерчивает коралловую линию в воде. Лодка следует вдоль неё в узкую бухту с четырьмя приподнятыми чёрными краями. Над водой стоит дерево. За его корнями тонкий ручей переливается через край и распадается на капли. Под ними пока ничего не видно. Ближайший каменный выступ заслоняет закат, и на борту остаётся только розовый отсвет.",
      "Обратная волна приподнимает лодку боком. Внутри завитка жёлтые квадраты переходят в розовые и синие, а снаружи над ними складывается тёмная поверхность. Лодка проскальзывает в просвет и попадает в разветвлённую реку. За каждым поворотом плавные берега уступают место маленьким квадратным островам. Над ними от луны отделяется кусок оболочки. Он падает без звука. Вокруг нового острова медленно разгорается светлая кромка, и течение огибает её с двух сторон.",
      "Над входом в пещеру висят базальтовые ступени. Лодка останавливается под нижней, возле расколотого ствола, в трещинах которого ещё светятся цветные кольца. Янтарный свет движется от середины древесины к коре. Несколько лаймовых квадратов отделяются от края трещины и оседают на мокрой верёвке. Пока мимо поднимаются капли, квадраты медленно гаснут. От сухого пола поднимаются яркие квадратные капли. Высоко наверху озеро удерживает отражения скал. Первая капля касается поверхности. По потолку расходится рябь, и отражённая лодка сдвигается между двумя тёмными вершинами. На короткое время её нос растягивается вдоль водяной складки, затем снова становится узким."
    ],
    "zh-cn": [
      "潮水抵达最低的黑色岛屿时，小船还系在岸边。粉色海水沿阶梯状海岸上升，在一块尖石下面汇集。远处的岛屿朝同一片紫色天空倾斜。一粒方形光点从船头漂过，挂在岩缝里长出的细茎上。茎端的黄色小花开始开放，几粒亮点落回水中。船身随着水流离开岸边，尖石的影子从船底滑过。",
      "一只蝠鲼在船下缓缓转身。蓝色光斑横过它的背部，又消失在翼下的阴影里。长尾在水流中拖出珊瑚色细线。小船沿着细线驶入一处狭窄海湾，四边是抬起的黑色边缘。一棵树立在水面上方。根须后面，一缕细流越过边缘，散成水滴。下面仍是一片黑暗。近处的石头挡住落日，船舷上只剩一道粉色反光。",
      "回潮从侧面托起小船。卷起的浪腹里，黄色方块经过粉色和蓝色区域，外侧的深色表面向内折叠。船从空隙滑过，进入分岔的河流。每过一个弯道，平滑河岸就多出几座方形小岛。头顶的月壳落下一块，没有声音。新岛周围慢慢亮起一圈光，水流分到两边，又在后方重新相接。",
      "玄武岩台阶悬在洞口上方。船停在最低一级下面，旁边是裂开的树干，裂缝里还亮着彩色年轮。琥珀色光从木头中心向外移动，沿一道裂缝抵达树皮。几粒青柠色方块从裂口脱落，停在湿绳上。水滴从旁边升过，方块的亮光慢慢减弱，绳上留下几小片暗影。方形水滴从干燥地面向上升起。高处的湖面收着岩石的倒影。第一滴水碰到湖面，波纹沿着洞顶展开。倒映的小船在两座黑色尖峰之间移动，船头随着水纹拉长，随后又恢复原来的窄形。"
    ],
    "pt-br": [
      "A maré alcança a ilha negra mais baixa antes de o barco deixar a amarra. A água rosa sobe pela margem em degraus e se acumula sob uma laje pontuda. Mais longe, as ilhas se inclinam para o mesmo trecho do céu violeta. Um quadrado de luz passa pela proa. Ele prende num caule que cresce de uma rachadura na pedra, onde pequenas flores amarelas começam a abrir.",
      "Uma manta vira devagar sob o barco. Marcas azuis atravessam suas costas e desaparecem na sombra de uma asa. A cauda desenha uma linha coral na corrente. O barco segue essa linha até uma baía estreita, contida por quatro bordas negras levantadas. Uma árvore fica acima da água. Atrás das raízes, um fio de água transborda e se divide em gotas antes que seja possível enxergar qualquer coisa abaixo.",
      "A onda que retorna levanta o barco de lado. Dentro da curva, quadrados amarelos atravessam o rosa e o azul, enquanto a superfície externa escura se dobra sobre eles. O barco passa por uma abertura e entra num rio ramificado. A cada curva, as margens lisas dão lugar a pequenas ilhas quadradas. Acima delas, um pedaço se desprende da lua. Ele cai sem ruído e deixa outra margem iluminada na água.",
      "Degraus de basalto pairam sobre a entrada de uma caverna. O barco para sob o mais baixo, junto de um tronco partido com anéis coloridos ainda acesos nas rachaduras. A luz de âmbar avança do centro da madeira até a casca. Alguns quadrados verde-lima se soltam da rachadura e pousam na corda molhada. Eles vão apagando enquanto as gotas passam. Gotas quadradas sobem do chão seco. No alto, um lago guarda os reflexos das pedras. A primeira gota alcança a superfície. Uma ondulação atravessa o teto, e o barco refletido se desloca entre dois picos escuros."
    ]
  ,
    ar: [
      "يبلغ المدّ أدنى جزيرة سوداء قبل أن يفك القارب رباطه. يصعد الماء الوردي على الشاطئ المتدرّج ويتجمع تحت لوح صخري مدبّب. في البعيد، تميل الجزر نحو البقعة نفسها من السماء البنفسجية. ينجرف مربع ضوء منفلت قرب مقدمة القارب، ثم يعلق بساق نابتة من شق في الصخر، حيث بدأت أزهار صفراء صغيرة تتفتح.",
      "تحت القارب، تستدير سمكة مانتا ببطء. تعبر علامات زرقاء ظهرها وتختفي تحت ظل زعنفة. يرسم ذيلها خطًا مرجانيًا في التيار. يتبع القارب ذلك الخط إلى خليج ضيق تحيط به أربع حواف سوداء مرتفعة. تقف شجرة فوق الماء. وراء جذورها، ينسكب جدول رفيع من الحافة ويتفكك إلى قطرات منفصلة قبل أن يتضح ما يقع تحته.",
      "ترفع الموجة العائدة القارب من جانبه. داخل التفافتها، تمر مربعات صفراء عبر الوردي والأزرق، بينما تنثني فوقها قشرة داكنة. ينزلق القارب من فتحة ويدخل نهرًا متفرّعًا. عند كل منعطف، تحل جزر مربعة صغيرة محل الضفاف الملساء. فوقها، تسقط قطعة من القمر. تهبط دون صوت وتترك وراءها شاطئًا مضيئًا آخر.",
      "تتدلى درجات بازلتية فوق فم كهف. يستقر القارب تحت أدناها، بجوار جذع مشقوق لا تزال حلقاته الملونة تتوهج بين الشقوق. ينتشر ضوء كهرماني من مركز الخشب. يحمله شق حتى اللحاء، حيث تنفصل مربعات ليمونية قليلة. تستقر على الحبل المبلل وتخبو مع مرور القطرات. يرتفع الماء من الأرض الجافة في قطرات مربعة مضيئة. في الأعلى، تحمل بحيرة انعكاسات الصخور. تبلغ أول قطرة سطحها. تعبر تموّجة السقف، ويتحرك القارب المنعكس بين قمتين داكنتين."
    ],
  },
  'contours-of-silence': {
    ja: [
      "歩く人が尾根に着くころ、砂はもう冷えている。縁に沿って紫の線が走り、顔を少し動かすだけで見えなくなるほど細い。眼下では砂丘が幾重にも重なり、斜面と空の境目が分からなくなっている。袖から砂粒を払い、坂を下り始める。窪地には片側が滑らかにすり減った石のアーチがある。開口部を満たす青い光が、足元の地面へこぼれている。倒れた石のそばで足を止めると、割れ目に小さな葉が一枚挟まっている。",
      "アーチの向こうには、さまざまな角度でガラス板が浮かんでいる。通り過ぎると一番近い板が震え、細い反射が他の板の上を横切る。青いリボンが板の間を縫い、折り返して闇へ消える。その先では浅い鉢から紫の煙が立ちのぼる。風が吹くたびにガラスへ伸び、途切れた端だけが空中に残る。歩く人が鉢の冷たい縁に触れる。指に水滴がいくつか付く。",
      "岩棚の下のどこかで水が動いている。音をたどると、低い波が泡も立てずに崩れ、岸に青い縫い目を残している。水たまりの上では、多面体の石がゆっくり回っている。次の波紋が届くまで、水に映る姿は静止したままだ。道は、奥から光が漏れる岩の裂け目を横切る。それをまたぐと、古い木の下に湿った土が現れる。",
      "枝の間から、長い紫の帯になって光が落ちる。根の間では葉が光に向かって開き、その先は水たまりから来た水で濡れている。歩く人は幹にもたれて座り、靴に入った砂を出す。梢の隙間から、砂丘の上に青い三日月が見える。また一つ波が岸へすべり、緩んだガラスの端が石のアーチに一度だけ触れて音を立てる。"
    ],
    en: [
      'The sand has cooled by the time the walker reaches the ridge. A violet line runs along its edge, thin enough to disappear when he turns his head. Below, the dunes overlap until their slopes can no longer be separated from the sky. He shakes a grain of sand from his sleeve and starts down. There is a stone arch in the hollow, worn smooth on one side. Blue light fills the opening and spills onto the ground at his feet. He pauses beside a fallen block, where a small leaf has caught in a crack.',
      'Beyond the arch, sheets of glass hang at different angles. The nearest one trembles as he passes, carrying a narrow reflection across the others. A ribbon of blue winds between them and folds back into the dark. Farther away, violet smoke rises from a shallow basin. Each gust stretches it towards the glass, then leaves a ragged edge suspended in the air. The walker touches the cold rim of the basin. A few drops cling to his fingers.',
      'Water moves somewhere below the ledge. He follows the sound to a low wave that breaks without foam, leaving a blue seam along the shore. Above a pool, a faceted stone turns slowly. Its reflection stays still until the next ripple reaches it. The path crosses a fissure in the rock, lit from deep inside. He steps over it and finds damp earth beneath an old tree.',
      'Light falls through the branches in long violet bands. Between the roots, leaves open towards the glow, their tips wet with water from the pool. The walker sits against the trunk and empties the sand from his shoes. Through a gap in the canopy, a blue crescent rests above the dunes. Another wave slides onto the shore, and a loose glass edge taps once against the stone arch.',
    ],
    ru: [
      'Песок успел остыть, когда путник добрался до гребня. По краю дюны тянулась фиолетовая полоска, такая тонкая, что исчезала при повороте головы. Внизу склоны перекрывали друг друга и постепенно сливались с небом. Он стряхнул песчинку с рукава и начал спускаться. В ложбине стояла каменная арка с истёртым боком. Синий свет заполнял проём и ложился на землю у самых ног. Возле упавшего блока путник остановился: в трещине застрял маленький лист, а под ним темнела узкая полоска влажного камня.',
      'За аркой на разной высоте висели стеклянные плоскости. Ближайшая дрогнула, когда он прошёл мимо, и узкий блик скользнул по соседним граням. Между ними извивалась синяя лента, уходившая обратно в темноту. Дальше из неглубокой чаши поднимался фиолетовый дым. Порыв воздуха вытягивал его к стеклу, затем оставлял в воздухе неровный край. Путник коснулся холодного ободка. На пальцах осталось несколько капель, и он вытер их о шов рукава. Внутри чаши дрожал блик от светящейся ленты.',
      'Под уступом двигалась вода. Он пошёл на звук и вышел к невысокой волне, которая разбивалась без пены, оставляя синий шов вдоль берега. Над заводью медленно поворачивался гранёный камень. Его отражение не шевелилось, пока до него не дошла рябь. Тропа пересекала разлом в скале, освещённый из глубины. Путник переступил трещину, поставил ногу на мокрую землю и придержался за корень старого дерева. С ветки упала капля и попала ему на запястье.',
      'Свет проходил сквозь ветви длинными фиолетовыми полосами. Между корнями раскрывались листья, на их кончиках собиралась вода. Путник сел у ствола и вытряхнул песок из обуви. Сквозь просвет в кроне над дюнами виднелся синий серп. К берегу подошла следующая волна. Возле арки свободный край стеклянной плоскости один раз стукнул о камень, и маленький лист в трещине перевернулся влажной стороной вверх.',
    ],
    'zh-cn': [
      '旅人走到沙丘顶上时，沙子已经凉了。丘脊边缘有一线紫光，细得只要稍微转头，就会从视野里消失。下面的坡面层层相叠，远处渐渐分不清沙地与夜空。他拍掉袖口的一粒沙，沿着背风的一侧往下走。低处立着一座石拱门，一边的石面磨得很平。深蓝色的光填满门洞，落在他的鞋尖旁。他在一块倒下的石头前停住。石缝里夹着一片小叶子，叶子下面留着一道湿痕，几粒沙正慢慢滑进裂缝。',
      '穿过拱门，几块玻璃平面悬在不同的高度。他经过时，最近的一块轻轻晃动，一道窄窄的反光从它的边缘移向旁边的玻璃。蓝色光带在这些平面之间弯曲，转过一角后又没入黑暗。更远处有一只浅石盆，紫色烟雾从盆中升起。风将烟拖向玻璃，风停后，烟的边缘仍悬在半空。他用手碰了碰盆沿，指尖沾上几滴水。擦过袖口时，布料上留下了颜色较深的小点。',
      '石台下面传来流水声。他沿着声音走到岸边，一道低浪没有带起泡沫，只在暗色的岸线上留下一条蓝光。水湾上方，一块多面晶石缓慢转动。水里的倒影一直不动，直到一圈涟漪碰到它，才散成几片。小路横过一道岩石裂隙，蓝光从很深的地方照上来。他跨过裂缝，脚下变成湿土。老树的一条根露在外面，他扶着树根站稳，一滴水从头顶的枝条落到手腕上。',
      '紫色光束穿过树枝，一直落到地面。根部的叶子向着光展开，叶尖积着水珠。他靠着树干坐下，把鞋里的沙倒出来。树冠的空隙之间，沙丘上方挂着一弯蓝色的弧光。又一阵水声从岸边传来，玻璃的一角轻碰石拱门。石缝里的小叶子翻过来，湿润的那面朝着上方，边缘还粘着刚才落下的细沙。',
    ],
    'pt-br': [
      'A areia já esfriou quando o caminhante chega à crista da duna. Uma linha violeta acompanha a borda, tão fina que desaparece quando ele vira a cabeça. Lá embaixo, as encostas se sobrepõem até se confundirem com o céu. Ele tira um grão de areia da manga e começa a descer. Na depressão há um arco de pedra, gasto de um lado. A luz azul ocupa a passagem e se espalha pelo chão junto aos seus pés. Ele para ao lado de um bloco caído, onde uma folha pequena ficou presa numa rachadura úmida.',
      'Depois do arco, placas de vidro ficam suspensas em ângulos diferentes. A mais próxima treme quando ele passa, levando um reflexo estreito até as outras. Uma fita azul se curva entre as placas e volta para o escuro. Mais adiante, fumaça violeta sobe de uma bacia rasa. Cada rajada a estica na direção do vidro e deixa uma borda irregular no ar. O caminhante toca o aro frio da bacia. Algumas gotas ficam nos dedos e escurecem a manga quando ele as enxuga.',
      'Há água correndo abaixo da saliência. Ele segue o som até uma onda baixa, que se desfaz sem espuma e deixa uma linha azul junto à margem. Sobre uma poça, uma pedra facetada gira devagar. O reflexo permanece parado até a próxima ondulação alcançá-lo. O caminho cruza uma fenda na rocha, iluminada por dentro. Ele passa por cima dela e encontra terra molhada sob uma árvore antiga.',
      'A luz atravessa os galhos em faixas violetas. Entre as raízes, as folhas se abrem na direção do brilho, com gotas nas pontas. O caminhante se senta junto ao tronco e esvazia a areia dos sapatos. Por uma abertura na copa, um crescente azul aparece acima das dunas. Outra onda chega à margem, e uma ponta solta de vidro bate uma vez no arco de pedra.',
    ],

    ar: [
      "يكون الرمل قد برد حين يبلغ السائر حافة الكثيب. يمتد على طرفها خط بنفسجي دقيق، يختفي حين يدير رأسه. في الأسفل، تتراكب الكثبان حتى لا يعود من الممكن تمييز منحدراتها عن السماء. ينفض حبة رمل عن كمّه ويبدأ النزول. في المنخفض قوس حجري، صقله الزمن من جانب واحد. يملأ الضوء الأزرق فتحته وينسكب على الأرض عند قدميه. يتوقف بجوار كتلة حجرية ساقطة، علقت ورقة صغيرة في أحد شقوقها.",
      "وراء القوس، تتدلى ألواح زجاج بزوايا مختلفة. يرتعش أقربها حين يمر بجواره، حاملًا انعكاسًا رفيعًا عبر الألواح الأخرى. يلتف بينها شريط أزرق ثم ينثني عائدًا إلى العتمة. أبعد قليلًا، يرتفع دخان بنفسجي من حوض ضحل. تمدّه كل هبّة نحو الزجاج، ثم تترك طرفًا ممزقًا معلّقًا في الهواء. يلمس السائر حافة الحوض الباردة، فتعلق قطرات قليلة بأصابعه.",
      "يتحرك الماء في مكان ما أسفل الحافة. يتبع صوته حتى موجة منخفضة تنكسر دون زبد، تاركة خطًا أزرق على الشاطئ. فوق بركة، يدور حجر متعدد الأوجه ببطء. يبقى انعكاسه ساكنًا إلى أن تبلغه التموجة التالية. يعبر الطريق شقًا في الصخر يضيء من أعماقه. يتخطاه السائر ويجد أرضًا رطبة تحت شجرة عتيقة.",
      "يتساقط الضوء بين الأغصان في أشرطة بنفسجية طويلة. وبين الجذور، تتفتح أوراق نحو الوهج، وأطرافها مبللة بماء البركة. يجلس السائر مستندًا إلى الجذع ويفرغ الرمل من حذائه. ومن فتحة بين الأغصان، يستقر هلال أزرق فوق الكثبان. تنزلق موجة أخرى على الشاطئ، وتطرق حافة زجاج منفلتة القوس الحجري مرة واحدة."
    ],
  },
  'woven-spectrum': {
    ja: [
      "赤い床の上に、ほどけた橙色の糸が垂れている。表面に触れる前に曲がる。まだ他の糸へ届いていない流れが、横へ引いている。少し遅れて青が続く。二本が近づくところで縁が細くなり、間に桃色の線が現れる。橙色の糸が向きを変えても、その線は動き続ける。はるか下の床は、隅へ向かうほど暗い。壁はどこにも見えない。ただ、さらに長い色の糸が一本ずつ闇から現れ、流れに加わっていく。",
      "最初の大きな波が空間を横切る。外縁が薄く伸び、その下の赤が透けて見える。縁の後ろでひだが寄り集まり、隣の帯へ小さな影を落とす。青い糸が隙間を抜け、下へ曲がり、反対側に戻ってくる。暖色の束を引き寄せ、開いた輪を作る。ひととき、中心には何もない。動く縁だけが、触れ合うことなくすれ違う。",
      "片方の端が輪に引っかかり、内側へ巻き始める。ひと巻きごとに小さくなる。橙が赤紫を横切り、その下へ隠れ、折り目に反射の細い帯を残す。渦巻きが傾く。細くなった先から色が扇状に広がり、骨組みがそれぞれ異なる速さで開く。青い一本が他より長く伸び、皆が集まる点へ向かって巻き戻る。",
      "扇は外側から内側へ折りたたまれる。最後の糸が中心を通り、深紅の床の上に輪を結ぶ。リボンがねじれる場所で速度を落としながら、光が輪を巡る。その下で影が長く伸び、やがて二つの淡い弧へ分かれる。闇からまた一本、橙色の糸が現れ、その脇の空いた場所へ進んでいく。"
    ],
    en: [
      'A loose orange thread hangs above the red floor. It bends before touching the surface, pulled sideways by a current that has not yet reached the other strands. Blue follows a little later. Where the two pass close together, their edges narrow and a pink line appears between them. The line keeps moving after the orange strand has turned. Far below, the floor darkens towards the corners. There are no walls in sight, only further lengths of colour coming out of the black, one at a time, and joining the current.',
      'The first broad wave rolls across the space. Its outer edge stretches thin enough to show the red beneath it. Behind that edge, folds bunch together and cast small shadows onto the next band. A blue strand slips through a gap, curves down and returns on the other side. It pulls the warm colours into an open loop. For a moment the centre stays empty, while the moving edges slide past each other without touching.',
      'One end catches in the loop and begins to wind inward. The turns become smaller. Orange crosses magenta, then disappears underneath it, leaving a strip of reflected light along the crease. The spiral tilts. From its narrow end, colour spreads into a fan whose ribs open at different speeds. A single blue rib extends beyond the others and curls back towards the point where they meet.',
      'The fan folds shut from the outside in. Its last strand passes through the centre and completes a ring above the crimson floor. Light travels around the ring, slowing where the ribbon twists. Underneath, the shadow grows longer, then separates into two faint arcs. Another orange thread enters from the dark and moves towards the open space beside them.',
    ],
    ru: [
      'Над красной поверхностью свисает свободная оранжевая нить. Не коснувшись пола, она изгибается в сторону: воздушное течение добралось до неё раньше, чем до остальных полос. Следом движется синяя. Там, где края сближаются, между ними появляется узкая розовая линия. Оранжевая нить уже повернула, а линия продолжает скользить прямо. Внизу красный цвет темнеет к углам. Стен не видно. Из чёрного пространства по одной выходят новые цветные полосы, подхватывают движение и выгибаются над поверхностью. Их отражения остаются внизу чуть дольше, чем сами полосы, и медленно растягиваются.',
      'Первая широкая волна проходит через всё пространство. Её внешний край истончается, и сквозь него проступает красный фон. За краем собираются складки, отбрасывающие небольшие тени на соседнюю ленту. Синяя полоса проскальзывает в зазор, загибается вниз и появляется с другой стороны. Она увлекает за собой тёплые цвета, складывая их в открытую петлю. В центре остаётся пустое место. Движущиеся края проходят рядом, почти касаясь друг друга; один из них дрожит, и на его поверхности появляется короткая белая полоска.',
      'Свободный конец цепляется за петлю и начинает закручиваться внутрь. Каждый следующий виток становится меньше. Оранжевый пересекает малиновый и уходит под него, оставляя отражённый свет вдоль сгиба. Спираль наклоняется. Из её узкого конца разворачивается веер, рёбра которого раскрываются с разной скоростью. Одно синее ребро вытягивается дальше остальных и загибается обратно к точке их соединения. Между соседними рёбрами на мгновение виден глубокий красный цвет.',
      'Веер складывается от краёв к середине. Последняя полоса проходит сквозь центр и замыкает кольцо над багровой поверхностью. Свет движется по кольцу, задерживаясь в месте, где лента перекручена. Тень под ним становится длиннее, затем распадается на две слабые дуги. Из темноты выходит новая оранжевая нить. Она опускается к свободному месту рядом с дугами, и ближайший край кольца слегка прогибается навстречу.',
    ],
    'zh-cn': [
      '一根松开的橙色丝线垂在深红色平面上方。还没碰到下面，它就被一道气流拉向旁边；其余的彩带暂时停在原处。蓝色丝线稍后跟上。两条线靠近的地方，边缘变窄，中间出现一线粉色。橙线转弯以后，粉色仍向前滑动。下面的红色越接近角落越暗。看不到墙，只有新的色带从黑色空间里一条条伸出来，接入这股流动。它们的倒影在下面停留了一会儿，随后被拉长，缓缓移向更暗的地方。',
      '第一道宽阔的波浪横过空间。外缘变薄，透出下面的红色。紧靠外缘的地方挤出几道褶皱，把细小的影子投在下一条彩带上。蓝色从一道空隙里穿过，向下弯曲，又从另一侧返回。它带着暖色的丝带绕出一个没有合拢的圈。圆圈中间暂时空着，移动的边缘从彼此身旁滑过，没有碰到。靠近下方的一条边轻轻抖动，表面露出一小段白色反光，反光很快沿着折痕移走。',
      '一段末梢挂住圆圈，开始朝里面卷。后面的每一圈都比前一圈小。橙色跨过紫红色，又钻到它下面，弯折处留下一条亮边。螺旋慢慢倾斜，窄端伸出几条彩带，向外展开成扇形。各条扇骨张开的速度不同，一根蓝色的伸得更远，再弯回它们相接的地方。扇骨之间可以看见深红色的底面。最外侧的丝带翻了一面，原先藏在背后的粉色跟着露出来，覆盖了邻近的一段橙色。',
      '扇面从外缘向中间收拢。最后一条色带穿过中心，在深红色平面上方接成一个环。光沿着环移动，在丝带扭转的地方放慢。下方的影子越拉越长，随后分成两道淡淡的弧线。另一根橙色丝线从黑暗中伸出来，降到弧线旁边的空处。环上离它最近的一段向下弯了一点，影子也跟着偏移。新来的线仍在缓慢移动，还没有碰到环的边缘。',
    ],
    'pt-br': [
      'Um fio laranja solto paira acima do chão vermelho. Antes de tocar a superfície, ele se curva para o lado, puxado por uma corrente que ainda não chegou aos outros fios. O azul vem um pouco depois. Onde os dois passam perto, as bordas se estreitam e uma linha rosa aparece entre elas. A linha continua andando depois que o laranja faz a curva. Bem abaixo, o chão escurece na direção dos cantos. Não há paredes à vista, apenas outras faixas de cor saindo do preto, uma de cada vez, e entrando na corrente.',
      'A primeira onda larga atravessa o espaço. A borda externa se estica até deixar o vermelho de baixo aparecer. Atrás dela, dobras se juntam e projetam pequenas sombras sobre a faixa seguinte. Um fio azul passa por uma abertura, desce e retorna do outro lado. Ele puxa as cores quentes para uma volta aberta. Por um instante o centro fica vazio, enquanto as bordas deslizam umas pelas outras sem se tocar. Uma delas treme e deixa surgir um reflexo branco junto à dobra.',
      'Uma ponta prende na volta e começa a se enrolar para dentro. Cada giro fica menor. O laranja cruza o magenta e desaparece por baixo, deixando uma linha de luz na dobra. A espiral se inclina. De sua ponta estreita, a cor se abre num leque cujas hastes avançam em velocidades diferentes. Uma haste azul passa das outras e se curva de volta para o ponto em que todas se encontram.',
      'O leque se fecha das bordas para o meio. A última faixa atravessa o centro e completa um anel acima do chão carmesim. A luz percorre o anel, mais devagar onde a fita se torce. Embaixo, a sombra se alonga e se divide em dois arcos suaves. Outro fio laranja sai do escuro e avança para o espaço aberto ao lado deles. A borda mais próxima do anel cede um pouco na sua direção.',
    ],

    ar: [
      "يتدلى خيط برتقالي منفلت فوق أرضية حمراء. ينحني قبل أن يلامس السطح، إذ يجذبه جانبًا تيار لم يصل بعد إلى الخيوط الأخرى. يلحق به الأزرق بعد قليل. وحيث يتقاربان، تضيق حافتاهما ويظهر بينهما خط وردي. يواصل الخط حركته بعد أن ينعطف الخيط البرتقالي. في الأسفل بعيدًا، تزداد الأرضية عتمة عند الزوايا. لا تظهر جدران، بل أطوال أخرى من اللون تخرج من السواد، واحدة تلو الأخرى، وتنضم إلى التيار.",
      "تعبر الموجة العريضة الأولى المكان. تتمدد حافتها الخارجية حتى تصبح رقيقة تكشف الحمرة تحتها. وراء تلك الحافة، تتجمع الثنيات وتلقي ظلالًا صغيرة على الشريط التالي. يتسلل خيط أزرق من فجوة وينحني إلى الأسفل ثم يعود من الجانب الآخر. يسحب الألوان الدافئة لتشكّل حلقة مفتوحة. للحظة، يظل المركز خاليًا، فيما تنزلق الحواف المتحركة متجاورة دون أن تتلامس.",
      "يعلق أحد الأطراف بالحلقة ويبدأ الالتفاف إلى الداخل. تضيق اللفات. يعبر البرتقالي فوق الأرجواني، ثم يختفي تحته، تاركًا شريطًا من الضوء المنعكس على الطية. يميل الحلزون. ومن طرفه الضيق، تنتشر الألوان كالمروحة، وتنبسط أضلاعها بسرعات مختلفة. يمتد ضلع أزرق واحد أبعد من البقية، ثم يلتف عائدًا نحو نقطة التقائها.",
      "تنغلق المروحة من الخارج إلى الداخل. يمر خيطها الأخير عبر المركز ويكمل حلقة فوق الأرضية القرمزية. يسري الضوء حول الحلقة، ويتباطأ حيث يلتوي الشريط. تحتها، يطول الظل، ثم ينفصل إلى قوسين باهتين. يدخل خيط برتقالي آخر من العتمة ويتجه نحو الفراغ المجاور لهما."
    ],
  },
  'path-to-the-light': {
    ja: [
      "窓に明かりが灯り始めるころ、旅人は街を出る。橋からは水辺へ下る屋根の連なりと、遠い塔の上に浮かぶ金色の輪が見える。輪の下端は塔の向こうへ隠れている。石の欄干に片手を添える。昼間のぬくもりがまだ残っている。橋の中央では、浅い水たまりに輪の全体が映る。靴がその反射を崩す。波紋が収まるころには、最後の窓を過ぎ、川の上を走る道へ出ている。",
      "道は紫の山々の間をのぼる。かかとの下で小石が転がり、見えない場所へ落ちる。曲がり角で立ち止まり、肩の紐を緩める。眼下には湖がある。両側の斜面と、その間の光の輪をそのまま映すほど平らだ。岸辺の葦が自分の影をなぞる。旅人は山が木々に隠れるまで湖岸を歩く。水面の上の細い隙間から、輪はまだ見えている。",
      "森へ小川が流れ込んでいる。浅い淀みに金色が集まり、水とともに石を越える。旅人は川に沿って歩き、道に倒れた枝をくぐる。露出した根の窪みに水がたまっている。ひざをついて飲み、樹皮に濡れた手形を残す。その先で川は崩れた石壁の下へ曲がる。道は階段となってのぼっていく。",
      "下の段には石の間から草が生えている。高くなると草はなくなり、雨に削られた淡い小さな跡が残る。旅人は何もない戸口を過ぎ、最後の段に鞄を置く。タイルの欠片が散らばる床の上、遺跡の中に輪が立っている。背後の戸口から風が入る。鞄の角を少し持ち上げ、乾いた草の葉を明るい石の上へ運んでいく。"
    ],
    en: [
      'The traveller leaves the city as lamps begin to appear in its windows. From the bridge, he can see roofs stepping down to the water and a golden ring hanging above the far towers. Its lower edge vanishes behind them. He keeps one hand on the stone parapet, which still holds warmth from the day. At the middle of the bridge, a shallow puddle catches the ring in full. His boot breaks the reflection. By the time the ripples settle, he has passed the last window and reached the road above the river.',
      'The road climbs between purple mountains. Loose stones roll under his heels and drop out of sight. At a bend he stops to loosen the strap across his shoulder. Below lies a lake, flat enough to hold both slopes and the circle of light between them. Near the bank, a reed brushes its own reflection. The traveller follows the shore until trees hide the mountains. The ring is still visible through a narrow opening above the water.',
      'A stream runs into the forest. Gold gathers in its shallow pools, then slips over each stone with the current. He walks beside it, ducking under a branch that has fallen across the path. Water fills the hollow of an exposed root. He kneels to drink and leaves a wet handprint on the bark. Farther on, the stream turns beneath a wall of broken masonry. The path rises into a staircase.',
      'Grass grows between the lower steps. Higher up, the stones are bare, with small pale marks where rain has worn them. The traveller climbs past an empty doorway and sets his bag on the final step. The ring stands inside the ruins, above a floor scattered with pieces of tile. Wind comes through the doorway behind him. It lifts one corner of the bag and carries a dry blade of grass across the lit stone.',
    ],
    ru: [
      'Путник выходит из города, когда в окнах начинают загораться лампы. С моста видны крыши, спускающиеся к воде, и золотое кольцо над дальними башнями. Его нижний край скрыт за кладкой. Путник ведёт рукой по каменному парапету, который ещё хранит дневное тепло. Посреди моста неглубокая лужа вмещает кольцо целиком. Подошва разрывает отражение. Пока расходятся круги, он проходит последнее освещённое окно и выходит на дорогу над рекой. Позади скрипит ставня; её звук несколько раз возвращается от стены на другом берегу.',
      'Дорога поднимается между фиолетовыми горами. Мелкие камни перекатываются под пятками и падают вниз, пропадая из виду. На повороте путник останавливается, чтобы ослабить ремень на плече. Внизу лежит озеро. В ровной воде отражаются оба склона и светящийся круг между ними. Возле берега тростинка касается собственного отражения. Он идёт вдоль воды, пока деревья не закрывают горы. Кольцо всё ещё видно через узкий просвет над озером. У самого берега лежит плоский камень, наполовину скрытый водой; на его сухом краю осталась тонкая полоска ила.',
      'Ручей уходит в лес. В мелких заводях собирается золотой свет, затем вместе с течением соскальзывает с камней. Путник идёт рядом, пригибаясь под упавшей поперёк тропы веткой. В углублении обнажённого корня стоит вода. Он опускается на колено, чтобы напиться, и оставляет на коре влажный отпечаток ладони. Дальше ручей сворачивает под стену из расколотых камней. Тропа поднимается ступенями, на первых двух ещё держится земля, смытая с лесного склона.',
      'Между нижними ступенями растёт трава. Выше камень голый, со светлыми отметинами от дождя. Путник проходит пустой дверной проём и ставит сумку на последнюю ступень. Кольцо стоит внутри руин, над полом, усыпанным осколками плитки. Ветер проходит через дверь за спиной. Он приподнимает угол сумки и гонит сухую травинку по освещённому камню. Травинка застревает в шве между плитами, а ремень сумки опускается на ступень.',
    ],
    'zh-cn': [
      '旅人离开城市时，窗户里的灯刚开始亮起来。从桥上能看到一层层朝水边降低的屋顶，远处的塔楼上方悬着一个金色光环，下缘被墙体遮住。他把一只手搭在石栏上，石头还留着白天的温度。走到桥中央，一小滩积水映出了完整的环。鞋底踏进去，倒影被打散。等水纹平下来，他已经经过最后一扇亮着的窗，走上河边的道路。背后传来木窗板的响声，在对岸的墙上回荡了几次，才慢慢消失。',
      '道路从紫色的山峰之间向上延伸。碎石在脚后跟下滚动，掉到坡外，看不见了。他在拐弯处停下，松了松肩上的带子。下方有一个湖，平静的湖面映着两边山坡，也映着山间的金色圆圈。岸边一根芦苇碰到自己的影子。他沿着湖走，直到树木遮住山峰。水面上方还剩一条窄缝，可以看见光环。贴着岸边有块扁平的石头，一半浸在水里，露出的边缘留着一线浅色泥痕，水偶尔漫上来，又从石面退回去。',
      '一条溪流进入树林。金色光点聚在浅浅的水洼里，随后跟着水流滑过石头。他沿溪往前，在一根横倒的树枝下弯腰通过。露在地面的树根上有个凹处，里面积着水。他跪下来喝水，扶住树干的手在树皮上留下湿印。再往前，溪流转进一道破损石墙下面。路开始变成台阶，最下面两级还盖着从林中冲下来的泥土。鞋踩上去时，一小块湿泥从台阶边缘落回溪里。',
      '低处的石阶缝里长着草。越往上，石面越裸露，雨水留下了浅色痕迹。他穿过一道没有门的入口，把袋子放在最后一级台阶上。金环立在废墟中，下面的地面散落着破碎的砖片。风从身后的入口吹进来，掀起袋子的一角，又把一根干草推过发亮的石面。草卡在两块地砖之间，袋子的带子垂回台阶。入口外的枝条晃了一下，一片湿叶落在最下面的石阶旁。',
    ],
    'pt-br': [
      'O viajante deixa a cidade quando as primeiras lâmpadas aparecem nas janelas. Da ponte, ele vê telhados descendo até a água e um anel dourado acima das torres distantes. A borda inferior desaparece atrás da alvenaria. Ele mantém uma mão no parapeito de pedra, ainda morno do dia. No meio da ponte, uma poça rasa guarda o anel inteiro. A bota desfaz o reflexo. Quando as ondulações se acomodam, ele já passou pela última janela iluminada e chegou à estrada acima do rio. Atrás dele, uma veneziana bate contra a parede.',
      'A estrada sobe entre montanhas violetas. Pedrinhas rolam sob seus calcanhares e caem fora de vista. Numa curva ele para para afrouxar a alça no ombro. Abaixo há um lago, liso o bastante para refletir as duas encostas e o círculo de luz entre elas. Perto da margem, um junco encosta no próprio reflexo. O viajante segue a água até as árvores esconderem as montanhas. O anel continua visível por uma abertura estreita acima do lago.',
      'Um riacho entra na floresta. A luz dourada se acumula nas poças e escorre pelas pedras com a corrente. Ele anda ao lado da água, abaixando a cabeça sob um galho caído sobre o caminho. Há água numa cavidade de uma raiz exposta. Ele se ajoelha para beber e deixa a marca molhada da mão na casca. Mais adiante, o riacho passa sob um muro quebrado. O caminho se transforma numa escadaria.',
      'Entre os degraus de baixo cresce grama. Mais acima, a pedra está nua, com marcas claras deixadas pela chuva. O viajante passa por um vão sem porta e põe a bolsa no último degrau. O anel está dentro das ruínas, sobre um chão coberto de pedaços de ladrilho. O vento atravessa a entrada atrás dele, levanta um canto da bolsa e leva uma folha seca de grama pela pedra iluminada.',
    ],

    ar: [
      "يغادر المسافر المدينة حين تبدأ المصابيح بالظهور في نوافذها. من الجسر، يرى الأسطح تتدرج نزولًا إلى الماء، وحلقة ذهبية معلّقة فوق الأبراج البعيدة. تختفي حافتها السفلى وراءها. يضع يدًا على الحاجز الحجري الذي لا يزال يحتفظ بدفء النهار. في منتصف الجسر، تعكس بركة ضحلة الحلقة كاملة. يكسر حذاؤه الانعكاس. وحين تهدأ التموجات، يكون قد تجاوز آخر نافذة وبلغ الطريق فوق النهر.",
      "يصعد الطريق بين جبال بنفسجية. تتدحرج أحجار سائبة تحت كعبيه وتغيب عن النظر. عند منعطف، يتوقف ليرخي الحزام على كتفه. في الأسفل بحيرة، ساكنة بما يكفي لتعكس المنحدرين ودائرة الضوء بينهما. قرب الضفة، تلامس قصبة انعكاسها. يتبع المسافر الشاطئ حتى تحجب الأشجار الجبال. لا تزال الحلقة مرئية عبر فتحة ضيقة فوق الماء.",
      "يتجه جدول إلى داخل الغابة. يتجمع الذهب في بركه الضحلة، ثم ينزلق مع التيار فوق كل حجر. يسير إلى جانبه، وينحني تحت غصن سقط على الطريق. يملأ الماء تجويف جذر مكشوف. يجثو ليشرب ويترك بصمة يد مبللة على اللحاء. أبعد من ذلك، ينعطف الجدول تحت جدار من حجارة متهدمة. يرتفع الطريق ليصبح درجًا.",
      "ينمو العشب بين الدرجات السفلى. وفي الأعلى، تبدو الحجارة عارية، عليها آثار صغيرة شاحبة تركها المطر. يصعد المسافر متجاوزًا مدخلًا خاليًا ويضع حقيبته على الدرجة الأخيرة. تقف الحلقة داخل الأطلال، فوق أرضية تتناثر عليها قطع البلاط. تهب الريح من المدخل خلفه. ترفع زاوية من الحقيبة وتحمل نصل عشب جافًا فوق الحجر المضيء."
    ],
  },
  'where-stars-graze': {
    ja: [
      "風車の羽根が回り始める前から、牛は道端の花へ鼻を寄せている。尾根の上には青い彗星が浮かぶ。その光が、角の間の長い毛と草の濡れた先を照らす。谷では霧が屋根を覆い、道の最初の曲がり角まで達している。風車の戸口には誰かが置いたバケツがある。牛が鼻で押すと、取っ手が縁に当たって鳴る。また花へ戻り、首を横に振って茎を一本引き抜く。",
      "二人の旅人が、折りたたんだ毛布を二人で持って谷からのぼってくる。道が狭まるところで止まり、牛が草をかみ終えるのを待つ。牛は二人より先に岩だらけの道へ踏み出す。ひづめのたびに少しずつ土がこぼれ、霧へ落ちていく。道の脇ではヤシの葉が風に擦れ合う。風車は斜面の陰へ消えるが、あと数歩だけ羽根は見えている。",
      "道は山の湖へ出る。水際まで花が生え、浅瀬に花びらが浮かんでいる。牛は頭を下げて水を飲む。鼻先が彗星の反射を波紋に変え、映った星々の間に青が広がる。一人の旅人が乾いた岩に毛布を置く。もう一人は靴から石を振り落とす。湖の向こうでは雲が尾根の前を通り、上の縁だけが明るく残る。",
      "牛が頭を上げると、顎の下の赤茶色の毛に滴がぶら下がる。牛は湖岸を歩き、風車がまた見える場所へ向かう。谷の雲の上で羽根がゆっくり回っている。旅人たちは毛布を拾って後を追う。牛の毛についた花が低い枝に触れて、そこに残る。山道の上には、彗星の淡い尾が伸びている。"
    ],
    en: [
      'Before the windmill blades begin to turn, the cow has already pushed her nose into the flowers beside the path. A blue comet hangs above the ridge. Its light picks out the long hairs between her horns and the wet tips of the grass. Down in the valley, mist covers the roofs and reaches the first bend in the road. Someone has left a bucket by the mill door. The cow nudges it, hears the handle strike the rim and moves back to the flowers, pulling a stem free with a sideways turn of her head.',
      'Two travellers come up from the valley carrying a folded blanket between them. They stop where the road narrows and wait for the cow to finish chewing. She steps ahead of them onto the rocky path. Each hoof dislodges a little soil, which falls into the mist. Beside the path, palm leaves rub together in the wind. The mill disappears behind the slope, though the blades remain visible for a few more steps.',
      'The path reaches a mountain lake. Flowers grow right down to the water, with petals floating in the shallows. The cow lowers her head to drink. Her nose breaks the comet into ripples, blue spreading between the reflected stars. One traveller sets the blanket on a dry rock. The other shakes a stone from a shoe. Across the lake, a cloud passes in front of the ridge, leaving only the upper edge lit.',
      'When the cow raises her head, drops hang from the ginger hair under her chin. She walks along the bank until the windmill comes back into view. Its blades turn slowly above the valley cloud. The travellers pick up the blanket and follow. A flower caught in the cow’s coat brushes against a low branch and stays there, while the comet’s pale tail extends above the mountain path.',
    ],
    ru: [
      'Лопасти мельницы ещё неподвижны, а корова уже уткнулась носом в цветы у тропы. Над хребтом висит синяя комета. Её свет выделяет длинную шерсть между рогами и мокрые кончики травы. Внизу туман закрывает крыши и доходит до первого поворота дороги. Кто-то оставил ведро у мельничной двери. Корова толкает его, слышит удар ручки о край и возвращается к цветам. Повернув голову набок, она вытягивает стебель. На месте сорванного цветка остаётся маленькое тёмное пятно, а соседний бутон качается у самой морды.',
      'Из долины поднимаются двое путников. Между ними висит сложенное одеяло, взятое за углы. Там, где дорога сужается, они останавливаются и ждут, пока корова дожуёт. Она выходит перед ними на каменистую тропу. Под каждым копытом осыпается немного земли, которая падает в туман. У края дороги пальмовые листья трутся друг о друга на ветру. Мельница исчезает за склоном, но лопасти видны ещё несколько шагов. Один путник перехватывает угол одеяла, чтобы ткань не задевала камни. Корова огибает выступ и снова останавливается у травы.',
      'Тропа выходит к горному озеру. Цветы растут до самой воды, несколько лепестков плавают на мелководье. Корова опускает голову, чтобы напиться. Нос разбивает отражение кометы на круги, синий свет расходится между звёздами. Один путник кладёт одеяло на сухой камень. Второй вытряхивает из обуви мелкую гальку. На другом берегу облако проходит перед хребтом, оставляя освещённым только верхний край. Вода касается камня с одеялом и отступает, не доходя до ткани.',
      'Когда корова поднимает голову, на рыжей шерсти под подбородком висят капли. Она идёт вдоль берега, пока снова не становится видна мельница. Лопасти медленно поворачиваются над облаком в долине. Путники подбирают одеяло и идут следом. Цветок, зацепившийся за шерсть, касается низкой ветки и остаётся на ней. Над горной тропой вытягивается бледный хвост кометы, а капли с коровьей морды падают на плоские камни у воды.',
    ],
    'zh-cn': [
      '风车的叶片还没转起来，牛已经把鼻子伸进小路旁的花丛。蓝色彗星挂在山脊上方，光照出牛角之间的长毛和草尖上的水。下面的雾盖住了屋顶，一直延伸到道路的第一个弯。磨坊门边有人放着一只桶。牛用鼻子推了推，听见提手碰到桶沿，又回去吃花旁边的草。它侧过头，扯下一根带花的茎。原来开花的地方剩下一个小小的暗点，旁边还没开的花苞在它的鼻子前晃动，草上的水蹭到一缕姜黄色的长毛上。',
      '两个旅人从山谷上来，一人拿着折好的毯子一角。走到路变窄的地方，他们停下，等牛嚼完嘴里的草。牛先踏上石头小路，每落下一只蹄子，就有少许泥土松开，掉进下方的雾里。路边的棕榈叶在风中互相摩擦。磨坊被坡面挡住了，再走几步，才能看到的叶片也消失了。其中一人重新抓好毯角，免得布料擦到石头。牛绕过一块凸出的岩石，又在一小片草前停下，旅人跟着放慢脚步。',
      '小路来到一个山间湖泊。花一直长到水边，浅水里浮着几片花瓣。牛低头喝水，鼻尖打散了彗星的倒影。蓝光一圈圈向外扩散，从倒映的星星之间经过。一个旅人把毯子放在干燥的石头上，另一个脱下鞋，倒出一颗小石子。湖对岸，一团云从山脊前经过，只留下上边缘还亮着。水慢慢爬到放着毯子的石头旁，又退了回去，没有碰到布料。漂着的花瓣靠近石头，在一条细缝前转了一圈。',
      '牛抬起头时，下巴的姜黄色长毛上挂着水滴。它沿湖岸走，直到风车重新出现在视野里。叶片在山谷的云雾上方缓缓转动。两个旅人收起毯子，跟在后面。一朵挂在牛毛上的花擦过低矮的树枝，留在枝上。淡蓝色的彗尾在山路上方伸展开。牛鼻子上的水落在岸边的扁石上，留下几处湿点；其中一滴滑到石头边缘，掉进刚刚退下去的湖水里。',
    ],
    'pt-br': [
      'As pás do moinho ainda estão paradas, e a vaca já enfiou o focinho nas flores ao lado do caminho. Um cometa azul paira acima da crista. Sua luz alcança os pelos compridos entre os chifres e as pontas molhadas da grama. No vale, a névoa cobre os telhados e chega à primeira curva da estrada. Alguém deixou um balde junto à porta do moinho. A vaca o empurra, ouve a alça bater na borda e volta para as flores, puxando um talo com a cabeça virada de lado.',
      'Dois viajantes sobem do vale carregando uma manta dobrada entre eles. Param onde a estrada fica estreita e esperam a vaca terminar de mastigar. Ela entra na trilha de pedra à frente dos dois. Cada casco solta um pouco de terra, que cai na névoa. Ao lado da trilha, folhas de palmeira se esfregam com o vento. O moinho desaparece atrás da encosta, embora as pás continuem visíveis por mais alguns passos. Um viajante muda a mão de posição para a manta não raspar nas pedras.',
      'O caminho chega a um lago de montanha. As flores crescem até a água, com pétalas boiando na parte rasa. A vaca abaixa a cabeça para beber. Seu focinho desfaz o cometa em ondulações, espalhando azul entre as estrelas refletidas. Um viajante põe a manta numa pedra seca. O outro tira uma pedrinha do sapato. Do outro lado do lago, uma nuvem passa diante da crista e deixa apenas a borda superior iluminada.',
      'Quando a vaca levanta a cabeça, gotas ficam presas no pelo ruivo sob o queixo. Ela segue pela margem até o moinho aparecer outra vez. As pás giram devagar acima da nuvem no vale. Os viajantes recolhem a manta e acompanham a vaca. Uma flor presa no pelo encosta num galho baixo e fica ali, enquanto a cauda clara do cometa se estende acima da trilha.',
    ],

    ar: [
      "قبل أن تبدأ أجنحة الطاحونة بالدوران، تكون البقرة قد دفعت أنفها بين الزهور بجانب الطريق. يتدلى مذنّب أزرق فوق الحافة الجبلية. يضيء الشعر الطويل بين قرنيها وأطراف العشب المبللة. في الوادي، يغطي الضباب الأسطح ويبلغ المنعطف الأول من الطريق. ترك أحدهم دلوًا عند باب الطاحونة. تدفعه البقرة وتسمع مقبضه يطرق الحافة، ثم تعود إلى الزهور وتنتزع ساقًا بإمالة رأسها جانبًا.",
      "يصعد مسافران من الوادي يحملان بينهما بطانية مطوية. يتوقفان حيث يضيق الطريق وينتظران حتى تنتهي البقرة من المضغ. تتقدمهما إلى الدرب الصخري. يزيح كل حافر قليلًا من التراب، فيسقط في الضباب. بجانب الدرب، تحتك أوراق النخيل بعضها ببعض في الريح. تختفي الطاحونة وراء المنحدر، وإن ظلت أجنحتها مرئية لبضع خطوات أخرى.",
      "يبلغ الدرب بحيرة جبلية. تنمو الأزهار حتى حافة الماء، وتطفو بتلاتها في المياه الضحلة. تخفض البقرة رأسها لتشرب. يكسر أنفها صورة المذنّب إلى تموجات، وينتشر الأزرق بين النجوم المنعكسة. يضع أحد المسافرين البطانية على صخرة جافة. وينفض الآخر حجرًا من حذائه. في الجهة المقابلة من البحيرة، تمر سحابة أمام الحافة الجبلية، فلا يبقى مضيئًا سوى طرفها العلوي.",
      "حين ترفع البقرة رأسها، تتدلى قطرات من الشعر النحاسي تحت ذقنها. تمشي على الضفة حتى تظهر الطاحونة من جديد. تدور أجنحتها ببطء فوق سحابة الوادي. يلتقط المسافران البطانية ويتبعانها. تلامس زهرة عالقة بفرو البقرة غصنًا منخفضًا وتبقى عليه، بينما يمتد ذيل المذنّب الشاحب فوق الدرب الجبلي."
    ],
  },
  'a-night-beneath-the-ice': {
    ja: [
      "男は青い灯りの下で止まり、コートの雪を払った。古い壁の脇に光の輪が浮かび、石畳の間の水に映っていた。内ポケットから封筒を取り出し、湿った紙越しに宛先を確かめた。路地の下、坂の両側にはモミの木が立っていた。その先の曲がり角を琥珀色の灯りが示していた。封筒をしまい、雪がまだ石を隠していない壁際を選んで歩いた。背後では、灯りの金具から同じ浅い割れ目へ水が滴り続けていた。",
      "曲がり角から川へ向かって、青い輪が道に沿って並んでいた。輪の下縁には雪が積もっていた。男は手すりにつかまって下り、手袋の触れた場所に黒い跡を残した。モミの幹の間から、金色の帯となった河岸が見えた。屋根の上にドームがそびえ、その反射は氷の欠片に分かれていた。最後の段に着くと、流氷が船着き場を通り過ぎるのを待った。",
      "対岸では、さらに大きな青い輪が厚い雲の中に浮かんでいた。その下を霧が動き、向こうの堤防を覆っていた。男は川沿いを歩き、歩道と同じ高さにある明るい窓まで来た。窓枠をたたいた。手が伸び、封筒を受け取れるだけ窓が開いた。暖かい空気が袖に届き、それからガラスはまた閉じた。男は手袋で外側の結露を少し拭った。",
      "帰り道、路地は濡れていた。暗い店の窓に、男のコートがモミの木や河岸の金色の線と重なって映った。ガラスの中では、肩の上に青い円が浮かんでいた。石の間を細い水が流れるよう、男は脇へよけた。川で二つの流氷が触れ合い、向きを変えて離れていった。それぞれがドームの反射の一部を、下流へ運んでいった。"
    ],
    en: [
      'The man stopped under the blue lantern to brush snow from his coat. A ring of light hung beside the old wall, catching in the water between the paving stones. He took an envelope from his inside pocket and checked the address through its damp paper. Below the lane, firs stood on both sides of the descent. Amber lamps marked a turn farther down. He put the envelope away and walked towards them, keeping close to the wall where the snow had not yet covered the stones. Behind him, water dripped from the lantern bracket into the same shallow crack.',
      'At the turn, blue rings followed the path towards the river. Snow had collected along their lower edges. The man held the rail as he went down, leaving dark marks where his glove brushed it. Between the fir trunks, the waterfront appeared in strips of gold. A dome rose above the roofs, with its reflection broken by pieces of ice. He reached the last step and waited for a floe to drift past the landing.',
      'Across the water, a larger blue ring hung in heavy cloud. Mist moved beneath it and covered the opposite embankment. The man followed the river until he came to a lit window level with the pavement. He knocked on the frame. A hand opened the window just far enough to take the envelope. Warm air reached his sleeve before the glass closed again. He wiped a patch of condensation from the outside with his glove.',
      'On the way back, the lane had turned wet. In a dark shop window, the man’s coat overlapped the reflected firs and the gold line of the waterfront. A blue circle rested above his shoulder in the glass. He stepped aside to let a thin stream run between the stones. At the river, two ice floes touched, turned apart and carried separate fragments of the dome’s reflection downstream.',
    ],
    ru: [
      'Мужчина остановился под синим фонарём и смахнул снег с пальто. Кольцо света висело у старой стены, отражаясь в воде между плитами. Он достал из внутреннего кармана конверт и проверил адрес сквозь отсыревшую бумагу. Ниже переулка по обе стороны спуска стояли ели. Янтарные фонари отмечали поворот. Мужчина убрал конверт и пошёл к ним, держась возле стены, где снег ещё не закрыл камень. Позади с крепления фонаря капала вода, попадая в одну и ту же неглубокую трещину. На выступе стены осталась полоска снега, снятого с рукава.',
      'За поворотом синие кольца уходили вдоль дорожки к реке. На их нижних краях собрался снег. Спускаясь, мужчина держался за перила и оставлял тёмные следы там, где их касалась перчатка. Между еловыми стволами набережная появлялась золотыми полосами. Над крышами поднимался купол. Его отражение разбивали льдины, медленно поворачивавшиеся в воде. Мужчина дошёл до последней ступени и подождал, пока одна из них проплывёт мимо площадки. На льдине лежала ветка, зацепленная за неровный край, и вода протекала между её тонкими отростками.',
      'Над рекой, среди тяжёлых облаков, висело большое синее кольцо. Под ним двигался туман, закрывая противоположный берег. Мужчина шёл вдоль воды, пока не добрался до освещённого окна на уровне мостовой. Он постучал в раму. Рука приоткрыла створку ровно настолько, чтобы взять конверт. Тёплый воздух коснулся рукава, затем стекло закрылось. Мужчина стёр перчаткой пятно влаги с наружной стороны. На мгновение сквозь сухой участок стала видна лампа внутри, после чего стекло снова начало запотевать.',
      'На обратном пути переулок стал мокрым. В тёмной витрине пальто накладывалось на отражённые ели и золотую линию набережной. Над плечом в стекле лежал синий круг. Мужчина шагнул в сторону, пропуская ручеёк между камнями. У реки две льдины соприкоснулись, развернулись и поплыли порознь, унося разные части отражения купола. Снег на выступе стены просел, и из-под него на мостовую упала ещё одна капля.',
    ],
    'zh-cn': [
      '男人在蓝色灯下停住，拍掉大衣上的雪。老墙旁悬着一个光环，映在铺路石之间的积水里。他从内袋拿出信封，透过有些潮湿的纸查看地址。巷子下面，两排冷杉夹着向下的路，几盏琥珀色的灯照出更低处的转弯。他把信封放回口袋，贴着墙走，那里的石头还没有被雪盖住。身后，水从灯架上滴下来，一直落进同一条浅缝。刚从袖口拍下的雪，在墙沿上留下了一小段白色。',
      '转过弯，蓝色环灯沿着小路一直排向河边，灯环下缘积了一层雪。男人扶着栏杆下台阶，手套碰过的地方留着深色印记。冷杉树干之间，河岸的金色灯光一段段露出来。一座圆顶高过屋檐，它的倒影被缓慢转动的浮冰分开。他走到最后一级台阶，等一块冰经过岸边的平台。冰上搁着一根树枝，挂在不平的边缘，水从细小的分枝之间流过。等冰漂远，他才把手从栏杆上移开。',
      '河面上方，厚厚的云中悬着一个更大的蓝色光环。雾在下面移动，遮住了对岸。他沿河走到一扇与路面齐平的亮窗前，敲了敲窗框。一只手把窗打开一道缝，刚好能够接过信封。暖空气碰到他的袖子，玻璃随即又关上。他用手套擦去窗外的一小块水汽。透过擦干的地方，能看见屋内一盏灯；过了一会儿，玻璃上重新结起薄雾，灯的边缘也渐渐模糊。他收回手，把湿的手套在大衣侧面轻轻擦了一下。',
      '回去时，巷子的石路已经湿了。暗着的店窗里，他的大衣轮廓和冷杉、河岸的金色灯线叠在一起。玻璃中，一只蓝色圆环停在肩膀上方。他往旁边站了一步，让细细的水流从石块之间经过。河边，两块浮冰碰到一起，又各自转开，带着圆顶倒影的不同部分向下游漂去。墙沿上的雪塌下一点，一滴水从下面落到路上。男人走过蓝色灯架，把领口向上拉了拉，鞋底在湿石面上留下几处深色脚印。',
    ],
    'pt-br': [
      'O homem parou sob a lanterna azul para tirar a neve do casaco. Um anel de luz pairava junto ao muro antigo, refletido na água entre as pedras do calçamento. Ele tirou um envelope do bolso interno e conferiu o endereço através do papel úmido. Abaixo da viela, abetos acompanhavam os dois lados da descida. Lâmpadas âmbar marcavam uma curva mais adiante. Ele guardou o envelope e seguiu perto do muro, onde a neve ainda não cobria as pedras. Atrás dele, a água pingava do suporte da lanterna na mesma rachadura rasa.',
      'Depois da curva, anéis azuis acompanhavam o caminho até o rio. A neve se acumulava nas bordas inferiores. O homem segurou o corrimão ao descer, deixando marcas escuras onde a luva encostava. Entre os troncos, a margem iluminada aparecia em faixas douradas. Uma cúpula se erguia acima dos telhados, com o reflexo partido por pedaços de gelo. Ele chegou ao último degrau e esperou uma placa passar diante do patamar. Um galho estava preso na borda irregular do gelo.',
      'Sobre a água, um anel azul maior pairava entre nuvens pesadas. A névoa passava por baixo e cobria a margem oposta. O homem seguiu o rio até uma janela iluminada na altura do calçamento. Bateu na moldura. Uma mão abriu a janela apenas o bastante para receber o envelope. O ar quente alcançou sua manga antes de o vidro se fechar. Ele limpou uma pequena área embaçada do lado de fora com a luva.',
      'Na volta, a viela estava molhada. Numa vitrine escura, o casaco se sobrepunha aos abetos refletidos e à linha dourada da margem. Um círculo azul aparecia acima do ombro no vidro. Ele deu um passo para o lado e deixou a água correr entre as pedras. No rio, duas placas de gelo se tocaram, giraram e levaram partes separadas do reflexo da cúpula correnteza abaixo.',
    ],

    ar: [
      "توقف الرجل تحت الفانوس الأزرق لينفض الثلج عن معطفه. كانت حلقة ضوء معلّقة بجوار الجدار القديم، ينعكس نورها في الماء بين حجارة الرصف. أخرج ظرفًا من جيبه الداخلي وتحقق من العنوان عبر ورقه الرطب. أسفل الزقاق، اصطفت أشجار التنوب على جانبي المنحدر. وكانت مصابيح كهرمانية تحدد منعطفًا أبعد إلى الأسفل. أعاد الظرف ومشى نحوها، ملازمًا الجدار حيث لم يغطّ الثلج الحجارة بعد. خلفه، تقاطر الماء من حامل الفانوس إلى الشق الضحل نفسه.",
      "عند المنعطف، امتدت حلقات زرقاء على الطريق نحو النهر. تراكم الثلج على أطرافها السفلى. أمسك الرجل بالدرابزين وهو ينزل، تاركًا آثارًا داكنة حيث احتك قفازه به. ظهرت الواجهة النهرية بين جذوع التنوب على هيئة شرائط ذهبية. علت قبة فوق الأسطح، وكسرت قطع الجليد انعكاسها. بلغ الدرجة الأخيرة وانتظر حتى تمر قطعة جليد طافية بجوار المرسى.",
      "عبر الماء، تدلت حلقة زرقاء أكبر بين سحب ثقيلة. تحرك الضباب تحتها وغطّى الضفة المقابلة. تبع الرجل النهر حتى بلغ نافذة مضاءة بمستوى الرصيف. طرق إطارها. فتحت يد النافذة بمقدار يكفي لأخذ الظرف. وصل الهواء الدافئ إلى كمّه قبل أن يُغلق الزجاج مجددًا. مسح بقفازه بقعة من التكاثف على السطح الخارجي.",
      "في طريق العودة، كان الزقاق قد ابتلّ. وفي واجهة متجر معتمة، تراكب معطف الرجل مع انعكاس التنوب والخط الذهبي للواجهة النهرية. استقرت دائرة زرقاء فوق كتفه في الزجاج. تنحّى ليسمح لجدول رفيع بالمرور بين الحجارة. وعند النهر، تلامست قطعتان من الجليد، ثم دارتا مبتعدتين، وحملتا شظيتين منفصلتين من انعكاس القبة مع التيار."
    ],
  },
};

export const collectionStories: Record<string, Record<Locale, string[]>> = {
  ...legacyCollectionStories,
  "open-circuit": {
    "en": [
      "The keeper unfastened his boat beneath the last lit bridge. A spool of amber thread rested in a metal box beside his foot. Above the canal, blue panels climbed the towers, and their reflections broke against the bow. He pulled once on the rope, pushed away from the wall, and let the current carry him past the closed landing stages. One pink window remained open high above the water.",
      "At the end of the canal, a luminous sheet hung between two posts. Its edge brushed the boat. The keeper caught a corner and drew it over the box, leaving his wet hand visible through the blue folds. Amber curls moved across the cloth as it settled. He tucked the loose edge beneath the lid and guided the boat into a passage lined with dark chrome.",
      "The passage narrowed around a floating ring. A section was missing from its left side; small colored squares drifted through the gap and gathered briefly on the water. The keeper raised the box, unwound a length of thread, and held it beside the opening. The loose end lifted from his fingers. It joined the moving fragments, while the spool turned slowly inside its metal case. The boat turned sideways. He braced the oar against the wall and held the box steady until its reflection narrowed along the chrome. The bow scraped a low stone ledge.",
      "Beyond the ring, black glass walls rose along an amber stream. The boat entered their shadow. The keeper fastened the box to a low mooring post and left the lid open, with the blue cloth folded beneath it. More thread slipped across the rim and followed the water around the first bend. He held the boat against the bank until the spool stopped knocking, then loosened the rope and reached for his oar."
    ],
    "ru": [
      "Смотритель отвязал лодку под последним освещённым мостом. У его ноги стояла металлическая коробка с катушкой янтарной нити. По башням над каналом поднимались синие панели, их отражения ломались перед носом лодки. Он потянул верёвку, оттолкнулся от стены и позволил течению нести себя мимо закрытых причалов. Высоко над водой оставалось открытым одно розовое окно. На ближайшей лестнице темнела мокрая ступень, до которой только что доставала корма.",
      "В конце канала между двумя стойками висело светящееся полотно. Его край коснулся борта. Смотритель поймал угол и накрыл коробку, оставив ладонь под синими складками: сквозь них были видны мокрые пальцы. Пока ткань оседала, по ней проходили янтарные завитки. Он подвернул свободный край под крышку и направил лодку в проход, облицованный тёмным хромом. На изгибах стен отражение коробки растягивалось и снова собиралось в узкую полосу.",
      "Проход сузился возле парящего кольца. Слева в нём недоставало целого участка; через разрыв летели цветные квадраты и ненадолго собирались у воды. Смотритель поднял коробку, отмотал немного нити и поднёс её к отверстию. Свободный конец выскользнул из пальцев. Он потянулся за движущимися частицами, а катушка медленно повернулась внутри металлического футляра. Лодку развернуло, и смотрителю пришлось упереться веслом в стену.",
      "За кольцом по берегам янтарного ручья поднялись стены чёрного стекла. Лодка вошла в их тень. Смотритель закрепил коробку на низком причальном столбе и оставил крышку открытой, сложив под неё синюю ткань. Нить скользила через край и уходила вместе с водой за первый поворот. Он придерживал лодку у берега, пока катушка не перестала постукивать. Потом ослабил верёвку и потянулся за веслом, лежавшим поперёк мокрой скамьи."
    ],
    "zh-cn": [
      "守夜人解开小船，把缆绳从最后一座亮着灯的桥下拉回来。脚边放着一只金属盒，里面装着一卷琥珀色的细线。运河上方的高楼一层层亮着蓝色面板，倒影碰到船头，分成窄窄的碎片。他用手撑开岸墙，让水流带着小船经过已经关闭的码头。高处还有一扇粉红色的窗户开着，窗下的金属栏杆只露出一小段光。",
      "运河尽头，两根立柱之间垂着一块发光的布，布边轻轻擦过船舷。他抓住一角，把它盖到金属盒上。蓝色褶皱下面，湿手指仍然看得清楚。布料慢慢落稳时，琥珀色的卷纹沿着表面移动。他将多余的布边塞到盒盖下面，划进一条包着深色铬金属的水道。盒子的倒影在弯曲的墙上拉长，又收成一道细线。",
      "水道在一只悬浮圆环前变窄。圆环左侧缺了一段，彩色小方块从缺口穿过去，短暂地聚在水面上。他拿起盒子，放出一截细线，将线头靠近缺口。细线从指间抬起，跟着那些移动的碎片往前伸，盒里的线轴慢慢转动。小船随之转了方向，他把桨抵住墙面，等船身重新顺着水道摆正，才松开扶着盒盖的手。",
      "越过圆环，黑玻璃高墙夹住一条琥珀色的溪流。船驶入阴影，他把盒子固定在低矮的系船柱上，盒盖敞着，蓝布折在下面。细线滑过金属边缘，跟着流水绕过第一个弯。他扶着船身，直到线轴不再敲击盒壁。随后他放松缆绳，伸手去拿横放在湿座板上的桨。盒边还挂着一滴水，照着对岸一小片蓝光。"
    ],
    "pt-br": [
      "O vigia soltou o barco sob a última ponte iluminada. Uma caixa de metal com um carretel de fio âmbar estava junto ao seu pé. Acima do canal, painéis azuis subiam pelas torres, e seus reflexos se quebravam na proa. Ele recolheu a corda, empurrou a parede com a mão e deixou a corrente levá-lo pelos ancoradouros fechados. Uma janela rosa continuava aberta no alto.",
      "No fim do canal, um tecido luminoso pendia entre dois postes. A borda roçou no barco. O vigia segurou uma ponta e cobriu a caixa, deixando a mão molhada visível através das dobras azuis. Curvas de âmbar atravessaram o tecido enquanto ele se acomodava. O homem prendeu a sobra sob a tampa e conduziu o barco a uma passagem revestida de cromo escuro.",
      "A passagem se estreitava ao redor de um anel flutuante. Faltava um trecho do lado esquerdo; pequenos quadrados coloridos atravessavam a abertura e se juntavam por instantes sobre a água. O vigia ergueu a caixa, desenrolou um pedaço de fio e o aproximou do vão. A ponta se levantou de seus dedos e acompanhou os fragmentos. Dentro da caixa, o carretel começou a girar devagar.",
      "Depois do anel, paredes de vidro negro acompanhavam um riacho âmbar. O barco entrou na sombra. O vigia prendeu a caixa a um poste baixo e deixou a tampa aberta, com o tecido azul dobrado embaixo. Mais fio deslizou pela borda e seguiu a água até a primeira curva. Ele segurou o barco junto à margem até o carretel parar de bater. Então afrouxou a corda e alcançou o remo."
    ],
    "ja": [
      "夜番は、最後の明るい橋の下で小舟の綱をほどいた。足元の金属箱には、琥珀色の糸を巻いた糸巻きが入っている。運河の上では、塔の青いパネルが幾重にも光り、その反射が舳先に当たって細かく割れた。壁を手で押し、閉まった船着き場の前を流れに任せて進む。高い窓が一つだけ、桃色の光を残して開いていた。",
      "運河の端には、二本の柱の間に光る布が掛かっていた。裾が船縁に触れる。夜番は角をつかんで箱にかぶせた。青いひだ越しに、濡れた指が透けて見えた。布が落ち着くにつれ、琥珀色の渦が表面を移動する。余った端を蓋の下へ挟み、小舟を黒いクロム張りの水路へ向けた。壁の曲面で箱の影が細長く伸びた。",
      "水路は、宙に浮く輪のそばで狭くなった。輪の左側には切れ目があり、色のついた小さな四角がそこを通って水面に集まる。夜番は箱を持ち上げ、糸を少しほどいて切れ目に近づけた。糸の端が指から浮き、流れるかけらを追った。箱の中で糸巻きがゆっくり回る。小舟が横を向き、夜番は櫂を壁に当てて支えた。",
      "輪の向こうでは、琥珀色の流れに沿って黒いガラスの崖が立っていた。小舟が影に入る。夜番は低い杭に箱を結び、青い布を畳んで蓋の下へ置いた。糸は箱の縁を越え、水と一緒に最初の曲がり角へ消えていく。糸巻きが箱を叩かなくなるまで舟を岸に押さえ、それから綱を緩めた。濡れた腰掛けの上へ手を伸ばし、櫂を引き寄せた。"
    ],
    "ar": [
      "فكّ الحارس حبل قاربه تحت آخر جسر مضاء. كانت عند قدمه علبة معدنية تحتوي على بكرة خيط كهرماني. فوق القناة، صعدت ألواح زرقاء على واجهات الأبراج، وتكسرت انعكاساتها عند مقدمة القارب. سحب الحبل ودفع الجدار بيده، ثم ترك التيار يحمله أمام الأرصفة المغلقة. بقيت نافذة وردية واحدة مفتوحة في الأعلى، ولمع تحتها جزء صغير من درابزين معدني بعيد عن الماء.",
      "عند نهاية القناة، تدلّى نسيج مضيء بين عمودين. لامس طرفه حافة القارب. أمسك الحارس بإحدى زواياه ومدّه فوق العلبة، وظلت أصابعه المبتلة ظاهرة عبر الطيات الزرقاء. تحركت التفافات كهرمانية على القماش وهو يستقر. دسّ الطرف الزائد تحت الغطاء ووجّه قاربه إلى ممر تغطيه صفائح كروم داكنة. على انحناءات الجدران، استطال انعكاس العلبة ثم انضمّ مجددًا في شريط ضيق.",
      "ضاق الممر حول حلقة عائمة. كان جزء من جانبها الأيسر مفقودًا؛ عبرت الفتحة مربعات ملونة صغيرة، وتجَمّعت للحظات على سطح الماء. رفع الحارس العلبة، وفكّ طولًا من الخيط، ثم قرّب طرفه من الفتحة. ارتفع الخيط عن أصابعه ولحق بالشظايا المتحركة. بدأت البكرة تدور ببطء داخل صندوقها المعدني. انحرف القارب، فأسند الحارس مجدافه إلى الجدار وانتظر حتى عاد المقدّم موازيًا للممر.",
      "وراء الحلقة، ارتفعت جدران من الزجاج الأسود على جانبي جدول كهرماني. دخل القارب ظلّها. ربط الحارس العلبة بعمود إرساء منخفض، وترك غطاءها مفتوحًا، مع النسيج الأزرق مطويًا تحته. انزلق مزيد من الخيط فوق الحافة وتبع الماء إلى أول منعطف. أبقى القارب ملاصقًا للضفة حتى توقفت البكرة عن الطرق داخل العلبة. ثم أرخى الحبل ومدّ يده إلى المجداف الموضوع على المقعد المبتل."
    ]
  },
  "weightless-feathers": {
    "en": [
      "The red bird waited in the station airlock with both boots tucked into their loops. A pale band of Earth crossed the small window in the door. He tightened one glove, turned his head inside the clear helmet, and watched the reflection slide over his beak. When the outer hatch opened, the station lights made a short white stripe along the edge of his suit.",
      "He moved away from the hatch and reached for the next handhold. Below him, clouds curved around a blue coast. A red feather floated beyond the rail, turning so slowly that its narrow edge almost disappeared against the dark. He stopped. The feather crossed the reflection of Earth in his visor, then drifted toward a patch of sunlight beside the station. A fine pale trail followed its tip.",
      "The bird eased forward without taking his eyes off it. His glove passed beneath the feather, missed, and came around again. This time it settled against his palm. He closed his fingers gently and turned back toward the lit hatch. Along the glass of his helmet, the coast moved in the opposite direction. The station cast a long shadow across one leg of the white suit. At the doorway, he pinned the feather beneath his thumb, stretched his free fingers toward the handle, and watched a narrow blue reflection move along the small metal latch.",
      "Later, beside the round porthole, he laid the feather on the window ledge and watched Earth pass below. Far beyond the glass, red filaments gathered into the outline of a bird with open wings. One wing slowly loosened into thin strands while the other crossed a small field of stars. He pressed the feather beneath his foot before the air from the ceiling vent could lift it."
    ],
    "ru": [
      "Красная птица ждала в шлюзе станции, закрепив оба ботинка в петлях. Светлая полоса Земли пересекала маленькое окно в двери. Он подтянул одну перчатку, повернул голову внутри прозрачного шлема и проследил, как отражение скользнуло по клюву. Когда наружный люк открылся, лампы станции оставили короткую белую полосу на краю скафандра. У поручня висела свободная петля страховки, её тень медленно проходила по обшивке рядом с ботинком.",
      "Он отодвинулся от люка и потянулся к следующему поручню. Внизу облака огибали синий берег. За ограждением летело красное перо, поворачиваясь так медленно, что его узкий край почти исчезал в темноте. Птица остановилась. Перо пересекло отражение Земли в визоре и двинулось к освещённому участку рядом со станцией. За кончиком тянулась тонкая холодная линия. Свет на стекле на мгновение закрыл её, затем линия появилась снова.",
      "Птица осторожно подалась вперёд, не сводя с него глаз. Перчатка прошла под пером, промахнулась и вернулась с другой стороны. На этот раз перо легло на ладонь. Он мягко сомкнул пальцы и повернулся к освещённому люку. По стеклу шлема берег поплыл в обратную сторону. Станция отбросила длинную тень на одну штанину белого скафандра. У двери пришлось придержать перо большим пальцем, чтобы дотянуться до ручки.",
      "Позже у круглого иллюминатора он положил перо на край окна и смотрел, как внизу проходит Земля. Далеко за стеклом красные волокна собрались в очертания птицы с раскрытыми крыльями. Одно крыло медленно распускалось на тонкие нити, другое пересекало небольшой участок звёзд. Он прижал перо лапой, прежде чем воздух из потолочной решётки успел поднять его. На оконном краю осталось светлое пятно от отражённого облака."
    ],
    "zh-cn": [
      "红鸟在空间站气闸里等候，两只靴子固定在脚环中。门上的小窗被地球的一条浅色弧线横穿。他收紧一只手套，在透明头盔里转过头，看着倒影滑过鸟喙。外舱门打开时，站内灯光在白色宇航服边缘留下一道窄窄的亮线。扶手旁垂着一圈松开的安全带，它的影子正慢慢移过靴子附近的舱壁。",
      "他离开舱门，伸手寻找下一个握点。下方的云沿着蓝色海岸弯曲。一根红羽毛漂在栏杆外，转得很慢，窄边几乎融入黑暗。他停下来。羽毛横过面罩里的地球倒影，朝空间站旁一片阳光移去。羽尖后面跟着一条细细的冷色光线，玻璃上的反光一度挡住它，过了一会儿，它又从明亮的弧线下面露出来。",
      "红鸟轻轻向前挪，目光始终跟着羽毛。手套从羽毛下面滑过，落了空，又从另一侧绕回来。这次羽毛贴住了掌心。他慢慢合拢手指，转向亮着灯的舱门。头盔玻璃上的海岸向相反方向移动，空间站在白色宇航服的一条腿上投下长影。他来到舱门旁，用拇指轻轻压住羽毛，腾出手去够门边的把手。玻璃边缘的一线蓝光落在他的手套上，随着门扇移动，慢慢滑到指尖。",
      "后来，他坐在圆形舷窗旁，把羽毛放在窗沿，看地球从下面经过。遥远的玻璃外，红色丝缕聚成一只展翅鸟的轮廓。一侧翅膀缓慢散成细线，另一侧掠过一小片星群。头顶通风口吹来气流，他用脚压住羽毛，没有让它飘起来。一块云的倒影滑过窗沿，羽毛的红色细枝在短暂的亮光里一根根显出来。"
    ],
    "pt-br": [
      "O pássaro vermelho esperava na câmara de ar da estação, com as duas botas presas às alças. Uma faixa clara da Terra atravessava a pequena janela da porta. Ele ajustou uma luva, virou a cabeça dentro do capacete transparente e acompanhou o reflexo passando sobre o bico. Quando a escotilha externa se abriu, as luzes da estação desenharam uma faixa branca na borda do traje.",
      "Ele se afastou da escotilha e procurou o próximo apoio. Lá embaixo, nuvens contornavam uma costa azul. Uma pena vermelha flutuava além do corrimão, girando tão devagar que sua borda estreita quase desaparecia na escuridão. Ele parou. A pena cruzou o reflexo da Terra no visor e seguiu para uma área de sol junto à estação. Um rastro fino e claro acompanhava sua ponta.",
      "O pássaro avançou com cuidado, sem perder a pena de vista. A luva passou por baixo, errou e voltou pelo outro lado. Dessa vez, a pena pousou na palma. Ele fechou os dedos de leve e se virou para a escotilha iluminada. Na curva do capacete, a costa se deslocou na direção oposta. A estação projetou uma sombra comprida sobre uma das pernas do traje branco. Uma faixa azul avançou devagar até seus dedos.",
      "Mais tarde, junto à janela redonda, ele deixou a pena no parapeito e observou a Terra passar abaixo. Muito além do vidro, filamentos vermelhos se juntaram no contorno de um pássaro de asas abertas. Uma asa se desfazia lentamente em fios; a outra cruzava um pequeno grupo de estrelas. Ele prendeu a pena sob o pé antes que o ar da saída no teto pudesse levantá-la."
    ],
    "ja": [
      "赤い鳥は、両足のブーツを輪に留めてエアロックで待っていた。扉の小窓を、地球の淡い帯が横切る。片方の手袋を締め、透明なヘルメットの中で頭を動かした。反射がくちばしの上を滑っていく。外側のハッチが開くと、宇宙ステーションの照明が宇宙服の端に短い白い筋を作った。手すりには、安全帯の輪が一つぶら下がっていた。",
      "ハッチを離れ、次の手すりへ手を伸ばす。下では雲が青い海岸線に沿って曲がっていた。柵の向こうに赤い羽が浮いている。回転は遅く、細い縁がときおり闇に溶けた。鳥は動きを止めた。羽はバイザーに映る地球を横切り、ステーション脇の日なたへ向かう。その先端から、冷たい色の細い光跡が続いていた。",
      "羽から目を離さず、少しずつ近づいた。手袋は羽の下を通り過ぎ、一度空振りしてから反対側へ回った。今度は羽が手のひらに重なる。指をそっと閉じて、明るいハッチへ向き直った。ヘルメットの曲面に映る海岸が逆向きに動く。白い宇宙服の片脚を、ステーションの長い影が横切った。扉の前で羽を親指で押さえ、取っ手に手を掛けた。",
      "あとで丸窓のそばに座り、鳥は羽を窓台に置いた。下を地球が通り過ぎる。ガラスのはるか向こうでは、赤い筋が翼を広げた鳥の輪郭に集まっていた。片方の翼は細い糸へゆっくりほどけ、もう片方は小さな星の群れに重なる。天井の通気口から風が来る前に、鳥は足で羽を押さえた。雲の反射が、窓台の上を明るく流れていった。"
    ],
    "ar": [
      "انتظر الطائر الأحمر داخل غرفة معادلة الضغط في المحطة، وقد ثبّت حذاءيه في الحلقتين. مرّ شريط باهت من الأرض عبر نافذة صغيرة في الباب. شدّ أحد قفازيه، وأدار رأسه داخل الخوذة الشفافة، وراقب الانعكاس وهو ينزلق فوق منقاره. عندما انفتحت البوابة الخارجية، رسمت مصابيح المحطة خطًا أبيض قصيرًا على حافة بدلته. وبجانب الدرابزين، تدلت حلقة فضفاضة من حزام الأمان فوق ألواح الجدار.",
      "ابتعد عن البوابة ومدّ يده نحو المقبض التالي. تحته، التفت سحب حول ساحل أزرق. طفت ريشة حمراء وراء الحاجز، تدور ببطء حتى تكاد حافتها الضيقة تختفي في الظلام. توقف الطائر. عبرت الريشة انعكاس الأرض على زجاج خوذته، ثم اتجهت إلى بقعة شمس قرب المحطة. تبع رأسها أثر رفيع بارد اللون، غطّاه وهج الزجاج لحظة قبل أن يظهر من جديد.",
      "تقدم الطائر بحذر وعيناه على الريشة. مرّ قفازه تحتها وأخطأتها، ثم عادت من الجانب الآخر. هذه المرة استقرت الريشة على كفّه. أغلق أصابعه برفق واستدار نحو البوابة المضيئة. على زجاج خوذته، تحرك الساحل في الاتجاه المقابل. ألقت المحطة ظلًا طويلًا على إحدى ساقي البدلة البيضاء. وعند الباب، ضغط على الريشة بإبهامه كي يمدّ يده إلى المقبض القريب من الحافة.",
      "لاحقًا، جلس بجوار النافذة المستديرة، ووضع الريشة على حافتها، وراقب الأرض وهي تمرّ في الأسفل. بعيدًا خلف الزجاج، تجمعت خيوط حمراء في هيئة طائر باسط جناحيه. انفكّ أحد الجناحين ببطء إلى شعيرات رفيعة، فيما عبر الآخر مجموعة صغيرة من النجوم. ثبّت الريشة تحت قدمه قبل أن يرفعها الهواء القادم من فتحة السقف. تحرك انعكاس سحابة على الحافة وأضاء خطوط الريشة الحمراء."
    ]
  },
  "observatory-of-tides": {
    "en": [
      "At low tide, the observer opened the narrow shutter of the floating dome. Blue light passed through its thin walls and spread across the water below. A red seed tapped against the railing, caught on a translucent strand. She lifted it into her palm and held it beside the warm opening. Beneath the platform, the long jellyfish ribbons moved with the remaining current.",
      "Inside the cut pomegranate, pale galleries curved around a blue pool. Small jellyfish passed beneath the lowest bridge. The observer carried the seed along the inner wall, where other red grains rested in shallow pockets. At the far end, a staircase rose through a folded blue canopy. She set the seed into an empty step. The step lit up, and a warm line reached toward the dome above.",
      "She followed the staircase with one hand on its papery rail. From the top landing, a broad jellyfish lantern filled the sky over the distant observatory. Its milk-white layers slowly parted around a cluster of ruby seeds. A loose ribbon brushed the landing and lay across the observer's sleeve. She eased it free, leaving its thin edge hanging over the rail, where the blue light showed through. As the ribbon moved, a narrow shadow crossed the next step, slipped between the red grains, and vanished along the curved side of the stair.",
      "On the round table beneath the telescope, translucent rings surrounded an open model dome. She turned the outer ring until two jellyfish inlays faced the shore. A red marker rolled toward the gap, and she stopped it with one finger. Outside, the lantern shifted over the water. She moved the marker to the next small hollow and watched the reflection slide past the platform's last support."
    ],
    "ru": [
      "Во время отлива наблюдательница открыла узкую створку парящего купола. Голубой свет прошёл сквозь тонкие стенки и растёкся по воде внизу. О перила постукивало красное зерно, зацепившееся за полупрозрачную нить. Она подняла его на ладонь и поднесла к тёплому проёму. Под площадкой длинные ленты медузы двигались вслед за остаточным течением. На нижнем краю одной ленты задержалась светлая капля, которая дрожала при каждом повороте.",
      "Внутри разрезанного граната светлые галереи огибали голубой водоём. Под самым низким мостиком проплывали маленькие медузы. Наблюдательница несла зерно вдоль внутренней стены, где в неглубоких ячейках лежали другие красные зёрна. В конце прохода лестница поднималась сквозь складчатый синий навес. Она положила зерно на пустую ступень. Ступень засветилась, и тёплая линия потянулась к верхнему куполу, постепенно обозначая края следующих площадок над тёмным провалом.",
      "Она пошла по лестнице, придерживаясь за бумажные перила. С верхней площадки было видно, как над далёкой обсерваторией раскрывается большой фонарь-медуза. Его молочные слои медленно расходились вокруг рубиновых зёрен. Свободная лента коснулась площадки и легла поперёк рукава. Наблюдательница осторожно высвободила руку, оставив тонкий край свисать через перила. Сквозь него проходил голубой свет. При движении ленты на ступени появлялась узкая тень и сразу исчезала.",
      "На круглом столе под телескопом полупрозрачные кольца окружали открытый макет купола. Она повернула внешнее кольцо, пока две вставки с медузами не оказались напротив берега. Красная метка покатилась к зазору, и наблюдательница остановила её пальцем. Снаружи фонарь сместился над водой. Она передвинула зерно в следующее маленькое углубление и проследила, как отражение прошло за последнюю опору площадки. Затем отняла руку от кольца, оставив его в новом положении."
    ],
    "zh-cn": [
      "退潮时，观测员推开悬浮穹顶上的窄窗。蓝光穿过薄薄的墙壁，铺向下方海面。一颗红籽挂在半透明细丝上，轻轻敲着栏杆。她把它托在掌心，举到温暖的窗口旁。平台下面，水母的长带随着余下的水流摆动。带子末端留着一滴浅色水珠，每次转向时，水珠都跟着轻颤。",
      "切开的石榴内部，浅色廊道绕着蓝色水池延伸，小水母从最低的桥下经过。她沿内墙带着红籽往前走，墙上的浅格里放着别的红籽。通道尽头，一道阶梯穿进折叠的蓝色伞盖。她把红籽放到空着的一级台阶上。台阶亮了，暖光沿着上方的踏板延伸，照出黑暗里下一处转弯。",
      "她扶着纸质栏杆上楼。从最高的平台望去，一盏巨大的水母灯在远处天文台上方展开。乳白色薄层绕着红籽慢慢分开。一条松开的带子擦过平台，落在她的袖子上。她轻轻抽出手，让薄边垂在栏杆外。蓝光穿过带子，在台阶上投下一条窄影，又随下一次摆动移开。她用另一只手压住栏杆上的纸边，等带子从袖口滑开。细小的红籽在台阶里发亮，靠近指尖的一颗映出窗内的暖光。她顺着那个亮点向前挪了一步，脚下的薄纸轻轻抬起，又贴回原来的位置。她退开半步，等纸边重新静止。",
      "望远镜下的圆桌上，半透明圆环围着一个打开的穹顶模型。她转动外环，让两个水母嵌片朝向海岸。一颗红色标记滚向缺口，她用手指挡住它。窗外，灯笼移过水面。她把标记移到下一个小凹槽，看着倒影滑过平台最后一根支柱，随后松开圆环。"
    ],
    "pt-br": [
      "Na maré baixa, a observadora abriu a pequena janela da cúpula flutuante. A luz azul atravessou as paredes finas e se espalhou pela água. Uma semente vermelha batia no corrimão, presa a um fio translúcido. Ela a recolheu na palma e a ergueu junto à abertura iluminada. Sob a plataforma, as longas fitas da água-viva acompanhavam o resto da corrente.",
      "Dentro da romã aberta, galerias claras contornavam uma piscina azul. Pequenas águas-vivas passavam sob a ponte mais baixa. A observadora levou a semente pela parede interna, onde outros grãos vermelhos ocupavam cavidades rasas. No fim, uma escadaria subia por uma cobertura azul dobrada. Ela colocou a semente em um degrau vazio. O degrau acendeu, e uma linha de luz quente avançou para a cúpula acima.",
      "Ela subiu com uma mão no corrimão de papel. Do patamar, uma grande lanterna em forma de água-viva cobria o céu sobre o observatório distante. Camadas branco-leitosas se abriam em torno das sementes rubras. Uma fita solta roçou no patamar e caiu sobre sua manga. Ela a soltou com cuidado, deixando a borda pendurada no corrimão, atravessada pela luz azul.",
      "Na mesa redonda sob o telescópio, anéis translúcidos cercavam uma pequena cúpula aberta. Ela girou o anel externo até duas figuras de águas-vivas apontarem para a costa. Um marcador vermelho rolou para uma abertura, e ela o deteve com o dedo. Lá fora, a lanterna se deslocou sobre a água. Ela levou o marcador à cavidade seguinte e viu o reflexo passar pelo último suporte da plataforma."
    ],
    "ja": [
      "引き潮のころ、観測員は浮かぶドームの細い窓を開けた。青い光が薄い壁を透かして海面へ広がる。半透明の糸に絡まった赤い種が、欄干を叩いていた。彼女は種を手に取り、暖かな窓辺へかざした。足元では、クラゲの長い帯が残った流れに揺れていた。",
      "割れたザクロの内側では、淡い回廊が青い池を囲んでいた。低い橋の下を小さなクラゲが通る。壁のくぼみには赤い種が並び、その先に青い傘を貫く階段があった。彼女は空いた段に種を置いた。踏み板が光り、上のドームへ暖かな線が伸びた。",
      "紙の欄干に手を添えて階段を上る。踊り場から見ると、遠い天文台の上に大きなクラゲの灯りが開いていた。乳白色の層が赤い種の周りでほどける。垂れた帯が彼女の袖に触れた。そっと腕を抜き、帯の端を欄干の外へ垂らすと、青い光が透けた。",
      "望遠鏡の下の丸い机では、半透明の輪が小さなドームを囲んでいた。外の輪を回し、二つのクラゲ模様を岸へ向けた。赤い印が隙間へ転がり、彼女は指で止めた。窓の外で灯りが水上を移動する。印を隣のくぼみへ置くと、反射が足場の最後の支柱を通り過ぎた。"
    ],
    "ar": [
      "عند انحسار المدّ، فتحت الراصدة شق القبة العائمة الضيق. عبر الضوء الأزرق جدرانها الرقيقة وانتشر فوق الماء تحتها. طرقت حبة حمراء الدرابزين، عالقة بخيط شفاف. رفعتها في كفها وقرّبتها من الفتحة الدافئة. تحت المنصة، تحركت شرائط قنديل البحر الطويلة مع ما بقي من التيار. وعلى طرف أحد الشرائط، بقيت قطرة فاتحة ترتجف كلما تغيّر اتجاهه فوق سطح البحر الداكن.",
      "داخل الرمانة المفتوحة، انحنت أروقة فاتحة حول حوض أزرق. مرّت قناديل بحر صغيرة تحت الجسر الأدنى. حملت الراصدة الحبة بمحاذاة الجدار الداخلي، حيث استقرت حبات حمراء أخرى في تجاويف ضحلة. عند نهاية الممر، ارتفع سلّم عبر مظلة زرقاء مطوية. وضعت الحبة في درجة فارغة، فأضاءت الدرجة وامتد خط دافئ نحو القبة العليا، كاشفًا حواف الدرجات التالية فوق الفراغ المعتم.",
      "صعدت ويدها على درابزين الورق. من البسطة العليا، ملأ فانوس كبير بهيئة قنديل بحر السماء فوق المرصد البعيد. تباعدت طبقاته البيضاء الحليبية ببطء حول حبات ياقوتية. لامس شريط حر طرف البسطة واستقر على كمّها. أخرجت ذراعها برفق، وتركت حافته الرقيقة تتدلى وراء الدرابزين، حيث عبرها الضوء الأزرق. تحرك ظل ضيق على الدرجة تحتها، ثم انزاح مع التفافة الشريط التالية.",
      "على الطاولة المستديرة تحت التلسكوب، أحاطت حلقات شفافة بنموذج قبة مفتوحة. أدارت الحلقة الخارجية حتى واجه شكلا قنديل بحر الساحل. تدحرجت علامة حمراء نحو فجوة، فأوقفتها بإصبعها. في الخارج، انتقل الفانوس فوق الماء. نقلت العلامة إلى التجويف الصغير التالي، وراقبت الانعكاس يعبر آخر دعامة للمنصة. ثم أبعدت يدها عن الحلقة وتركتها في موضعها الجديد، بينما ظل الضوء الكهرماني واقعًا على حافة الطاولة."
    ]
  },
  ...Object.fromEntries(Object.values(publications).map((value) => {
    const item = value as { manifest: { collection: { slug: string } }; stories: Record<Locale, string[]> };
    return [item.manifest.collection.slug, item.stories];
  })),
};

export const supportCopy = {
  en: {
    cookies: ['Review your saved choice',
      'Use Cookie settings in the footer to review analytics and advertising separately. Save the options you want, then reopen the dialog to check the current choice. Clearing browser storage removes saved preferences. Browsing and both PNG download buttons remain available when you decline optional purposes. With JavaScript disabled, native downloads work and optional scripts do not run.'],
    contact: ['What to include in your message',
      'For a question about a wallpaper, include its title or the link to its page. If the question concerns a collection, send the collection link instead. Tell us whether you mean the horizontal desktop file or the vertical mobile file. This helps distinguish two versions of the same design and makes it easier to understand a detail in the composition. You can use email, the feedback form or the public contact links listed on this page.',
      'For a download or display problem, describe what you expected and what happened. Include the page address, the device type, the browser and whether the problem happens before or after saving the PNG. Check that you selected the intended orientation and kept the original filename. A wallpaper that looks cropped in system settings may simply need another fit option; a missing download or an incorrect file is a different problem. These details help make your report reproducible.',
      'For a licensing request, describe the intended use, where the image would appear and whether it would be part of a commercial project. The published license already allows personal wallpaper use and cropping for your own devices. It does not authorize selling or redistributing a pack. Sending a request does not extend that license. Use the full license page to check the existing terms before planning another use. If your message concerns stored data or a comment, identify the relevant page and explain the requested action.'],
    license: ['Choosing a file for personal use',
      'The landscape and portrait downloads are supplied for different screen shapes. Choosing one version does not change the license. You can keep the original PNG and make a separate crop for your own monitor, phone or tablet. The smaller gallery preview is there to help you choose a design; the download button saves the original file. Compare the listed dimensions with your screen before cropping.',
      'A link to a public wallpaper page lets someone else view the design and read these conditions. Redistributing the image files as a collection is a different action and is not allowed by the personal-use license. If you need an image for a product, advertising or another commercial project, explain that use through the contact page. The download buttons, image format and availability of a file do not grant permission beyond the conditions above.'],
    terms: ['Using the public gallery',
      'Collection pages group designs that share a visual theme. Open an individual wallpaper to compare its two orientations and read the original PNG dimensions. Search lets you combine a phrase with a category or collection filter. If no design matches, clear a filter or return to the full collection. A download saves the original image for use under the published license; the gallery preview is a smaller file intended for browsing.',
      'Cookie settings are available in the footer. Declining optional analytics and advertising does not prevent browsing or downloading. Ratings, comments and feedback are separate interactive actions and use the essential storage and security checks described in the privacy and cookie pages. Public comments are visible to other visitors; feedback is sent through the feedback form. Before using an image outside personal wallpaper use, read the license and contact us with the intended use.'],
    feedback: ['Describe a detail we can check',
      'Start with a short topic that identifies your suggestion or problem. In the message, include the affected page link or wallpaper title and explain the result you expected. If you mean a particular file, say whether it is the desktop or mobile PNG. The collection name helps when several designs have similar colours or shapes. Suggestions for future collections can describe a theme, colour palette or screen orientation.',
      'For a technical problem, include your browser, device type and the steps that reproduce it. Say whether the issue occurs during browsing, after clicking download or when setting the saved image as a wallpaper. You can try the other orientation and compare the dimensions shown on the page with your screen. Those checks help separate a crop setting from a file or page problem. If submitting the form fails, the message stays in the form so you can retry.',
      'The email field is optional. Use the direct email link if you prefer to write from your mail application or if JavaScript is unavailable. A feedback message is different from a public comment on a wallpaper. Questions about permissions for another use should describe the intended project and refer to the current license. Downloads remain available regardless of optional cookie preferences.'],
  },
  ru: {
    cookies: ['Как проверить сохранённый выбор',
      'Откройте настройки cookie внизу страницы, чтобы проверить аналитику и рекламу отдельно. Сохраните выбранные параметры и снова откройте окно для проверки текущего выбора. При очистке хранилища браузера сохранённые настройки удаляются. Отказ от необязательных целей не мешает просмотру и обеим кнопкам скачивания PNG. При отключённом JavaScript нативные скачивания работают, а необязательные скрипты не запускаются.'],
    contact: ['Что указать в сообщении',
      'Если вопрос касается отдельных обоев, укажите название или ссылку на их страницу. Для вопроса о наборе приложите ссылку на коллекцию. Уточните, какой файл вы имеете в виду: горизонтальный для компьютера или вертикальный для телефона. Так проще отличить два варианта одной работы и понять, о какой детали композиции идёт речь. Написать можно по электронной почте, через форму обратной связи или по публичным ссылкам на этой странице.',
      'При проблеме со скачиванием или отображением опишите ожидаемый результат и то, что получилось. Укажите адрес страницы, тип устройства, браузер и момент появления проблемы: до сохранения PNG или после него. Проверьте выбранную ориентацию и исходное имя файла. Если картинка обрезана в настройках системы, возможно, достаточно сменить режим заполнения. Отсутствующее скачивание или неверный файл — другая ситуация. Пошаговое описание помогает воспроизвести проблему без догадок.',
      'Для запроса о лицензии расскажите, как планируете использовать изображение, где оно появится и связано ли применение с коммерческим проектом. Опубликованная лицензия уже разрешает личные обои и обрезку для собственных устройств, но не продажу и распространение набора. Отправка запроса не расширяет эти права. Сначала прочитайте полные условия на странице лицензии. Для вопроса о хранящихся данных или комментарии укажите соответствующую страницу и опишите нужное действие. Это поможет связать обращение с конкретной ситуацией.'],
    license: ['Выбор файла для личного использования',
      'Горизонтальный и вертикальный варианты предназначены для экранов разных пропорций. Выбор варианта не меняет лицензию. Можно сохранить исходный PNG и отдельно обрезать копию для своего монитора, телефона или планшета. Уменьшенное превью в галерее помогает выбрать работу, а кнопка скачивания сохраняет оригинальный файл. Перед обрезкой сравните указанные размеры с пропорциями экрана.',
      'Ссылка на публичную страницу обоев позволяет другому человеку посмотреть работу и прочитать эти условия. Распространение самих файлов в виде коллекции — отдельное действие, которое личная лицензия не разрешает. Если изображение нужно для продукта, рекламы или другого коммерческого проекта, опишите такое применение через страницу контактов. Кнопка скачивания, формат изображения и доступность файла не предоставляют прав за пределами условий выше. Сохранённая копия также не означает передачу права собственности на изображение.'],
    terms: ['Работа с публичной галереей',
      'Страницы коллекций объединяют работы по визуальной теме. Откройте отдельные обои, чтобы сравнить две ориентации и посмотреть размеры оригинальных PNG. В поиске можно сочетать текстовый запрос с фильтром категории или коллекции. Если подходящей работы нет, уберите один фильтр или вернитесь к полной коллекции. Скачивание сохраняет исходное изображение для использования по опубликованной лицензии; превью в галерее является уменьшенным файлом для просмотра.',
      'Настройки cookie находятся внизу страницы. Отказ от необязательной аналитики и рекламы не мешает просмотру и скачиванию. Оценки, комментарии и обращения — отдельные интерактивные действия. Они используют необходимое хранение и проверки защиты, описанные на страницах конфиденциальности и cookie. Публичные комментарии видны другим посетителям, а обращение отправляется через форму обратной связи. Перед применением изображения за пределами личных обоев прочитайте лицензию и напишите нам о предполагаемом использовании.'],
    feedback: ['Опишите деталь, которую можно проверить',
      'Начните с короткой темы, которая обозначает предложение или проблему. В сообщении укажите ссылку на страницу или название обоев и объясните ожидаемый результат. Если речь о файле, уточните вариант PNG: для компьютера или телефона. Название коллекции помогает различить работы с похожими цветами и формами. В предложении будущей коллекции можно описать сюжет, палитру или нужную ориентацию экрана.',
      'Для технической проблемы укажите браузер, тип устройства и шаги воспроизведения. Уточните, когда она возникает: при просмотре страницы, после нажатия на скачивание или при установке сохранённой картинки. Можно сравнить другой вариант и сверить размеры со своим экраном. Так проще отличить настройку кадрирования от проблемы файла или страницы. Если отправить форму не получилось, текст остаётся в полях, чтобы можно было повторить попытку.',
      'Поле электронной почты необязательное. Прямая ссылка email подходит для письма из почтового приложения и для случая, когда JavaScript недоступен. Сообщение обратной связи отличается от публичного комментария под обоями. Вопрос о разрешении на другое использование лучше сопроводить описанием проекта и ссылкой на действующую лицензию. Выбор необязательных cookie не влияет на доступность скачивания.'],
  },
  'zh-cn': {
    cookies: ['检查已保存的选择',
      '通过页脚的 Cookie 设置，可以分别查看分析与广告选项。保存所需设置后，再次打开对话框确认当前选择。清除浏览器存储会删除已保存的偏好。拒绝可选用途不会影响浏览图片，也不会影响两个 PNG 下载按钮。关闭 JavaScript 时，原生下载仍然可用，可选脚本则不会运行。'],
    contact: ['联系时请说明哪些信息',
      '如果问题涉及某张壁纸，请附上图片标题或页面链接；如果涉及整个系列，请发送系列页面的链接。请说明你指的是电脑横向图片还是手机纵向图片，这样就能分清同一作品的两个版本，也更容易理解你提到的构图细节。你可以通过电子邮件、反馈表单，或本页列出的公开联系链接发送问题。浏览其他系列时遇到的建议，也可以指明相应页面，让说明更具体。',
      '遇到下载或显示问题时，请描述原本期望的结果与实际发生的情况。附上页面地址、设备类型、浏览器，以及问题是在保存 PNG 前还是保存后出现。先确认选择的方向与原始文件名。如果图片在系统壁纸设置中被裁切，可能只需要调整适配方式；无法下载或得到错误文件则是另一种情况。按顺序写下操作步骤，有助于复现问题，而不必猜测你使用的设置。',
      '咨询许可时，请说明图片的计划用途、展示位置，以及是否属于商业项目。现有许可已经允许在自己的设备上用作个人壁纸并进行裁切，但不允许出售或重新分发壁纸包。发出申请本身不会扩大这些权限。安排其他用途前，请先阅读完整许可页面。如果问题与保存的数据或评论有关，请指明相关页面，并说明希望采取的操作。'],
    license: ['为个人屏幕选择文件',
      '横向与纵向下载文件适合不同的屏幕比例，选择哪个版本都不会改变许可条件。你可以保留原始 PNG，再为自己的显示器、手机或平板裁切一份副本。画廊中的小幅预览用于帮助选择作品，下载按钮保存的是原始文件。裁切之前，请比较标注的像素尺寸与屏幕比例。',
      '分享公开壁纸页面的链接，可以让其他人查看画面并阅读这些条件。将图片文件打包后重新分发则是另一种行为，不在个人使用许可之内。如果需要把图片用于产品、广告或其他商业项目，请通过联系页面说明用途。下载按钮、文件格式与文件的公开可用性，都不会授予上述条件之外的权限。保存副本也不代表获得图片的所有权。'],
    terms: ['浏览公开画廊',
      '系列页面按照视觉主题整理作品。打开单张壁纸后，可以比较两个方向，并查看原始 PNG 的尺寸。搜索支持将关键词与类别或系列筛选组合使用。如果没有匹配的作品，可以清除一个筛选条件，或返回完整系列继续浏览。下载保存的是适用当前许可的原始图片；画廊预览则是用于浏览的小尺寸文件。关闭 JavaScript 后，仍可浏览公开页面并选择下载文件；评分、评论与反馈表单需要 JavaScript，以完成输入校验和安全检查。遇到无法使用表单的情况，也可以通过联系页面中的直接邮件链接发送问题。',
      'Cookie 设置入口位于页面底部。拒绝可选分析与广告不会阻止浏览或下载。评分、评论与反馈是独立的互动操作，会使用隐私与 Cookie 页面说明的必要存储和安全检查。公开评论可以被其他访客看到，反馈消息通过反馈表单发送。准备在个人壁纸之外使用图片时，请先阅读许可，并联系我们说明预期用途。'],
    feedback: ['描述可以核查的细节',
      '先用简短主题说明建议或问题，再在消息中附上相关页面链接或壁纸标题，并解释原本期望的结果。如果涉及具体文件，请说明是电脑版还是手机版 PNG。对于颜色或构图相近的作品，系列名称可以帮助分辨。建议新系列时，可以描述希望看到的主题、配色或屏幕方向。',
      '技术问题请包含浏览器、设备类型与复现步骤，并说明发生阶段：浏览页面、点击下载，或将保存的图片设置为壁纸。你可以试试另一个方向，并比较页面标注的尺寸与设备屏幕。这样有助于区分裁切设置与文件或页面问题。如果提交表单失败，已输入的消息会留在表单中，方便再次尝试。',
      '电子邮件字段可以留空。如果更喜欢从邮件应用发信，或浏览器无法使用 JavaScript，可以使用直接邮件链接。反馈消息与壁纸下方的公开评论是不同的操作。询问其他用途的许可时，请说明项目，并参考现行许可。无论怎样选择可选 Cookie，壁纸下载都保持可用。请不要在反馈中填写密码、付款信息或访问令牌；描述公开页面和操作步骤就足够了。'],
  },
  'pt-br': {
    cookies: ['Confira a escolha salva',
      'Abra as configurações de cookies no rodapé para revisar análise e publicidade separadamente. Salve as opções desejadas e reabra a janela para conferir a escolha atual. Limpar o armazenamento do navegador remove as preferências salvas. Recusar finalidades opcionais mantém a navegação e os dois botões de download de PNG disponíveis. Sem JavaScript, os downloads nativos funcionam e os scripts opcionais não são executados.'],
    contact: ['O que incluir na mensagem',
      'Para uma pergunta sobre um papel de parede, inclua o título ou o link da página. Se a dúvida for sobre uma coleção, envie o link da coleção. Diga se você se refere ao arquivo horizontal para computador ou ao vertical para celular. Isso distingue as duas versões do mesmo desenho e ajuda a entender um detalhe da composição. Você pode usar email, o formulário de feedback ou os contatos públicos listados nesta página.',
      'Se houver um problema de download ou exibição, descreva o que esperava e o que aconteceu. Inclua o endereço da página, o tipo de aparelho, o navegador e diga se o problema aparece antes ou depois de salvar o PNG. Confira a orientação escolhida e o nome original do arquivo. Uma imagem recortada nas configurações do sistema pode precisar de outro modo de ajuste; um download ausente ou um arquivo incorreto é outra situação. Os passos ajudam a reproduzir o problema.',
      'Para solicitar uma licença, descreva o uso pretendido, onde a imagem apareceria e se faria parte de um projeto comercial. A licença publicada já permite papéis de parede pessoais e recortes para seus aparelhos, mas não permite vender ou redistribuir um pacote. Enviar um pedido não amplia essa licença. Leia os termos completos antes de planejar outro uso. Para uma pergunta sobre dados armazenados ou um comentário, identifique a página relevante e explique a ação desejada.'],
    license: ['Escolha de arquivo para uso pessoal',
      'Os arquivos horizontal e vertical atendem a proporções diferentes de tela. Escolher uma versão não altera a licença. Você pode guardar o PNG original e criar um recorte separado para seu monitor, celular ou tablet. A prévia menor da galeria ajuda a escolher o desenho; o botão de download salva o arquivo original. Compare as dimensões com a tela antes de recortar.',
      'Um link para a página pública permite que outra pessoa veja a imagem e leia estas condições. Redistribuir os arquivos como uma coleção é uma ação diferente, não permitida pela licença pessoal. Se precisar da imagem para um produto, publicidade ou outro projeto comercial, explique o uso pela página de contato. Os botões, o formato e a disponibilidade do arquivo não concedem permissões além das condições acima. Uma cópia salva também não transfere a propriedade da imagem.'],
    terms: ['Como usar a galeria pública',
      'As páginas de coleção agrupam desenhos com um tema visual em comum. Abra um papel de parede para comparar as duas orientações e conferir as dimensões dos PNG originais. A busca permite combinar uma frase com filtros de categoria ou coleção. Se nenhum desenho corresponder, limpe um filtro ou volte à coleção completa. O download salva a imagem original para uso conforme a licença publicada; a prévia da galeria é um arquivo menor destinado à navegação.',
      'As configurações de cookies ficam no rodapé. Recusar análise e publicidade opcionais não impede navegar ou baixar imagens. Avaliações, comentários e feedback são ações interativas separadas, com armazenamento essencial e verificações de segurança descritos nas páginas de privacidade e cookies. Comentários públicos ficam visíveis a outros visitantes; mensagens de feedback são enviadas pelo formulário. Antes de usar uma imagem além de um papel de parede pessoal, leia a licença e escreva sobre o uso pretendido.'],
    feedback: ['Descreva um detalhe que possamos conferir',
      'Comece com um assunto curto que identifique a sugestão ou problema. Na mensagem, inclua o link da página ou o título da imagem e explique o resultado esperado. Para um arquivo específico, diga se é o PNG para computador ou celular. O nome da coleção ajuda a distinguir desenhos com cores ou formas parecidas. Sugestões de futuras coleções podem descrever um tema, uma paleta ou uma orientação de tela.',
      'Para um problema técnico, inclua navegador, tipo de aparelho e os passos para reproduzir. Diga se ocorre ao navegar, clicar no download ou definir a imagem salva como papel de parede. Experimente a outra orientação e compare as dimensões indicadas com a tela. Isso ajuda a separar uma configuração de recorte de um problema de arquivo ou página. Se o envio falhar, a mensagem permanece no formulário para uma nova tentativa.',
      'O campo de email é opcional. Use o link direto se preferir escrever pelo seu aplicativo de correio ou se JavaScript estiver indisponível. Uma mensagem de feedback difere de um comentário público na página de uma imagem. Perguntas sobre permissões para outro uso devem descrever o projeto e consultar a licença atual. Downloads continuam disponíveis com qualquer escolha de cookies opcionais.'],
  },
  ja: {
    "cookies": [
      "保存した設定を確認する",
      "ページ下部の「Cookie 設定」から、アクセス分析と広告をそれぞれ確認できます。希望する項目を保存した後、設定画面をもう一度開くと現在の選択が表示されます。ブラウザーの保存データを消去すると、この設定も削除されます。任意の目的を拒否しても、サイトの閲覧や二つの PNG ダウンロードボタンは引き続き利用できます。JavaScript が無効な場合も通常のリンクからダウンロードでき、任意のスクリプトは実行されません。"
    ],
    "contact": [
      "お問い合わせに添えていただきたい内容",
      "壁紙についてのご質問には、作品名またはページのリンクを添えてください。コレクション全体についての場合は、コレクションのリンクをお知らせください。横長のパソコン用ファイルか、縦長のスマートフォン用ファイルかもご記入ください。同じデザインの二つのバージョンを区別し、構図のどの部分についてのご質問かを確認しやすくなります。メール、お問い合わせフォーム、このページに記載された公開の連絡先をご利用いただけます。",
      "ダウンロードや表示の問題については、期待した結果と実際に起きたことをお知らせください。ページのアドレス、端末の種類、ブラウザー、PNG を保存する前か後かを添えてください。選択した向きと、元のファイル名が保たれているかもご確認ください。OS の設定で壁紙が切れて見える場合は、表示方法を変更するだけで解決することがあります。ダウンロードできない場合や、別のファイルが保存される場合とは異なる問題です。こうした情報があると状況を再現しやすくなります。",
      "利用許諾についてのお問い合わせには、用途、画像を掲載する場所、商用プロジェクトに含まれるかをご説明ください。公開ライセンスでは、個人の壁紙としての使用と、ご自身の端末用のトリミングが認められています。壁紙パックの販売や再配布は認められていません。問い合わせを送るだけではライセンスの範囲は広がりません。他の用途を計画する前に、ライセンス全文をご確認ください。保存されたデータやコメントについては、該当ページと希望する対応をお知らせください。"
    ],
    "license": [
      "個人利用に合うファイルを選ぶ",
      "横長と縦長のファイルは、それぞれ異なる画面の比率に合わせて用意しています。どちらを選んでもライセンスは変わりません。オリジナルの PNG を保管し、モニター、スマートフォン、タブレットに合わせた別の切り抜きを作成できます。ギャラリーの小さいプレビューは作品を選ぶための画像で、ダウンロードボタンはオリジナルを保存します。トリミングする前に、記載された寸法と画面のサイズを比べてください。",
      "公開されている壁紙ページへのリンクを共有すると、相手も作品と利用条件を確認できます。画像ファイルをコレクションとして再配布することは別の行為で、個人利用のライセンスでは認められていません。商品、広告、その他の商用プロジェクトに画像が必要な場合は、お問い合わせページから用途をご説明ください。ダウンロードボタン、ファイル形式、ファイルを取得できることは、上記の条件を超える利用許諾を意味しません。"
    ],
    "terms": [
      "公開ギャラリーの使い方",
      "コレクションのページでは、共通する視覚的なテーマの作品をまとめています。壁紙を一枚開くと、二つの向きとオリジナル PNG の寸法を比べられます。検索では、検索語とカテゴリーやコレクションの絞り込みを組み合わせることができます。見つからない場合は条件を一つ解除するか、コレクション全体に戻ってみてください。ダウンロードは公開ライセンスに従って利用できるオリジナル画像を保存します。ギャラリーのプレビューは閲覧向けの小さいファイルです。",
      "Cookie 設定はページ下部にあります。任意のアクセス分析と広告を拒否しても、閲覧やダウンロードは利用できます。評価、コメント、お問い合わせは別の操作で、プライバシーと Cookie のページに記載された必須ストレージとセキュリティ確認を使用します。公開コメントは他の訪問者にも表示され、お問い合わせは専用フォームから送信されます。個人の壁紙以外の目的で利用する前に、ライセンスを確認し、予定する用途についてお問い合わせください。"
    ],
    "feedback": [
      "確認できる具体的な内容をお知らせください",
      "提案や問題が分かる短い件名から始めてください。本文には、該当ページのリンクや壁紙の名前と、期待した結果をご記入ください。特定のファイルについての場合は、パソコン用かスマートフォン用の PNG かをお知らせください。似た色や形の作品がある場合、コレクション名も区別に役立ちます。新しいコレクションのご提案には、テーマ、配色、画面の向きなどをお書きいただけます。",
      "技術的な問題には、ブラウザー、端末の種類、再現する手順を添えてください。閲覧中、ダウンロードを押した後、保存した画像を壁紙に設定したときのどの段階で起きるかをお知らせください。別の向きのファイルを試し、ページに記載された寸法と画面を比べると、トリミング設定の問題か、ファイルやページの問題かを切り分けやすくなります。送信に失敗しても入力したメッセージはフォームに残るので、再度お試しいただけます。",
      "メールアドレスは任意です。メールアプリから連絡したい場合や JavaScript が利用できない場合は、直接メールを送るリンクをご利用ください。お問い合わせのメッセージは、壁紙ページの公開コメントとは異なります。別の用途の許可を求める場合は、プロジェクトを説明し、現行のライセンスを参照してください。任意の Cookie をどのように設定しても、ダウンロードは引き続き利用できます。"
    ]
  },

  ar: {
    "cookies": [
      "مراجعة اختيارك المحفوظ",
      "استخدم إعدادات ملفات تعريف الارتباط في التذييل لمراجعة التحليلات والإعلانات كلًّا على حدة. احفظ الخيارات التي تريدها، ثم أعد فتح النافذة للتحقق من الاختيار الحالي. يؤدي مسح تخزين المتصفح إلى حذف التفضيلات المحفوظة. يظل التصفح وزرّا تنزيل PNG متاحين عند رفض الأغراض الاختيارية. عند تعطيل JavaScript، تعمل روابط التنزيل الأصلية ولا تُشغّل البرامج النصية الاختيارية."
    ],
    "contact": [
      "ما الذي تذكره في رسالتك",
      "إذا كان سؤالك عن خلفية، فأرفق عنوانها أو رابط صفحتها. وإذا كان عن مجموعة، فأرسل رابط المجموعة بدلًا منه. وضّح هل تقصد ملف الكمبيوتر الأفقي أم ملف الهاتف العمودي. يساعد ذلك في التمييز بين نسختين من التصميم نفسه، ويجعل فهم التفصيل المقصود في التكوين أسهل. يمكنك التواصل بالبريد الإلكتروني أو نموذج المراسلة أو روابط التواصل العامة المدرجة في هذه الصفحة.",
      "عند حدوث مشكلة في التنزيل أو العرض، صِف ما توقعته وما حدث فعلًا. أرفق عنوان الصفحة ونوع الجهاز والمتصفح، واذكر هل تظهر المشكلة قبل حفظ ملف PNG أم بعده. تأكد من اختيار الاتجاه المناسب والاحتفاظ باسم الملف الأصلي. قد تحتاج الخلفية التي تبدو مقصوصة في إعدادات النظام إلى خيار ملاءمة مختلف؛ أما تعذّر التنزيل أو الحصول على ملف غير صحيح فمشكلة أخرى. تساعد هذه التفاصيل في إعادة إظهار المشكلة وفهم سببها.",
      "لطلب ترخيص، صِف الاستخدام المقصود والمكان الذي ستظهر فيه الصورة، ووضّح هل ستكون جزءًا من مشروع تجاري. يسمح الترخيص المنشور أصلًا بالاستخدام الشخصي كخلفية وبالاقتصاص لأجهزتك الخاصة. لكنه لا يسمح ببيع حزمة صور أو إعادة توزيعها. إرسال الطلب لا يوسّع نطاق هذا الترخيص. راجع صفحة الترخيص كاملة لمعرفة الشروط الحالية قبل التخطيط لاستخدام آخر. وإذا تعلقت رسالتك ببيانات مخزنة أو تعليق، فحدّد الصفحة المعنية واشرح الإجراء المطلوب."
    ],
    "license": [
      "اختيار ملف للاستخدام الشخصي",
      "تُقدّم النسختان الأفقية والعمودية لأشكال مختلفة من الشاشات. لا يغيّر اختيار نسخة منهما شروط الترخيص. يمكنك الاحتفاظ بملف PNG الأصلي وإنشاء نسخة مقصوصة منفصلة لشاشتك أو هاتفك أو جهازك اللوحي. تساعدك معاينة المعرض الأصغر على اختيار التصميم، بينما يحفظ زر التنزيل الملف الأصلي. قارن الأبعاد المدرجة بأبعاد شاشتك قبل الاقتصاص.",
      "يتيح رابط صفحة خلفية عامة لشخص آخر مشاهدة التصميم وقراءة هذه الشروط. أما إعادة توزيع ملفات الصور كمجموعة فهو إجراء مختلف لا يسمح به ترخيص الاستخدام الشخصي. إذا كنت تحتاج إلى صورة لمنتج أو إعلان أو مشروع تجاري آخر، فاشرح هذا الاستخدام عبر صفحة التواصل. لا تمنح أزرار التنزيل أو صيغة الصورة أو إتاحة الملف إذنًا يتجاوز الشروط المذكورة أعلاه."
    ],
    "terms": [
      "استخدام المعرض العام",
      "تجمع صفحات المجموعات تصاميم تشترك في موضوع بصري. افتح خلفية منفردة لمقارنة اتجاهَيها ومعرفة أبعاد ملف PNG الأصلي. يتيح البحث الجمع بين عبارة وعامل تصفية للفئة أو المجموعة. إذا لم تجد تصميمًا مطابقًا، فأزل عامل تصفية أو عد إلى المجموعة كاملة. يحفظ التنزيل الصورة الأصلية لاستخدامها وفق الترخيص المنشور؛ أما معاينة المعرض فهي ملف أصغر مخصص للتصفح.",
      "تتوفر إعدادات ملفات تعريف الارتباط في التذييل. لا يمنع رفض التحليلات والإعلانات الاختيارية التصفح أو التنزيل. التقييمات والتعليقات والمراسلة إجراءات تفاعلية منفصلة تستخدم التخزين الضروري والفحوص الأمنية الموضّحة في صفحات الخصوصية وملفات تعريف الارتباط. تظهر التعليقات العامة للزوار الآخرين، بينما تُرسل الرسائل عبر نموذج المراسلة. قبل استخدام صورة خارج نطاق الخلفيات الشخصية، اقرأ الترخيص وتواصل معنا مع وصف الاستخدام المقصود."
    ],
    "feedback": [
      "صِف تفصيلًا يمكننا التحقق منه",
      "ابدأ بموضوع قصير يحدّد اقتراحك أو مشكلتك. أرفق في الرسالة رابط الصفحة المعنية أو عنوان الخلفية، واشرح النتيجة التي توقعتها. إذا كنت تقصد ملفًا بعينه، فاذكر هل هو PNG للكمبيوتر أم للهاتف. يساعد اسم المجموعة عندما تتشابه ألوان عدة تصاميم أو أشكالها. ويمكن لاقتراحات المجموعات المستقبلية أن تصف موضوعًا أو لوحة ألوان أو اتجاه شاشة.",
      "للمشكلة التقنية، اذكر المتصفح ونوع الجهاز والخطوات التي تعيد إظهارها. وضّح هل تحدث أثناء التصفح أو بعد النقر على التنزيل أو عند تعيين الصورة المحفوظة كخلفية. يمكنك تجربة الاتجاه الآخر ومقارنة الأبعاد المعروضة في الصفحة بشاشتك. تساعد هذه الفحوص في التمييز بين إعداد الاقتصاص ومشكلة في الملف أو الصفحة. إذا فشل إرسال النموذج، تبقى الرسالة فيه لتتمكن من المحاولة مجددًا.",
      "حقل البريد الإلكتروني اختياري. استخدم رابط البريد المباشر إذا كنت تفضّل الكتابة من تطبيق البريد أو إذا لم يكن JavaScript متاحًا. تختلف رسالة المراسلة عن التعليق العام على الخلفية. ويجب أن تصف أسئلة الأذونات لاستخدام آخر المشروع المقصود وأن تشير إلى الترخيص الحالي. تظل التنزيلات متاحة مهما كانت تفضيلات ملفات تعريف الارتباط الاختيارية."
    ]
  },
} satisfies Record<Locale, Record<'contact' | 'license' | 'terms' | 'feedback' | 'cookies', string[]>>;

export const supportTopics = {
  en: {
    contact: ['Wallpaper or collection', 'Download or display problem', 'Licensing and data requests'],
    license: ['File and screen format', 'Sharing and other uses'],
    terms: ['Finding and downloading', 'Privacy and participation'],
    feedback: ['Suggestion and context', 'Reproducing a problem', 'Email and other requests'],
  },
  ru: {
    contact: ['Обои и коллекции', 'Скачивание и отображение', 'Лицензия и данные'],
    license: ['Файл и пропорции экрана', 'Ссылки и другое использование'],
    terms: ['Поиск и скачивание', 'Приватность и участие'],
    feedback: ['Предложение и контекст', 'Воспроизведение проблемы', 'Email и другие вопросы'],
  },
  'zh-cn': {
    contact: ['壁纸与系列', '下载与显示问题', '许可与数据请求'],
    license: ['文件与屏幕比例', '分享链接与其他用途'],
    terms: ['查找与下载', '隐私与互动'],
    feedback: ['建议与背景', '复现问题', '邮件与其他请求'],
  },
  'pt-br': {
    contact: ['Papel de parede e coleção', 'Download e exibição', 'Licença e solicitações sobre dados'],
    license: ['Arquivo e formato da tela', 'Compartilhamento e outros usos'],
    terms: ['Busca e download', 'Privacidade e participação'],
    feedback: ['Sugestão e contexto', 'Como reproduzir o problema', 'Email e outras solicitações'],
  },
  ja: {
    "contact": [
      "壁紙とコレクション",
      "ダウンロードと表示の問題",
      "ライセンスとデータに関するお問い合わせ"
    ],
    "license": [
      "ファイルと画面の比率",
      "リンクの共有とその他の用途"
    ],
    "terms": [
      "検索とダウンロード",
      "プライバシーと参加"
    ],
    "feedback": [
      "提案と背景情報",
      "問題の再現手順",
      "メールとその他のご相談"
    ]
  },

  ar: {
    "contact": [
      "خلفية أو مجموعة",
      "مشكلة في التنزيل أو العرض",
      "طلبات الترخيص والبيانات"
    ],
    "license": [
      "الملف ومقاس الشاشة",
      "المشاركة والاستخدامات الأخرى"
    ],
    "terms": [
      "البحث والتنزيل",
      "الخصوصية والمشاركة"
    ],
    "feedback": [
      "الفكرة والسياق",
      "إعادة إظهار المشكلة",
      "البريد والطلبات الأخرى"
    ]
  },
} satisfies Record<Locale, Record<Exclude<keyof typeof supportCopy.en, 'cookies'>, string[]>>;
