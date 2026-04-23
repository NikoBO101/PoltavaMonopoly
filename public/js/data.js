// === ДАНІ ІГРОВОГО ПОЛЯ (40 клітинок) ===
const mapData = [
  { name: "СТАРТ", type: "corner" },
  { name: "Кулиничі", emoji: "🥐", type: "property", group: "brown", price: 600, baseRent: 60, housePrice: 500 },
  { name: "НОВИНИ", emoji: "📰", type: "news" },
  { name: "Шаурма", emoji: "🌯", type: "property", group: "brown", price: 600, baseRent: 80, housePrice: 500 },
  { name: "Податок", emoji: "💸", type: "tax", amount: 2000 },
  { name: "БРСМ", emoji: "⛽", type: "station", group: "station", price: 1500, baseRent: 150 }, 
  { name: "Парк Перемоги", emoji: "🌲", type: "property", group: "lightblue", price: 1000, baseRent: 100, housePrice: 500 },
  { name: "ШАНС", emoji: "🎁", type: "chance" },
  { name: "Біла Альтанка", emoji: "🏛️", type: "property", group: "lightblue", price: 1000, baseRent: 100, housePrice: 500 },
  { name: "Корпусний Парк", emoji: "🦅", type: "property", group: "lightblue", price: 1200, baseRent: 120, housePrice: 500 },
  { name: "Божківська<br>Колонія", type: "corner" }, 
  { name: "Сінсей", emoji: "👗", type: "property", group: "pink", price: 1400, baseRent: 140, housePrice: 1000 },
  { name: "Обленерго", emoji: "⚡", type: "utility", price: 1500 },
  { name: "LC Waikiki", emoji: "👕", type: "property", group: "pink", price: 1400, baseRent: 140, housePrice: 1000 },
  { name: "GOLDI", emoji: "👚", type: "property", group: "pink", price: 1600, baseRent: 160, housePrice: 1000 },
  { name: "Автотранс", emoji: "⛽", type: "station", group: "station", price: 2000, baseRent: 200 }, 
  { name: "ТРЦ Екватор", emoji: "🛍️", type: "property", group: "orange", price: 1800, baseRent: 180, housePrice: 1000 },
  { name: "НОВИНИ", emoji: "📰", type: "news" },
  { name: "Конкорд", emoji: "🛍️", type: "property", group: "orange", price: 1800, baseRent: 180, housePrice: 1000 },
  { name: "ТРЦ Київ", emoji: "🛍️", type: "property", group: "orange", price: 2000, baseRent: 200, housePrice: 1000 },
  { name: "ПАРКОВКА", type: "corner" }, 
  { name: "Подільський р-н", emoji: "🏙️", type: "property", group: "red", price: 2200, baseRent: 220, housePrice: 1500 },
  { name: "ШАНС", emoji: "🎁", type: "chance" },
  { name: "Київський р-н", emoji: "🏙️", type: "property", group: "red", price: 2200, baseRent: 220, housePrice: 1500 },
  { name: "Алмазний р-н", emoji: "🏙️", type: "property", group: "red", price: 2400, baseRent: 240, housePrice: 1500 },
  { name: "BVS", emoji: "⛽", type: "station", group: "station", price: 2000, baseRent: 200 },
  { name: "Укрпошта", emoji: "🐌", type: "property", group: "yellow", price: 2600, baseRent: 260, housePrice: 1500 },
  { name: "Meest Express", emoji: "📦", type: "property", group: "yellow", price: 2600, baseRent: 260, housePrice: 1500 },
  { name: "Водоканал", emoji: "🚰", type: "utility", price: 1500 },
  { name: "Нова Пошта", emoji: "🚀", type: "property", group: "yellow", price: 2800, baseRent: 280, housePrice: 1500 },
  { name: "Йди у<br>Божкове!", type: "corner" }, 
  { name: "АТБ", emoji: "🛒", type: "property", group: "green", price: 3000, baseRent: 300, housePrice: 2000 },
  { name: "Маркетопт", emoji: "🛒", type: "property", group: "green", price: 3000, baseRent: 300, housePrice: 2000 },
  { name: "НОВИНИ", emoji: "📰", type: "news" },
  { name: "Чудо Маркет", emoji: "🛒", type: "property", group: "green", price: 3200, baseRent: 320, housePrice: 2000 },
  { name: "ОККО", emoji: "⛽", type: "station", group: "station", price: 2500, baseRent: 250 }, 
  { name: "ШАНС", emoji: "🎁", type: "chance" },
  { name: "Театральна", emoji: "🎭", type: "property", group: "blue", price: 3500, baseRent: 350, housePrice: 2000 },
  { name: "Податок", emoji: "💸", type: "tax", amount: 1000 },
  { name: "Козловщина", emoji: "🏰", type: "property", group: "blue", price: 4000, baseRent: 400, housePrice: 2000 }
];

// === КАРТКИ ШАНСУ ===
const chanceCards = [
    { text: "Кум з міськради підігнав вигідний тендер. Отримай i₴2000.", action: "receive", val: 2000 },
    { text: "Зловив величезну яму на Леваді. Ремонт підвіски: -i₴1000.", action: "pay", val: 1000 },
    { text: "Твою шаурму біля 'Злато Місто' визнали найкращою в місті! +i₴1500.", action: "receive", val: 1500 },
    { text: "Податкова нагрянула з перевіркою. Довелося 'порєшать': -i₴2000.", action: "pay", val: 2000 },
    { text: "Безкоштовний проїзд у 'Кільцевому'! Ти проспав свою зупинку. Пропусти хід.", action: "skip-turn", val: 1 },
    { text: "На городі в Розсошенцях відкопав скарб гетьмана Мазепи! +i₴5000.", action: "receive", val: 5000 },
    { text: "П'яний дебош у 'Конкорді'. Поліція виписала штраф: -i₴1500.", action: "pay", val: 1500 },
    { text: "Квиток на концерт Олега Винника. Йди одразу на клітинку 'Колонія' (за поганий смак).", action: "goto", val: 10 },
    { text: "Бабуся передала торбу з села. Економія на продуктах: +i₴500.", action: "receive", val: 500 },
    { text: "Купив лотерею 'Забава' на зупинці Корпусний Парк і виграв! +i₴3000.", action: "receive", val: 3000 }
];

const chanceCards = [
    { text: "Кум з міськради підігнав вигідний тендер. Отримай i₴2000.", action: "receive", val: 2000 },
    { text: "Зловив величезну яму на Леваді. Ремонт підвіски: -i₴1000.", action: "pay", val: 1000 },
    { text: "Твою шаурму біля 'Злато Місто' визнали найкращою в місті! +i₴1500.", action: "receive", val: 1500 },
    { text: "Податкова нагрянула з перевіркою. Довелося 'порєшать': -i₴2000.", action: "pay", val: 2000 },
    { text: "Безкоштовний проїзд у 'Кільцевому'! Ти проспав свою зупинку. Пропусти хід.", action: "skip-turn", val: 1 },
    { text: "На городі в Розсошенцях відкопав скарб гетьмана Мазепи! +i₴5000.", action: "receive", val: 5000 },
    { text: "П'яний дебош у 'Конкорді'. Поліція виписала штраф: -i₴1500.", action: "pay", val: 1500 },
    { text: "Квиток на концерт Олега Винника. Йди одразу на клітинку 'Колонія' (за поганий смак).", action: "goto", val: 10 },
    { text: "Бабуся передала торбу з села. Економія на продуктах: +i₴500.", action: "receive", val: 500 },
    { text: "Купив лотерею 'Забава' на зупинці Корпусний Парк і виграв! +i₴3000.", action: "receive", val: 3000 },
    { text: "Застряг у заторі на Зигіна через ремонт дороги. Пропускаєш хід.", action: "skip-turn", val: 1 },
    { text: "Вдало продав старі речі на Речовому ринку. Гроші в касу: +i₴1200.", action: "receive", val: 1200 },
    { text: "Вирішив відпочити на Ворсклі, але загубив ключі від машини. Відновлення: -i₴800.", action: "pay", val: 800 },
    { text: "Виграв чемпіонат зі швидкісного поїдання полтавських галушок! Приз: +i₴2500.", action: "receive", val: 2500 },
    { text: "Сів не в ту маршрутку і поїхав на Огнівку замість Центру. Назад на 4 клітинки.", action: "reverse-move", val: 4 }
];

const newsCards = [
    { text: "Крипта впала! Всі акції згоріли (жарт). Просто заплати за інтернет i₴500.", action: "pay", val: 500 },
    { text: "Ревізор у Полтаві! Всі ховаються. Ти пропускаєш хід.", action: "skip-turn", val: 1 },
    { text: "Знайшов чужий гаманець у Білій Альтанці. Совість мовчить. +i₴1000.", action: "receive", val: 1000 },
    { text: "Ти став гордим спонсором ФК 'Ворскла'. Мінус i₴3000 з бюджету.", action: "pay", val: 3000 },
    { text: "Ти вчасно подзвонив Куму. Наступна оренда для тебе БЕЗКОШТОВНА!", action: "kum", val: 0 },
    { text: "Забув вимкнути праску. Повернувся додому (назад на 3 клітинки).", action: "reverse-move", val: 3 },
    { text: "Продав старий гараж на Мотелі. Отримай i₴2500.", action: "receive", val: 2500 },
    { text: "Пробив колесо на бруківці в центрі. Шиномонтаж коштує -i₴600.", action: "pay", val: 600 },
    { text: "Твій ТікТок про Полтаву залетів у рекомендації! Монетизація: +i₴2000.", action: "receive", val: 2000 },
    { text: "Спіймали на малюванні графіті біля театру Гоголя. Прямуй до Колонії.", action: "goto", val: 10 },
    { text: "Сусід зверху затопив твою квартиру. Ремонт обійдеться в -i₴1500.", action: "pay", val: 1500 },
    { text: "Кум став депутатом міськради! Він відмаже тебе від наступної оренди.", action: "kum", val: 0 }
];

const urgentNews = [
    { text: "🚨 Сильна злива затопила Поділ! Твоя машина плаває. Евакуатор і ремонт: -i₴3000.", action: "pay", val: 3000 },
    { text: "🚨 Відключення світла на 12 годин! Довелося купувати генератор: -i₴4000.", action: "pay", val: 4000 },
    { text: "🚨 Гуманітарка під'їхала! Тобі перепало i₴3000 від європейського фонду.", action: "receive", val: 3000 },
    { text: "🚨 Інфляція б'є рекорди! Витрати на життя стрімко зросли: -i₴2500.", action: "pay", val: 2500 },
    { text: "🚨 Грант від ЄС на розвиток малого бізнесу в Полтаві! Твій рахунок поповнено: +i₴5000.", action: "receive", val: 5000 },
    { text: "🚨 У місті затори через марафон! Рух паралізовано. Пропусти хід.", action: "skip-turn", val: 1 }
];

// === СИСТЕМНІ ПОВІДОМЛЕННЯ ЧАТУ ===
const buyMsgs = [
  "тишком-нишком приватизував",
  "тепер офіційно кришує",
  "на всі гроші викупив",
  "став мажором і придбав",
  "оформив на тещу",
  "виграв у карти права на",
  "інвестував останні копійки в",
  "з ноги відкрив двері і купив",
  "заніс хабар і забрав собі",
  "тепер монополіст на районі, бо купив"
];

const rentMsgs = [
  "зі сльозами на очах платить оренду гравцю",
  "віддає останні труси за оренду гравцю",
  "з болем у серці переказує гроші на банку гравцю",
  "тихо матюкається і платить гравцю",
  "стає біднішим, бо заніс гроші гравцю",
  "проклинає капіталізм і віддає готівку гравцю",
  "відкриває скарбничку, щоб заплатити гравцю",
  "плаче, колеться, але платить гравцю"
];

// === КОЛЬОРИ РАЙОНІВ ===
const colors = { 
  brown: '#8b4513', 
  lightblue: '#87ceeb', 
  pink: '#ff69b4', 
  orange: '#f97316', 
  red: '#ef4444', 
  yellow: '#facc15', 
  green: '#10b981', 
  blue: '#3b82f6', 
  station: '#475569', 
  utility: '#64748b', 
  none: 'transparent' 
};
