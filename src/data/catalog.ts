export const locales = ['en', 'ru', 'zh-cn', 'pt-br'] as const;
export type Locale = (typeof locales)[number];
export type Localized = Record<Locale, string>;
const t = (en: string, ru: string, zh: string, pt: string): Localized => ({ en, ru, 'zh-cn': zh, 'pt-br': pt });

export type Collection = { id: string; slug: string; count: number; title: Localized; description: Localized };
const seedCollections: Collection[] = [
  {
    id: '0001-contours-of-silence', slug: 'contours-of-silence', count: 15,
    title: t('Contours of Silence', 'Контуры тишины', '寂静的轮廓', 'Contornos do silêncio'),
    description: t('Blue and violet forms emerge from the dark: dunes, glass, water and distant light.', 'Синие и фиолетовые формы возникают из темноты: дюны, стекло, вода и далёкий свет.', '蓝紫色形态从黑暗中浮现：沙丘、玻璃、水面与远方的微光。', 'Formas azuis e violetas surgem no escuro: dunas, vidro, água e luz distante.'),
  },
  {
    id: '0002-woven-spectrum', slug: 'woven-spectrum', count: 5,
    title: t('Woven Spectrum', 'Сплетённый спектр', '交织光谱', 'Espectro entrelaçado'),
    description: t('Bright strands of colour twist, fold and meet against deep red and black.', 'Яркие цветовые нити переплетаются на фоне глубокого красного и чёрного.', '明亮的彩色丝带在深红与黑色背景中交织、翻转、汇聚。', 'Fios de cor se cruzam e se dobram sobre vermelho profundo e preto.'),
  },
  {
    id: '0003-path-to-the-light', slug: 'path-to-the-light', count: 5,
    title: t('Path to the Light', 'Путь к свету', '通往光之路', 'Caminho para a luz'),
    description: t('Five quiet journeys towards a golden circle through cities, mountains, forests and ruins.', 'Пять тихих путешествий к золотому кругу через города, горы, леса и руины.', '五段通往金色光环的静谧旅程，穿过城市、群山、森林与遗迹。', 'Cinco jornadas serenas rumo a um círculo dourado, entre cidades, montanhas, florestas e ruínas.'),
  },
];

export const categoryLabels = {
  abstract: t('Abstract', 'Абстракция', '抽象', 'Abstrato'),
  landscape: t('Landscape', 'Пейзаж', '风景', 'Paisagem'),
  fantasy: t('Fantasy', 'Фэнтези', '奇幻', 'Fantasia'),
  space: t('Space', 'Космос', '宇宙', 'Espaço'),
  nature: t('Nature', 'Природа', '自然', 'Natureza'),
} as const;
export type Category = keyof typeof categoryLabels;

export const tagLabels = {
  violet: t('violet', 'фиолетовый', '紫色', 'violeta'),
  blue: t('blue', 'синий', '蓝色', 'azul'),
  night: t('night', 'ночь', '夜晚', 'noite'),
  dunes: t('dunes', 'дюны', '沙丘', 'dunas'),
  glass: t('glass', 'стекло', '玻璃', 'vidro'),
  light: t('light', 'свет', '光', 'luz'),
  stone: t('stone', 'камень', '石头', 'pedra'),
  water: t('water', 'вода', '水', 'água'),
  smoke: t('smoke', 'дым', '烟雾', 'fumaça'),
  crystal: t('crystal', 'кристалл', '水晶', 'cristal'),
  forest: t('forest', 'лес', '森林', 'floresta'),
  planet: t('planet', 'планета', '行星', 'planeta'),
  colour: t('colour', 'цвет', '色彩', 'cor'),
  ribbon: t('ribbon', 'лента', '丝带', 'fita'),
  motion: t('motion', 'движение', '动态', 'movimento'),
  city: t('city', 'город', '城市', 'cidade'),
  portal: t('portal', 'портал', '传送门', 'portal'),
  mountains: t('mountains', 'горы', '群山', 'montanhas'),
  sun: t('sun', 'солнце', '太阳', 'sol'),
  journey: t('journey', 'путешествие', '旅程', 'jornada'),
} as const;
export type Tag = keyof typeof tagLabels;

type Entry = {
  collection: string; number: number; category: Category; tags: Tag[];
  title: Localized; description: Localized;
};
export type Wallpaper = Entry & { id: string; collectionId: string; slug: string; s3Folder: string; fileStem: string };

const entries: Entry[] = [
  { collection: 'contours-of-silence', number: 1, category: 'landscape', tags: ['violet', 'night', 'dunes'],
    title: t('Violet Horizon', 'Фиолетовый горизонт', '紫色地平线', 'Horizonte violeta'),
    description: t('Dark dunes with a thin violet glow under a star-filled sky.', 'Тёмные дюны с тонким фиолетовым свечением под звёздным небом.', '星空下，深色沙丘的边缘泛着细细的紫光。', 'Dunas escuras com um fino brilho violeta sob um céu estrelado.') },
  { collection: 'contours-of-silence', number: 2, category: 'landscape', tags: ['violet', 'light', 'dunes'],
    title: t('Edge of Quiet', 'Край тишины', '静谧边缘', 'Limite do silêncio'),
    description: t('A single luminous ridge cuts diagonally through a dark dune.', 'Светящийся гребень по диагонали рассекает тёмную дюну.', '一道发光的山脊斜穿深色沙丘。', 'Uma crista luminosa corta uma duna escura na diagonal.') },
  { collection: 'contours-of-silence', number: 3, category: 'abstract', tags: ['blue', 'glass', 'light'],
    title: t('Glass Current', 'Стеклянное течение', '玻璃流线', 'Corrente de vidro'),
    description: t('Translucent blue folds float against an almost black background.', 'Полупрозрачные синие складки парят на почти чёрном фоне.', '半透明的蓝色褶皱漂浮在近乎黑色的背景前。', 'Dobras azuis translúcidas flutuam sobre um fundo quase preto.') },
  { collection: 'contours-of-silence', number: 4, category: 'abstract', tags: ['blue', 'glass', 'violet'],
    title: t('Folded Light', 'Сложенный свет', '折叠的光', 'Luz dobrada'),
    description: t('Sharp metallic folds catch blue and violet light in the dark.', 'Острые металлические складки ловят синий и фиолетовый свет в темноте.', '锋利的金属褶面在暗处映出蓝紫色光芒。', 'Dobras metálicas nítidas refletem luz azul e violeta no escuro.') },
  { collection: 'contours-of-silence', number: 5, category: 'fantasy', tags: ['stone', 'portal', 'night'],
    title: t('The Quiet Gate', 'Тихие врата', '静默之门', 'Portal silencioso'),
    description: t('A weathered stone arch holds a deep blue glow beneath the night sky.', 'Каменная арка хранит глубокое синее свечение под ночным небом.', '夜空下，古老石拱门中透出深蓝色的光。', 'Um arco de pedra guarda um brilho azul intenso sob o céu noturno.') },
  { collection: 'contours-of-silence', number: 6, category: 'abstract', tags: ['violet', 'blue', 'ribbon'],
    title: t('Midnight Ribbon', 'Полуночная лента', '午夜丝带', 'Fita da meia-noite'),
    description: t('A luminous blue-violet ribbon twists across a field of black.', 'Светящаяся сине-фиолетовая лента извивается на чёрном фоне.', '发光的蓝紫色丝带在黑色画面中蜿蜒。', 'Uma fita azul-violeta luminosa serpenteia sobre o preto.') },
  { collection: 'contours-of-silence', number: 7, category: 'abstract', tags: ['violet', 'smoke', 'motion'],
    title: t('Violet Cloud', 'Фиолетовое облако', '紫色烟云', 'Nuvem violeta'),
    description: t('Soft plumes of purple smoke gather and dissolve in the dark.', 'Мягкие клубы фиолетового дыма собираются и растворяются в темноте.', '柔软的紫色烟雾在黑暗中聚拢又散开。', 'Plumas suaves de fumaça roxa se formam e se dispersam no escuro.') },
  { collection: 'contours-of-silence', number: 8, category: 'landscape', tags: ['blue', 'water', 'night'],
    title: t('After the Wave', 'После волны', '浪潮之后', 'Depois da onda'),
    description: t('A low ocean wave catches electric blue light beneath a dark horizon.', 'Невысокая океанская волна ловит электрический синий свет под тёмным горизонтом.', '暗色地平线下，低低的海浪映出电蓝色光芒。', 'Uma onda baixa reflete luz azul elétrica sob um horizonte escuro.') },
  { collection: 'contours-of-silence', number: 9, category: 'abstract', tags: ['crystal', 'violet', 'light'],
    title: t('Suspended Crystal', 'Парящий кристалл', '悬浮水晶', 'Cristal suspenso'),
    description: t('A dark faceted crystal floats above a small pool of blue light.', 'Тёмный гранёный кристалл парит над небольшим пятном синего света.', '深色多面水晶悬浮在一小片蓝光之上。', 'Um cristal escuro e facetado flutua sobre uma pequena poça de luz azul.') },
  { collection: 'contours-of-silence', number: 10, category: 'landscape', tags: ['violet', 'light', 'night'],
    title: t('Lightfall', 'Падение света', '光之垂落', 'Queda de luz'),
    description: t('Vertical blue and violet light falls into a quiet nocturnal landscape.', 'Вертикальные потоки синего и фиолетового света падают на ночной пейзаж.', '蓝紫色光束垂落在静谧的夜色风景中。', 'Feixes verticais de luz azul e violeta caem sobre uma paisagem noturna.') },
  { collection: 'contours-of-silence', number: 11, category: 'nature', tags: ['forest', 'violet', 'night'],
    title: t('Tree of the Night', 'Ночное дерево', '夜之树', 'Árvore da noite'),
    description: t('An old tree stands in a violet-lit forest beneath a deep blue sky.', 'Старое дерево стоит в лесу с фиолетовой подсветкой под тёмно-синим небом.', '深蓝天空下，一棵古树立于紫光笼罩的森林。', 'Uma árvore antiga se ergue numa floresta violeta sob o céu azul escuro.') },
  { collection: 'contours-of-silence', number: 12, category: 'landscape', tags: ['blue', 'stone', 'light'],
    title: t('Blue Fault', 'Синий разлом', '蓝色裂隙', 'Fenda azul'),
    description: t('A glowing blue fissure runs across a dark rocky surface.', 'Светящийся синий разлом проходит через тёмную каменную поверхность.', '一道发光的蓝色裂隙穿过深色岩面。', 'Uma fenda azul luminosa atravessa uma superfície rochosa escura.') },
  { collection: 'contours-of-silence', number: 13, category: 'abstract', tags: ['glass', 'blue', 'light'],
    title: t('Transparent Planes', 'Прозрачные плоскости', '透明平面', 'Planos transparentes'),
    description: t('Geometric glass planes intersect with thin electric blue edges.', 'Геометрические стеклянные плоскости пересекаются тонкими электрически-синими гранями.', '几何玻璃平面交错，边缘闪着细细的电蓝色光。', 'Planos geométricos de vidro se cruzam com bordas finas de azul elétrico.') },
  { collection: 'contours-of-silence', number: 14, category: 'space', tags: ['planet', 'blue', 'night'],
    title: t('Distant Crescent', 'Далёкий полумесяц', '遥远的弧光', 'Crescente distante'),
    description: t('A narrow blue crescent reveals a distant planet in near-total darkness.', 'Узкий синий серп открывает далёкую планету в почти полной темноте.', '近乎全黑的画面中，一道细蓝弧勾勒出遥远的行星。', 'Um fino crescente azul revela um planeta distante na escuridão.') },
  { collection: 'contours-of-silence', number: 15, category: 'nature', tags: ['blue', 'forest', 'night'],
    title: t('Night Garden', 'Ночной сад', '夜色花园', 'Jardim noturno'),
    description: t('Leaves and flowers emerge from darkness in a faint blue-violet glow.', 'Листья и цветы проступают из темноты в слабом сине-фиолетовом свечении.', '树叶与花朵在微弱的蓝紫色光中从黑暗里显现。', 'Folhas e flores surgem do escuro sob um suave brilho azul-violeta.') },
  { collection: 'woven-spectrum', number: 1, category: 'abstract', tags: ['colour', 'ribbon', 'motion'],
    title: t('Colour in Motion', 'Цвет в движении', '流动的色彩', 'Cor em movimento'),
    description: t('Orange, pink and blue strands flow in broad waves over dark red.', 'Оранжевые, розовые и синие нити текут широкими волнами по тёмно-красному фону.', '橙、粉、蓝色线条在深红背景上汇成宽阔波浪。', 'Fios laranja, rosa e azul fluem em ondas largas sobre vermelho escuro.') },
  { collection: 'woven-spectrum', number: 2, category: 'abstract', tags: ['colour', 'ribbon', 'motion'],
    title: t('Between the Strands', 'Между нитями', '色带之间', 'Entre os fios'),
    description: t('Curved bands of warm and cool colour frame a calm, dark centre.', 'Изогнутые полосы тёплых и холодных цветов обрамляют спокойный тёмный центр.', '冷暖色弧形丝带围出一片安静的深色中心。', 'Faixas curvas de cores quentes e frias cercam um centro escuro e calmo.') },
  { collection: 'woven-spectrum', number: 3, category: 'abstract', tags: ['colour', 'ribbon', 'motion'],
    title: t('Spectrum Spiral', 'Спираль спектра', '光谱旋涡', 'Espiral do espectro'),
    description: t('Bright ribbons wind into a vivid spiral of orange, blue and magenta.', 'Яркие ленты закручиваются в спираль оранжевого, синего и пурпурного.', '明亮丝带卷成橙、蓝、洋红交织的旋涡。', 'Fitas brilhantes giram numa espiral de laranja, azul e magenta.') },
  { collection: 'woven-spectrum', number: 4, category: 'abstract', tags: ['colour', 'light', 'motion'],
    title: t('Colour Rays', 'Цветовые лучи', '色彩射线', 'Raios de cor'),
    description: t('Fans of luminous colour spread from a single point across the frame.', 'Веера светящихся цветов расходятся из одной точки по всему кадру.', '发光的色带从画面一角向外扇形展开。', 'Leques de cores luminosas se abrem a partir de um único ponto.') },
  { collection: 'woven-spectrum', number: 5, category: 'abstract', tags: ['colour', 'ribbon', 'motion'],
    title: t('Endless Loop', 'Бесконечная петля', '无尽之环', 'Laço sem fim'),
    description: t('A bright multicolour loop floats over a deep crimson background.', 'Яркая многоцветная петля парит на фоне глубокого багряного цвета.', '明亮的多彩圆环悬浮在深红色背景前。', 'Um laço multicolorido flutua sobre um fundo carmesim profundo.') },
  { collection: 'path-to-the-light', number: 1, category: 'fantasy', tags: ['city', 'sun', 'journey'],
    title: t('City of the Golden Ring', 'Город золотого кольца', '金环之城', 'Cidade do anel dourado'),
    description: t('A lone traveller crosses a wide bridge toward a glowing ring above a fantasy city.', 'Одинокая путница идёт по широкому мосту к сияющему кольцу над фантастическим городом.', '独行者走过宽阔长桥，前往奇幻城市上空的金色光环。', 'Uma viajante cruza uma ponte rumo ao anel luminoso sobre uma cidade fantástica.') },
  { collection: 'path-to-the-light', number: 2, category: 'fantasy', tags: ['light', 'journey', 'portal'],
    title: t('Bridge to Dawn', 'Мост к рассвету', '通往黎明的桥', 'Ponte para o amanhecer'),
    description: t('A solitary figure follows a lit bridge to a vast golden circle at dusk.', 'Одинокая фигура идёт по освещённому мосту к огромному золотому кругу в сумерках.', '黄昏中，孤身一人沿着灯光长桥走向巨大的金色圆环。', 'Uma figura solitária segue uma ponte iluminada até um grande círculo dourado.') },
  { collection: 'path-to-the-light', number: 3, category: 'landscape', tags: ['mountains', 'water', 'sun'],
    title: t('Still Water, Distant Light', 'Тихая вода, далёкий свет', '静水远光', 'Água calma, luz distante'),
    description: t('A luminous ring rests between purple mountains and reflects in a still lake.', 'Сияющее кольцо висит между фиолетовыми горами и отражается в спокойном озере.', '明亮的圆环悬于紫色群山之间，倒映在平静的湖面。', 'Um anel luminoso repousa entre montanhas roxas e se reflete no lago calmo.') },
  { collection: 'path-to-the-light', number: 4, category: 'fantasy', tags: ['forest', 'water', 'journey'],
    title: t('Forest of the Ring', 'Лес светового кольца', '光环森林', 'Floresta do anel'),
    description: t('A traveller follows a golden stream through dark trees towards a bright circle.', 'Путница идёт вдоль золотого ручья сквозь тёмные деревья к яркому кругу.', '旅人沿着金色溪流穿过暗林，走向明亮的圆环。', 'Uma viajante segue um riacho dourado pela floresta escura até um círculo brilhante.') },
  { collection: 'path-to-the-light', number: 5, category: 'fantasy', tags: ['stone', 'portal', 'journey'],
    title: t('The Last Gate', 'Последние врата', '最后之门', 'O último portal'),
    description: t('A golden ring glows inside ancient ruins at the top of a stone staircase.', 'Золотое кольцо сияет среди древних руин на вершине каменной лестницы.', '石阶尽头的古老遗迹中，金色圆环熠熠发光。', 'Um anel dourado brilha entre ruínas antigas no topo de uma escadaria de pedra.') },
];

const seedWallpapers: Wallpaper[] = entries.map((entry) => {
  const collection = seedCollections.find((item) => item.slug === entry.collection)!;
  return {
    ...entry,
    id: `${entry.collection}-${entry.number}`,
    collectionId: collection.id,
    slug: `${entry.collection}-${entry.number}`,
    s3Folder: collection.id,
    fileStem: entry.collection,
  };
});

let snapshot: { collections: Collection[]; wallpapers: Wallpaper[] } | undefined;
try {
  const { readFileSync } = await import('node:fs');
  snapshot = JSON.parse(readFileSync(new URL('./catalog-live.json', import.meta.url), 'utf8'));
  if (!snapshot || snapshot.collections.length === 0 || snapshot.wallpapers.length === 0) throw new Error('Empty catalogue');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
export const collections = snapshot?.collections ?? seedCollections;
export const wallpapers = snapshot?.wallpapers ?? seedWallpapers;
export const initialCatalog = { collections: seedCollections, wallpapers: seedWallpapers };
export const getCollection = (slug: string) => collections.find((item) => item.slug === slug);
export const getWallpaper = (slug: string) => wallpapers.find((item) => item.slug === slug);
export const getCollectionWallpapers = (slug: string) => wallpapers.filter((item) => item.collection === slug);
export const s3Url = (wallpaper: Wallpaper, variant: 'desktop' | 'mobile') =>
  `https://s3.twcstorage.ru/wallpapers/assets/collections/${wallpaper.s3Folder}/${wallpaper.fileStem}-${wallpaper.number}-${variant}.png`;
export const previewUrl = (wallpaper: Wallpaper, variant: 'desktop' | 'mobile') =>
  `/previews/${wallpaper.slug}-${variant}.webp`;
export const downloadUrl = (wallpaper: Wallpaper, variant: 'desktop' | 'mobile') =>
  `/downloads/${wallpaper.slug}-${variant}.png`;
