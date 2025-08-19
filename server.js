const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const { parse } = require('csv-parse');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Database connection
const db = new sqlite3.Database('./db.sqlite3', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Bible books in Traditional Chinese
const bibleBooks = {
  'GEN': '創世記', 'EXO': '出埃及記', 'LEV': '利未記', 'NUM': '民數記', 'DEU': '申命記',
  'JOS': '約書亞記', 'JDG': '士師記', 'RUT': '路得記', '1SA': '撒母耳記上', '2SA': '撒母耳記下',
  '1KI': '列王紀上', '2KI': '列王紀下', '1CH': '歷代志上', '2CH': '歷代志下', 'EZR': '以斯拉記',
  'NEH': '尼希米記', 'EST': '以斯帖記', 'JOB': '約伯記', 'PSA': '詩篇', 'PRO': '箴言',
  'ECC': '傳道書', 'SNG': '雅歌', 'ISA': '以賽亞書', 'JER': '耶利米書', 'LAM': '耶利米哀歌',
  'EZK': '以西結書', 'DAN': '但以理書', 'HOS': '何西阿書', 'JOE': '約珥書', 'AMO': '阿摩司書',
  'OBA': '俄巴底亞書', 'JON': '約拿書', 'MIC': '彌迦書', 'NAH': '那鴻書', 'HAB': '哈巴谷書',
  'ZEP': '西番雅書', 'HAG': '哈該書', 'ZEC': '撒迦利亞書', 'MAL': '瑪拉基書',
  'MAT': '馬太福音', 'MRK': '馬可福音', 'LUK': '路加福音', 'JHN': '約翰福音', 'ACT': '使徒行傳',
  'ROM': '羅馬書', '1CO': '哥林多前書', '2CO': '哥林多後書', 'GAL': '加拉太書', 'EPH': '以弗所書',
  'PHP': '腓立比書', 'COL': '歌羅西書', '1TH': '帖撒羅尼迦前書', '2TH': '帖撒羅尼迦後書',
  '1TI': '提摩太前書', '2TI': '提摩太後書', 'TIT': '提多書', 'PHM': '腓利門書', 'HEB': '希伯來書',
  'JAS': '雅各書', '1PE': '彼得前書', '2PE': '彼得後書', '1JN': '約翰一書', '2JN': '約翰二書',
  '3JN': '約翰三書', 'JUD': '猶大書', 'REV': '啟示錄'
};

// Current sermon metadata
let sermonMeta = {
  title: 'Sunday Service',
  speaker: 'Pastor John',
  translator: 'Sister Mary',
  pianist: 'Brother David',
  hymn1: '324',
  hymn2: '156'
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

// API Routes
app.get('/api/bible-books', (req, res) => {
  res.json(bibleBooks);
});

app.post('/api/bible-search', (req, res) => {
  const { book, chapter, startVerse, endVerse, translations } = req.body;
  
  const placeholders = translations.map(() => '?').join(',');
  const query = `
    SELECT * FROM bible_search_bible 
    WHERE book_code = ? AND chapter = ? AND verse BETWEEN ? AND ? AND translation IN (${placeholders})
    ORDER BY translation, verse
  `;
  
  const params = [book, chapter, startVerse, endVerse, ...translations];
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    
    const result = {
      verses: rows,
      sermonMeta: sermonMeta,
      bookName: bibleBooks[book] || book
    };
    
    // Broadcast to display
    io.emit('bible-results', result);
    res.json(result);
  });
});

app.post('/api/hymn-search', (req, res) => {
  const { query, number } = req.body;
  
  // Mock hymn search results (you can implement actual hymn database later)
  const hymnResults = {
    number: number || '324',
    title: query || 'Amazing Grace',
    verses: [
      'Amazing grace! How sweet the sound That saved a wretch like me!',
      'I once was lost, but now am found; Was blind, but now I see.',
      '\'Twas grace that taught my heart to fear, And grace my fears relieved;',
      'How precious did that grace appear The hour I first believed!'
    ]
  };
  
  // Broadcast to display
  io.emit('hymn-results', hymnResults);
  res.json(hymnResults);
});

app.post('/api/sermon-meta', (req, res) => {
  sermonMeta = { ...sermonMeta, ...req.body };
  
  // Broadcast updated sermon meta
  io.emit('sermon-meta-updated', sermonMeta);
  res.json(sermonMeta);
});

app.get('/api/sermon-meta', (req, res) => {
  res.json(sermonMeta);
});

// Google Sheets integration (you'll need to replace with your actual Google Sheet URL)
app.get('/api/announcements', async (req, res) => {
  try {
    // Mock announcements - replace with actual Google Sheets API call
    const announcements = [
      {
        title: 'Welcome to Sunday Service',
        content: 'We are glad you are here today. Please join us for fellowship after the service.',
        date: new Date().toLocaleDateString()
      },
      {
        title: 'Prayer Meeting',
        content: 'Join us every Wednesday at 7 PM for our weekly prayer meeting.',
        date: new Date().toLocaleDateString()
      },
      {
        title: 'Youth Group',
        content: 'Youth group meets every Friday at 6 PM. All teenagers welcome!',
        date: new Date().toLocaleDateString()
      }
    ];
    
    // Broadcast to display
    io.emit('announcements-updated', announcements);
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send current sermon meta to newly connected clients
  socket.emit('sermon-meta-updated', sermonMeta);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
  
  // Handle tab changes
  socket.on('tab-changed', (tabName) => {
    io.emit('active-tab-changed', tabName);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Control panel: http://localhost:${PORT}`);
  console.log(`Display page: http://localhost:${PORT}/display`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});