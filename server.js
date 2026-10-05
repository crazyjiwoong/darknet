// 다크넷 커뮤니티 서버 — 외부 의존성 없이 Node 내장 모듈만 사용
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
// 호스팅(Railway, Render 등) 뒤에서 돌릴 때는 TRUST_PROXY=1 로 켜서 실제 접속자 IP를 쓴다
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

// 말머리 (디시 갤러리처럼 글 종류를 나눈다)
const CATEGORIES = [
  { id: 'general', name: '일반', color: '#c9b8c2', desc: '잡담, 일상, 아무 얘기' },
  { id: 'info', name: '정보', color: '#7fd4ff', desc: '알아두면 좋은 정보와 소식' },
  { id: 'question', name: '질문', color: '#ffd166', desc: '궁금한 건 다크넷 선배들에게' },
  { id: 'guide', name: '공략', color: '#8fe3a0', desc: '게임 공략, 꿀팁, 육성 가이드' },
  { id: 'creative', name: '창작', color: '#c7a6ff', desc: '그림, 시, 노래 가사 같은 창작물' },
  { id: 'meme', name: '밈', color: '#ffb37a', desc: '웃긴 글, 밈, 짤 설명. 웃음은 VVVV' },
  { id: 'ballfic', name: '볼문학', color: '#ff9fd6', desc: '사도들 볼따구가 나오는 팬 문학, 연재 소설' },
  // 공지는 ADMIN_PASSWORD를 설정했을 때만 말머리 목록에 나온다
  { id: 'notice', name: '공지', color: '#ff6b8b', desc: '운영자 공지 (관리자 비밀번호 필요)', admin: true },
];
// 예전 말머리 id → 새 말머리 id
const LEGACY_CATEGORY = {
  daily: 'general', curious: 'question', novel: 'ballfic', qna: 'question', ad: 'general',
  humor: 'meme', review: 'general', news: 'info', jobs: 'general', promo: 'general',
};
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

const LIMITS = { nick: 20, title: 80, body: 5000, spoiler: 2000, comment: 1000, password: 64 };

// ---------- 저장소 ----------

let db = { seq: 0, posts: [] };

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    for (const p of db.posts) {
      p.category = LEGACY_CATEGORY[p.category] || p.category;
      delete p.reward;
    }
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

function isAdmin(pw) {
  if (!ADMIN_PASSWORD || typeof pw !== 'string') return false;
  const a = crypto.createHash('sha256').update(pw).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

// ---------- 첨부 이미지 ----------

const MAX_IMAGES = 4;
const IMAGE_TYPES = {
  jpeg: { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  png: { ext: 'png', magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  webp: { ext: 'webp', magic: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  gif: { ext: 'gif', magic: (b) => b.toString('ascii', 0, 4) === 'GIF8' },
};

// data:image/...;base64,... 를 검사해서 { buf, ext } 로 바꾼다 (SVG 등 다른 형식은 거부)
function decodeImage(dataUrl, maxBytes) {
  const m = typeof dataUrl === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new HttpError(400, '지원하지 않는 이미지 형식입니다 (jpg, png, webp, gif)');
  const type = IMAGE_TYPES[m[1]];
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 12 || !type.magic(buf)) throw new HttpError(400, '이미지 파일이 손상되었습니다');
  if (buf.length > maxBytes) throw new HttpError(413, '이미지가 너무 큽니다');
  return { buf, ext: type.ext };
}

function parseImages(list) {
  if (list == null) return [];
  if (!Array.isArray(list)) throw new HttpError(400, '잘못된 이미지');
  if (list.length > MAX_IMAGES) throw new HttpError(400, `이미지는 ${MAX_IMAGES}장까지 올릴 수 있습니다`);
  return list.map((img) => ({
    full: decodeImage(img?.full, 4 * 1024 * 1024),
    thumb: decodeImage(img?.thumb, 400 * 1024),
    w: Math.max(1, Math.min(10000, Math.round(Number(img?.w) || 1))),
    h: Math.max(1, Math.min(10000, Math.round(Number(img?.h) || 1))),
  }));
}

function saveImages(parsed) {
  if (!parsed.length) return [];
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  return parsed.map((img) => {
    const name = crypto.randomBytes(12).toString('hex');
    fs.writeFileSync(path.join(UPLOAD_DIR, `${name}.${img.full.ext}`), img.full.buf);
    fs.writeFileSync(path.join(UPLOAD_DIR, `${name}_t.${img.thumb.ext}`), img.thumb.buf);
    return { src: `/uploads/${name}.${img.full.ext}`, thumb: `/uploads/${name}_t.${img.thumb.ext}`, w: img.w, h: img.h };
  });
}

function deleteImages(images) {
  for (const img of images || []) {
    for (const url of [img.src, img.thumb]) {
      if (typeof url === 'string' && url.startsWith('/uploads/')) {
        fs.rm(path.join(UPLOAD_DIR, path.basename(url)), { force: true }, () => {});
      }
    }
  }
}

// ---------- 직렬화 ----------

function score(p) {
  return p.up.length - p.down.length;
}

// 추천 비율의 신뢰 하한 (윌슨 점수). 표가 적으면 낮게, 많고 비율이 좋으면 높게 나온다
function wilson(up, total) {
  if (!total) return 0;
  const z = 1.96;
  const phat = up / total;
  return (phat + (z * z) / (2 * total) - z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * total)) / total)) / (1 + (z * z) / total);
}

// 핫 지수: 추천, 댓글, 조회수를 따로 분석해서 합친다
function hotBreakdown(p) {
  const up = p.up.length;
  const down = p.down.length;
  // 추천: 비율이 좋고(윌슨) 수가 많을수록. 비추가 많으면 크게 깎인다
  const votes = wilson(up, up + down) * Math.log2(1 + up) * 12;
  // 댓글: 글쓴이 본인 댓글은 빼고, 몇 명이 참여했는지를 더 크게 본다
  const others = p.comments.filter((c) => !c.deleted && c.nick !== p.nick);
  const people = new Set(others.map((c) => c.nick)).size;
  const comments = Math.log2(1 + people) * 8 + Math.log2(1 + others.length) * 4;
  // 조회수: 로그로 눌러서 조회수만 많은 글이 독식하지 않게
  const views = Math.log10(1 + p.views) * 6;
  // 참여율: 본 사람 중 반응한 비율이 높으면 보너스
  const rate = (up + down + people) / Math.max(p.views, 20);
  const engage = Math.min(rate, 0.5) * 30;
  const r = (n) => Math.round(n * 10) / 10;
  return {
    total: r(votes + comments + views + engage),
    votes: r(votes),
    comments: r(comments),
    views: r(views),
    engage: r(engage),
  };
}

function hotScore(p) {
  return hotBreakdown(p).total;
}

const DAY = 24 * 3.6e6;
const HOT_PERIODS = { day: DAY, week: 7 * DAY, month: 30 * DAY, year: 365 * DAY, all: Infinity };

function publicPost(p, voter, withBody) {
  const out = {
    id: p.id,
    category: p.category,
    title: p.title,
    nick: p.nick,
    hasSpoiler: !!p.spoiler,
    createdAt: p.createdAt,
    views: p.views,
    up: p.up.length,
    down: p.down.length,
    myVote: p.up.includes(voter) ? 'up' : p.down.includes(voter) ? 'down' : null,
    commentCount: p.comments.length,
    thumb: p.images?.[0]?.thumb || null,
    imageCount: p.images?.length || 0,
  };
  if (withBody) {
    out.body = p.body;
    out.spoiler = p.spoiler;
    out.images = p.images || [];
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

function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
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
function clientIp(req) {
  if (TRUST_PROXY) {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function throttle(req, kind, ms) {
  const ip = kind + ':' + clientIp(req);
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
    return send(res, 200, CATEGORIES.map((c) => ({ ...c, hidden: !!c.admin && !ADMIN_PASSWORD })));
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
    // 공지는 전체 목록 맨 위에 고정
    const pinned = !cat ? list.filter((p) => p.category === 'notice').sort((a, b) => b.createdAt - a.createdAt) : [];
    if (pinned.length) list = list.filter((p) => p.category !== 'notice');
    if (sort === 'hot') {
      const span = HOT_PERIODS[url.searchParams.get('period')] ?? HOT_PERIODS.day;
      const since = Date.now() - span;
      list = list.filter((p) => p.createdAt >= since);
    }
    if (sort === 'new') list.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === 'hot') {
      const scores = new Map(list.map((p) => [p, hotScore(p)]));
      list.sort((a, b) => scores.get(b) - scores.get(a) || b.createdAt - a.createdAt);
    }
    else list.sort((a, b) => score(b) - score(a) || b.createdAt - a.createdAt);
    return send(res, 200, [...pinned, ...list].map((p) => {
      const out = publicPost(p, voter, false);
      if (sort === 'hot' && p.category !== 'notice') out.hot = hotBreakdown(p);
      return out;
    }));
  }

  // POST /api/posts
  if (m === 'POST' && parts.length === 1) {
    const b = await readJson(req, 24 * 1024 * 1024);
    const post = {
      id: 0,
      category: CATEGORY_IDS.has(b.category) ? b.category : 'general',
      title: str(b.title, LIMITS.title, '제목'),
      body: str(b.body, LIMITS.body, '내용'),
      nick: str(b.nick, LIMITS.nick, '닉네임'),
      pw: hashPassword(str(b.password, LIMITS.password, '비밀번호')),
      spoiler: str(b.spoiler, LIMITS.spoiler, '스포일러', { required: false }),
      createdAt: Date.now(),
      views: 0,
      up: [],
      down: [],
      comments: [],
    };
    if (post.category === 'notice' && !isAdmin(b.adminPassword)) {
      throw new HttpError(403, '공지는 운영자만 쓸 수 있습니다');
    }
    const images = parseImages(b.images);
    throttle(req, 'post', 5000);
    post.images = saveImages(images);
    post.id = nextId();
    db.posts.push(post);
    saveDb();
    return send(res, 201, publicPost(post, voter, true));
  }

  const post = findPost(parts[1]);

  // GET /api/posts/:id
  if (m === 'GET' && parts.length === 2) {
    if (url.searchParams.get('view') === '1' && voter) {
      post.viewedBy ||= [];
      if (!post.viewedBy.includes(voter)) {
        post.viewedBy.push(voter);
        post.views++;
        saveDb();
      }
    }
    return send(res, 200, publicPost(post, voter, true));
  }

  // DELETE /api/posts/:id
  if (m === 'DELETE' && parts.length === 2) {
    const b = await readJson(req);
    if (!checkPassword(b.password, post.pw)) throw new HttpError(403, '비밀번호가 틀렸습니다');
    db.posts = db.posts.filter((p) => p !== post);
    deleteImages(post.images);
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
  '.woff2': 'font/woff2',
};

function serveUpload(req, res, url) {
  const name = url.pathname.slice('/uploads/'.length);
  if (!/^[a-f0-9]{24}(_t)?\.(jpg|png|webp|gif)$/.test(name)) {
    res.writeHead(404);
    return res.end();
  }
  const file = path.join(UPLOAD_DIR, name);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(name)],
      'Content-Length': st.size,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
  });
}

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
    else if (url.pathname.startsWith('/uploads/')) serveUpload(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    if (e instanceof HttpError) send(res, e.status, { error: e.message });
    else {
      console.error(e);
      send(res, 500, { error: '서버 오류' });
    }
  }
});

setInterval(() => {
  const cutoff = Date.now() - 60 * 1000;
  for (const [k, t] of recentWrites) if (t < cutoff) recentWrites.delete(k);
}, 60 * 1000).unref();

server.listen(PORT, () => {
  console.log(`다크넷 접속 중… http://localhost:${PORT}`);
});
