// 다크넷 커뮤니티 서버 — 외부 의존성 없이 Node 내장 모듈만 사용
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const CATEGORIES = [
  { id: 'daily', name: '일상생활' },
  { id: 'curious', name: '궁금해요' },
  { id: 'novel', name: '소설' },
  { id: 'qna', name: '질문답변' },
  { id: 'jobs', name: '채용공고' },
  { id: 'ad', name: '홍보' },
];
const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));
const REWARDS = new Set(['', 'gold', 'drink', 'candy', 'bread']);

const LIMITS = { nick: 20, title: 80, body: 5000, spoiler: 2000, comment: 1000, password: 64 };

// ---------- 저장소 ----------

let db = { seq: 0, posts: [] };

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = require('./seed.js')(nextIdFactory());
  saveDb();
}

function nextIdFactory() {
  let n = 0;
  return () => ++n;
}

let saveTimer = null;
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  }, 50);
}

function nextId() {
  db.seq = Math.max(db.seq || 0, maxId()) + 1;
  return db.seq;
}

function maxId() {
  let m = 0;
  for (const p of db.posts) {
    m = Math.max(m, p.id);
    for (const c of p.comments) m = Math.max(m, c.id);
  }
  return m;
}

// ---------- 비밀번호 ----------

function hashPassword(pw) {
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function checkPassword(pw, stored) {
  if (!stored || typeof pw !== 'string') return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 32);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

// ---------- 직렬화 ----------

function score(p) {
  return p.up.length - p.down.length;
}

function hotScore(p) {
  const hours = (Date.now() - p.createdAt) / 3.6e6;
  return (score(p) + p.comments.length * 2 + p.views * 0.05) / Math.pow(hours + 2, 1.5);
}

function publicPost(p, voter, withBody) {
  const out = {
    id: p.id,
    category: p.category,
    title: p.title,
    nick: p.nick,
    reward: p.reward,
    hasSpoiler: !!p.spoiler,
    createdAt: p.createdAt,
    views: p.views,
    up: p.up.length,
    down: p.down.length,
    myVote: p.up.includes(voter) ? 'up' : p.down.includes(voter) ? 'down' : null,
    commentCount: p.comments.length,
  };
  if (withBody) {
    out.body = p.body;
    out.spoiler = p.spoiler;
    out.comments = p.comments.map((c) => ({
      id: c.id,
      parentId: c.parentId,
      nick: c.nick,
      body: c.deleted ? '' : c.body,
      deleted: !!c.deleted,
      createdAt: c.createdAt,
      up: c.up.length,
      down: c.down.length,
      myVote: c.up.includes(voter) ? 'up' : c.down.includes(voter) ? 'down' : null,
    }));
  }
  return out;
}

// ---------- 요청 처리 유틸 ----------

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 64 * 1024) {
        reject(new HttpError(413, '요청이 너무 큽니다'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, '잘못된 JSON'));
      }
    });
    req.on('error', reject);
  });
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function str(v, max, field, { required = true } = {}) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw new HttpError(400, `${field}을(를) 입력해 주세요`);
  if (s.length > max) throw new HttpError(400, `${field}은(는) ${max}자 이하로 써 주세요`);
  return s;
}

function voterId(v) {
  return typeof v === 'string' && /^[a-z0-9-]{8,64}$/i.test(v) ? v : null;
}

// 간단한 도배 방지: IP당 일정 시간 내 작성 횟수 제한
const recentWrites = new Map();
function throttle(req, kind, ms) {
  const ip = kind + ':' + (req.socket.remoteAddress || 'unknown');
  const now = Date.now();
  const last = recentWrites.get(ip) || 0;
  if (now - last < ms) throw new HttpError(429, '도배 방지: 잠시 후 다시 시도해 주세요');
  recentWrites.set(ip, now);
}

function findPost(id) {
  const p = db.posts.find((x) => x.id === Number(id));
  if (!p) throw new HttpError(404, '글을 찾을 수 없습니다');
  return p;
}

function applyVote(target, voter, type) {
  if (!voter) throw new HttpError(400, '잘못된 요청');
  if (type !== 'up' && type !== 'down') throw new HttpError(400, '잘못된 요청');
  const other = type === 'up' ? 'down' : 'up';
  target[other] = target[other].filter((v) => v !== voter);
  if (target[type].includes(voter)) {
    target[type] = target[type].filter((v) => v !== voter); // 다시 누르면 취소
  } else {
    target[type].push(voter);
  }
}

// ---------- API 라우팅 ----------

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // 'api' 제거
  const m = req.method;
  const voter = voterId(url.searchParams.get('voter'));

  if (m === 'GET' && parts[0] === 'categories' && parts.length === 1) {
    return send(res, 200, CATEGORIES);
  }

  if (parts[0] !== 'posts') throw new HttpError(404, '없는 경로');

  // GET /api/posts
  if (m === 'GET' && parts.length === 1) {
    const sort = url.searchParams.get('sort') || 'best';
    const cat = url.searchParams.get('cat') || '';
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    let list = db.posts.slice();
    if (cat) list = list.filter((p) => p.category === cat);
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.body.toLowerCase().includes(q) ||
          p.nick.toLowerCase().includes(q),
      );
    }
    if (sort === 'new') list.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === 'hot') list.sort((a, b) => hotScore(b) - hotScore(a));
    else list.sort((a, b) => score(b) - score(a) || b.createdAt - a.createdAt);
    return send(res, 200, list.map((p) => publicPost(p, voter, false)));
  }

  // POST /api/posts
  if (m === 'POST' && parts.length === 1) {
    const b = await readJson(req);
    const post = {
      id: 0,
      category: CATEGORY_IDS.has(b.category) ? b.category : 'daily',
      title: str(b.title, LIMITS.title, '제목'),
      body: str(b.body, LIMITS.body, '내용'),
      nick: str(b.nick, LIMITS.nick, '닉네임'),
      pw: hashPassword(str(b.password, LIMITS.password, '비밀번호')),
      spoiler: str(b.spoiler, LIMITS.spoiler, '스포일러', { required: false }),
      reward: REWARDS.has(b.reward) ? b.reward : '',
      createdAt: Date.now(),
      views: 0,
      up: [],
      down: [],
      comments: [],
    };
    throttle(req, 'post', 5000);
    post.id = nextId();
    db.posts.push(post);
    saveDb();
    return send(res, 201, publicPost(post, voter, true));
  }

  const post = findPost(parts[1]);

  // GET /api/posts/:id
  if (m === 'GET' && parts.length === 2) {
    if (url.searchParams.get('view') === '1') {
      post.views++;
      saveDb();
    }
    return send(res, 200, publicPost(post, voter, true));
  }

  // DELETE /api/posts/:id
  if (m === 'DELETE' && parts.length === 2) {
    const b = await readJson(req);
    if (!checkPassword(b.password, post.pw)) throw new HttpError(403, '비밀번호가 틀렸습니다');
    db.posts = db.posts.filter((p) => p !== post);
    saveDb();
    return send(res, 200, { ok: true });
  }

  // POST /api/posts/:id/vote
  if (m === 'POST' && parts[2] === 'vote' && parts.length === 3) {
    const b = await readJson(req);
    applyVote(post, voterId(b.voter), b.type);
    saveDb();
    return send(res, 200, publicPost(post, voterId(b.voter), false));
  }

  // POST /api/posts/:id/comments
  if (m === 'POST' && parts[2] === 'comments' && parts.length === 3) {
    const b = await readJson(req);
    let parentId = null;
    if (b.parentId != null) {
      const parent = post.comments.find((c) => c.id === Number(b.parentId));
      if (!parent) throw new HttpError(400, '원 댓글이 없습니다');
      parentId = parent.parentId ?? parent.id; // 대댓글은 한 단계까지만
    }
    const comment = {
      id: 0,
      parentId,
      nick: str(b.nick, LIMITS.nick, '닉네임'),
      pw: hashPassword(str(b.password, LIMITS.password, '비밀번호')),
      body: str(b.body, LIMITS.comment, '댓글'),
      createdAt: Date.now(),
      up: [],
      down: [],
    };
    throttle(req, 'comment', 2000);
    comment.id = nextId();
    post.comments.push(comment);
    saveDb();
    return send(res, 201, publicPost(post, voterId(b.voter), true));
  }

  if (parts[2] === 'comments' && parts.length >= 4) {
    const comment = post.comments.find((c) => c.id === Number(parts[3]));
    if (!comment) throw new HttpError(404, '댓글을 찾을 수 없습니다');

    // DELETE /api/posts/:id/comments/:cid
    if (m === 'DELETE' && parts.length === 4) {
      const b = await readJson(req);
      if (!checkPassword(b.password, comment.pw)) throw new HttpError(403, '비밀번호가 틀렸습니다');
      const hasReplies = post.comments.some((c) => c.parentId === comment.id);
      if (hasReplies) comment.deleted = true;
      else post.comments = post.comments.filter((c) => c !== comment);
      saveDb();
      return send(res, 200, publicPost(post, voter, true));
    }

    // POST /api/posts/:id/comments/:cid/vote
    if (m === 'POST' && parts[4] === 'vote' && parts.length === 5) {
      const b = await readJson(req);
      applyVote(comment, voterId(b.voter), b.type);
      saveDb();
      return send(res, 200, publicPost(post, voterId(b.voter), true));
    }
  }

  throw new HttpError(404, '없는 경로');
}

// ---------- 정적 파일 ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end();
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
}

// ---------- 시작 ----------

loadDb();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    if (e instanceof HttpError) send(res, e.status, { error: e.message });
    else {
      console.error(e);
      send(res, 500, { error: '서버 오류' });
    }
  }
});

server.listen(PORT, () => {
  console.log(`다크넷 접속 중… http://localhost:${PORT}`);
});
