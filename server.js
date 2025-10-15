const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Подключаем базу данных SQLite
const db = new sqlite3.Database('./database.db');

// Создаем таблицу, если её нет
db.run(`
  CREATE TABLE IF NOT EXISTS keys (
    key_value TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used BOOLEAN DEFAULT 0
  )
`);

// Функция для генерации случайного ключа
function generateKey() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
    if ((i + 1) % 4 === 0 && i !== 15) {
      result += '-';
    }
  }
  return result;
}

// Маршрут для главной страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Маршрут для генерации нового ключа
app.post('/generate-key', (req, res) => {
  const newKey = generateKey();

  db.run(
    'INSERT INTO keys (key_value) VALUES (?)',
    [newKey],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.json({ key: generateKey() });
        }
        return res.status(500).json({ error: 'Ошибка базы данных' });
      }
      res.json({ key: newKey });
    }
  );
});

// Маршрут для проверки ключа
app.post('/validate-key', (req, res) => {
  const { key } = req.body;

  if (!key) {
    return res.json({ valid: false, reason: 'Ключ не предоставлен' });
  }

  db.get(
    'SELECT * FROM keys WHERE key_value = ?',
    [key],
    (err, row) => {
      if (err) {
        return res.status(500).json({ valid: false, reason: 'Ошибка сервера' });
      }

      if (!row) {
        return res.json({ valid: false, reason: 'Неверный ключ' });
      }

      if (row.used) {
        return res.json({ valid: false, reason: 'Ключ уже использован' });
      }

      const now = new Date();
      const keyCreatedAt = new Date(row.created_at);
      const hoursDiff = (now - keyCreatedAt) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        return res.json({ valid: false, reason: 'Срок действия ключа истек' });
      }

      db.run('UPDATE keys SET used = 1 WHERE key_value = ?', [key]);
      res.json({ valid: true });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
