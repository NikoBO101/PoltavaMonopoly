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

const chanceCards = [
  {text:"НАБУ почало перевірку! Сплати по i₴250 за кожну свою ділянку.",action:"nabu-tax",val:250},
  {text:"Зробив крутий відос для NikAndLos! Отримай i₴2500.",action:"receive",val:2500},
  {text:"У тебе День Народження! Всі гравці дарують тобі по i₴300.",action:"birthday",val:300},
  {text:"ТЦК на блокпосту! Пропусти 1 хід.",action:"skip-turn",val:1, msg: "спілкується з ТЦК"},
  {text:"Поїв шаурми і отруївся. Пропусти 1 хід.",action:"skip-turn",val:1, msg: "обіймається з білим другом"},
  {text:"Забув гаманець! Наступний хід ти йдеш у зворотному напрямку.",action:"reverse-move",val:1},
  {text:"Влетів у яму на Зіньківській. Плати i₴300 за ремонт.",action:"pay",val:300},
  {text:"Підрізав Лексус на кільці! Штраф i₴1000.",action:"pay",val:1000},
  {text:"Вистояв чергу на Укрпошті! Дали i₴500 компенсації.",action:"receive",val:500},
  {text:"Донька розмалювала шпалери. Ремонт: -i₴500.",action:"pay",val:500},
  {text:"Купив новий монітор MSI 144Hz. -i₴2000.",action:"pay",val:2000},
  {text:"Згорів БЖ під час стріму. -i₴1000.",action:"pay",val:1000},
  {text:"Йди в ТРЦ Екватор на шопінг.",action:"goto",val:16},
  {text:"Йди у Божкове! Без проходження старту.",action:"goto",val:30}
];

const newsCards = [
  {text:"Паливна криза! Всі заправляються на i₴300.",action:"pay-owners",group:"station",val:300},
  {text:"Бум на шопінг! Всі купують одяг на i₴200.",action:"pay-owners",group:"pink",val:200},
  {text:"Чорна П'ятниця! Доставки (Жовті) +i₴1000/шт.",action:"target-receive",group:"yellow",val:1000},
  {text:"Перевірка МАФів. Коричневі платять штраф -i₴500/шт.",action:"target-pay",group:"brown",val:500},
  {text:"Туристичний збір. Червоні райони +i₴1000/шт.",action:"target-receive",group:"red",val:1000},
  {text:"Ажіотаж у ТРЦ. Помаранчеві +i₴700/шт.",action:"target-receive",group:"orange",val:700},
  {text:"Реставрація Козловщини. Сині +i₴1500/шт.",action:"target-receive",group:"blue",val:1500},
  {text:"Бум майнінгу! Обленерго/Водоканал отримують +i₴1500/шт.",action:"target-receive",group:"utility",val:1500},
  {text:"Податок на розкіш! Дім: -i₴250. Готель: -i₴1000.",action:"house-tax",house:250,hotel:1000},
  {text:"Відключення світла. Всі скидаються в банк по i₴500 на генератори.",action:"global-pay",val:500},
  {text:"День Міста! Мерія видає всім по i₴1000.",action:"global-receive",val:1000},
  {text:"⚡ БЛИСКАВКА! Палій повернувся до Полтави! Усі ховають авто: мінус i₴800.",action:"global-pay",val:800}
];

const buyMsgs = ["тишком-нишком приватизував", "психонув і викупив", "став гордим власником", "оформив іпотеку на", "тепер кришує"];
const rentMsgs = ["зі сльозами на очах платить", "віддає останні труси за оренду", "переводить на банку", "з болем у серці віддає"];
const colors = { brown: '#8b4513', lightblue: '#87ceeb', pink: '#ff69b4', orange: '#ff8c00', red: '#e74c3c', yellow: '#f1c40f', green: '#2ecc71', blue: '#3498db', station: '#34495e', utility: '#7f8c8d', none: 'transparent' };
const playerColors = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22'];
const dotL = { 1:[0,0,0,0,1,0,0,0,0], 2:[1,0,0,0,0,0,0,0,1], 3:[1,0,0,0,1,0,0,0,1], 4:[1,0,1,0,0,0,1,0,1], 5:[1,0,1,0,1,0,1,0,1], 6:[1,0,1,1,0,1,1,0,1] };
