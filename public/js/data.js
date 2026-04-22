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
  { text: "Твоє відео залетіло в тренди YouTube! Монетизація принесла +i₴2000.", action: "receive", val: 2000 },
  { text: "Знайшов у зимовій куртці стару заначку. Дрібниця, а приємно: +i₴500.", action: "receive", val: 500 },
  { text: "Виграв суд у податкової. Тобі компенсують i₴1500 моральної шкоди.", action: "receive", val: 1500 },
  { text: "Вдало продав крипту на самих хаях. Забирай прибуток +i₴1000.", action: "receive", val: 1000 },
  { text: "Підписники задонатили на новий мікрофон на стрімі. +i₴800.", action: "receive", val: 800 },
  { text: "Бабуся прислала передачку і трохи грошей. +i₴300 на смаколики.", action: "receive", val: 300 },
  { text: "Забув пароль від криптогаманця. Згоріло i₴1000.", action: "pay", val: 1000 },
  { text: "Спіймав вірус, качаючи піратську гру. Ремонт ПК: -i₴800.", action: "pay", val: 800 },
  { text: "Замовив товар в інтернеті, а прийшла цеглина. Мінус i₴500.", action: "pay", val: 500 },
  { text: "Сусід зверху затопив твою квартиру. Ремонт обійдеться у i₴1500.", action: "pay", val: 1500 },
  { text: "Пробив колесо на ямі біля Екватора. Шиномонтаж: -i₴400.", action: "pay", val: 400 },
  { text: "Забув закрити підписку на сервіс, яким не користуєшся. Списало -i₴300.", action: "pay", val: 300 },
  { text: "Зник інтернет під час важливої катки! Ти в шоці. Пропусти 1 хід.", action: "skip-turn", val: 1 },
  { text: "Тебе спалили на використанні чітів. Прямуй прямо в Божкове!", action: "goto", val: 10 },
  { text: "Взяв електросамокат напрокат, а він поїхав у зворотний бік. Наступного ходу йдеш назад.", action: "reverse-move", val: 1 },
  { text: "Почув про шалені знижки в ТРЦ Київ. Негайно переходь туди!", action: "goto", val: 19 },
  { text: "НАБУ прийшло з обшуками. Сплати по i₴200 за кожну свою ділянку.", action: "nabu-tax", val: 200 },
  { text: "У тебе День Народження! Всі гравці дарують тобі по i₴300.", action: "birthday", val: 300 }
];

// === КАРТКИ НОВИН ===
const newsCards = [
  { text: "День міста! Міська рада гуляє: всі гравці отримують по i₴1000 з бюджету.", action: "global-receive", val: 1000 },
  { text: "Чорна п'ятниця! Шалені черги. Власники всіх ТРЦ (Помаранчеві) отримують по +i₴1000 на кожну ділянку.", action: "target-receive", group: "orange", val: 1000 },
  { text: "Дефіцит пального! Ціни злетіли. Всі гравці платять власникам АЗС по i₴300.", action: "pay-owners", group: "station", val: 300 },
  { text: "Хайп на бренди. Всі різко захотіли новий одяг. Власники магазинів (Рожеві) отримують +i₴800 за точку.", action: "target-receive", group: "pink", val: 800 },
  { text: "Екологічна комісія. Штраф за забруднення! Власники комуналок (Обленерго/Водоканал) платять -i₴1000.", action: "target-pay", group: "utility", val: 1000 },
  { text: "Криза нерухомості. Податок на розкіш! Усі платять: -i₴250 за кожен дім та -i₴1000 за готель.", action: "house-tax", house: 250, hotel: 1000 },
  { text: "Глобальний збій. Термінали не працюють! Усі гравці втрачають по i₴500.", action: "global-pay", val: 500 }
];

// === ТЕРМІНОВІ НОВИНИ ===
const urgentNews = [
  { text: "БЛИСКАВКА! Палій повернувся до Полтави! Усі ховають авто: кожен платить -i₴800.", action: "global-pay", val: 800 },
  { text: "БЛИСКАВКА! Знайдено скарб Мазепи! Усі гравці отримують по i₴2000!", action: "global-receive", val: 2000 }
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
