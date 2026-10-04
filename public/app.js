// 다크넷 프론트엔드 — 해시 라우팅 SPA
(() => {
  'use strict';

  // ---------- 상태 ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('darknet.' + key);
        return v == null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem('darknet.' + key, JSON.stringify(value)); } catch {}
    },
  };

  const DEFAULT_NICKS = ['지나가던엘프', '익명의엘프', '잘보이는엘프', '신경질적인엘프', 'ㅇㅇ'];
  const state = {
    voter: store.get('voter', null),
    nick: store.get('nick', null),
    password: store.get('password', ''),
    sort: store.get('sort', 'best'),
    period: store.get('period', 'day'),
    compact: store.get('compact', false),
    read: new Set(store.get('read', [])),
    categories: [],
  };
  if (!state.voter) {
    state.voter = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
    store.set('voter', state.voter);
  }
  if (!state.nick) {
    state.nick = DEFAULT_NICKS[Math.floor(Math.random() * DEFAULT_NICKS.length)];
    store.set('nick', state.nick);
  }

  // 핫한 글 기간
  const PERIODS = [
    { id: 'day', label: '하루간' },
    { id: 'week', label: '일주일간' },
    { id: 'month', label: '한달간' },
    { id: 'year', label: '1년간' },
    { id: 'all', label: '전체' },
  ];

  // ---------- 유틸 ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const view = $('#view');

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function timeAgo(t) {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return '방금';
    if (s < 3600) return Math.floor(s / 60) + '분 전';
    if (s < 86400) return Math.floor(s / 3600) + '시간 전';
    if (s < 86400 * 30) return Math.floor(s / 86400) + '일 전';
    const d = new Date(t);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  }

  function catName(id) {
    return state.categories.find((c) => c.id === id)?.name || id;
  }

  function visibleCats() {
    return state.categories.filter((c) => !c.hidden);
  }

  function catColor(id) {
    return state.categories.find((c) => c.id === id)?.color || 'var(--pink-text)';
  }

  // 말머리 라벨 (색은 서버가 준 값만 쓴다)
  function catLabel(id, link) {
    const style = `style="color:${esc(catColor(id))}"`;
    return link
      ? `<a class="cat-label" href="#/b/${esc(id)}" ${style}>${esc(catName(id))}</a>`
      : `<span class="cat-label" ${style}>${esc(catName(id))}</span>`;
  }

  async function api(path, opts = {}) {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`/api${path}${sep}voter=${encodeURIComponent(state.voter)}`, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify({ voter: state.voter, ...opts.body }) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '오류가 발생했습니다');
    return data;
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 2200);
  }

  // 작은 입력 모달 (prompt 대체)
  function ask({ title, desc = '', value = '', type = 'text', placeholder = '', ok = '확인' }) {
    return new Promise((resolve) => {
      const modal = $('#modal');
      const input = $('#modalInput');
      $('#modalTitle').textContent = title;
      $('#modalDesc').textContent = desc;
      $('#modalOk').textContent = ok;
      input.type = type;
      input.value = value;
      input.placeholder = placeholder;
      modal.hidden = false;
      setTimeout(() => input.focus(), 0);
      const done = (v) => {
        modal.hidden = true;
        $('#modalForm').onsubmit = null;
        $('#modalCancel').onclick = null;
        modal.onclick = null;
        resolve(v);
      };
      $('#modalForm').onsubmit = (e) => { e.preventDefault(); done(input.value); };
      $('#modalCancel').onclick = () => done(null);
      modal.onclick = (e) => { if (e.target === modal) done(null); };
    });
  }

  function markRead(id) {
    if (state.read.has(id)) return;
    state.read.add(id);
    store.set('read', [...state.read].slice(-500));
  }

  function setTitle(t) {
    document.title = t === '다크넷' ? '다크넷' : `${t} - 다크넷`;
  }

  // ---------- 아이콘 ----------
  const icon = {
    flame: '<svg viewBox="0 0 24 24"><path d="M12 2c1 4-3 6-3 10a3 3 0 0 0 6 0c0-1-.4-2-1-3 3 1 5 4 5 7a7 7 0 0 1-14 0c0-6 5-8 7-14z"/></svg>',
    drop: '<svg viewBox="0 0 24 24"><path d="M12 22a6 6 0 0 1-6-6c0-4 6-12 6-12s6 8 6 12a6 6 0 0 1-6 6zm-2.5-6.5a1 1 0 0 0-1 1 3.5 3.5 0 0 0 3.5 3.5 1 1 0 0 0 0-2 1.5 1.5 0 0 1-1.5-1.5 1 1 0 0 0-1-1z"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 6.5a1.3 1.3 0 1 0 0 .01zm5 0a1.3 1.3 0 1 0 0 .01zm5 0a1.3 1.3 0 1 0 0 .01z"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    best: '<svg viewBox="0 0 24 24"><path d="M12.5 2C9 6.5 5.5 10 5.5 14.6a6.6 6.6 0 0 0 13.2 0c0-2.4-1.2-4.4-2.8-6 .3 2.3-.9 4.1-2.9 4.1a2.8 2.8 0 0 1-2.8-2.9c0-2.6 1.3-4.9 2.3-7.8z"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M13.2 2.5a7.3 7.3 0 0 0-6 11.5L5.3 21.5l6.3-4.3a7.3 7.3 0 1 0 1.6-14.7zm.1 4.4a2.9 2.9 0 1 1 0 5.8 2.9 2.9 0 0 1 0-5.8z"/></svg>',
    pen: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/></svg>',
    layoutCard: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 12h18"/></svg>',
    image: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 12.5V18h14v-3l-4-4-5 5-2.5-2.5L5 16.5zM8.5 7.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>',
    layoutList: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.3h18M3 14.6h18"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M6 9l6 6 6-6"/></svg>',
  };

  // 핫 지수 배지 (마우스를 올리면 추천/댓글/조회/참여율 점수가 보인다)
  function hotBadge(h) {
    const detail = `추천 ${h.votes} + 댓글 ${h.comments} + 조회 ${h.views} + 참여율 ${h.engage}`;
    return `<div class="hot-badge" title="${esc(detail)}">
      <span class="hot-num">${icon.flame}${Math.round(h.total)}</span>
      <span class="hot-label">핫 지수</span>
      <div class="hot-bars" aria-label="${esc(detail)}">
        ${[['votes', '추천'], ['comments', '댓글'], ['views', '조회'], ['engage', '참여']]
          .map(([k, label]) => `<span class="hot-bar ${k}" style="--w:${Math.min(100, (h[k] / Math.max(h.total, 1)) * 100)}%" title="${label} ${h[k]}"></span>`)
          .join('')}
      </div>
    </div>`;
  }

  function voteStats(item, { comments, views, interactive, kind, id, menu, who }) {
    const tag = interactive ? 'button' : 'span';
    const attrs = (type) => (interactive ? ` type="button" data-vote="${type}" data-kind="${kind}" data-id="${id}"` : '');
    return `<div class="stats">
      <${tag} class="stat${item.myVote === 'up' ? ' on-up' : ''}"${attrs('up')} title="추천">${icon.best}${item.up}</${tag}>
      <${tag} class="stat${item.myVote === 'down' ? ' on-down' : ''}"${attrs('down')} title="비추천">${icon.pin}${item.down}</${tag}>
      ${comments != null ? `<span class="stat" title="댓글">${icon.chat}${comments}</span>` : ''}
      ${views != null ? `<span class="stat" title="조회수">${icon.eye}${views}</span>` : ''}
      ${menu || '<span class="stat stat-more">•••</span>'}
      ${who ? `<span class="stat-who">${esc(who)}</span>` : ''}
    </div>`;
  }

  // ---------- 광고 ----------
  const ADS = [
    { src: 'assets/ad-request.png', alt: '미스터리 하나? 지금 당장 의뢰하기' },
    { src: 'assets/ad-monatium.png', alt: '모나티엄 광고' },
  ];
  let adIndex = Math.floor(Math.random() * ADS.length);
  let adTimer;
  function renderAd() {
    const ad = ADS[adIndex];
    $('#ads').innerHTML = `
      <div class="ad"><img src="${ad.src}" alt="${esc(ad.alt)}" width="197" height="329"></div>
      <div class="ad-dots">${ADS.map((_, i) => `<button type="button" data-ad="${i}" class="${i === adIndex ? 'on' : ''}" aria-label="광고 ${i + 1}"></button>`).join('')}</div>`;
    clearInterval(adTimer);
    adTimer = setInterval(() => { adIndex = (adIndex + 1) % ADS.length; renderAd(); }, 8000);
  }
  $('#ads').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ad]');
    if (b) { adIndex = Number(b.dataset.ad); renderAd(); }
  });

  // ---------- 서랍 메뉴 ----------
  function openDrawer(open) {
    $('#drawer').classList.toggle('open', open);
    $('#drawerBackdrop').hidden = !open;
  }
  function renderDrawer(current) {
    const links = [{ id: '', name: '전체 글' }, ...visibleCats()];
    $('#drawerList').innerHTML = links
      .map((c) => `<a class="drawer-link${c.id === current ? ' on' : ''}" href="${c.id ? '#/b/' + c.id : '#/'}">${esc(c.name)}<small>${c.id ? '›' : ''}</small></a>`)
      .join('') + `<a class="drawer-link" href="#/write">✎ 글쓰기</a>`;
  }
  $('#btnMenu').onclick = () => openDrawer(true);
  $('#drawerBackdrop').onclick = () => openDrawer(false);
  $('#drawerList').onclick = (e) => { if (e.target.closest('a')) openDrawer(false); };

  // ---------- 목록 화면 ----------
  async function renderList({ cat = '', q = '' }) {
    renderDrawer(cat);
    setTitle(q ? `"${q}" 검색` : cat ? catName(cat) : '다크넷');
    $('#searchInput').value = q;

    const sorts = [
      { id: 'best', label: 'Best', icon: icon.best },
      { id: 'hot', label: 'Hot', icon: icon.flame },
      { id: 'new', label: 'New', icon: icon.sparkle },
    ];

    const hero = !cat && !q
      ? ''
      : `<div class="board-head"><h2>${q ? esc(`"${q}" 검색 결과`) : catLabel(cat)}</h2><span id="countLabel"></span></div>
         ${cat ? `<p class="board-desc">${esc(state.categories.find((c) => c.id === cat)?.desc || '')}</p>` : ''}`;

    // 디시 갤러리 말머리 탭
    const tabs = `<nav class="head-tabs" aria-label="말머리">
        <a class="head-tab all${!cat ? ' on' : ''}" href="#/">전체</a>
        ${visibleCats().map((c) => `<a class="head-tab${c.id === cat ? ' on' : ''}" href="#/b/${esc(c.id)}" style="--tab:${esc(c.color)}">${esc(c.name)}</a>`).join('')}
      </nav>`;

    view.innerHTML = `${hero}
      <div class="toolbar">
        ${sorts.map((s) => `<button type="button" class="sort-btn${state.sort === s.id ? ' on' : ''}" data-sort="${s.id}">${s.icon}${s.label}</button>`).join('')}
        <div class="toolbar-right">
          <button type="button" class="layout-btn" id="btnLayout" title="보기 방식 바꾸기">${state.compact ? icon.layoutList : icon.layoutCard}${icon.chevron}</button>
          <a class="write-btn" href="#/write${cat ? '?cat=' + encodeURIComponent(cat) : ''}" title="글쓰기" aria-label="글쓰기">${icon.pen}</a>
        </div>
      </div>
      ${state.sort === 'hot' ? `<div class="periods" role="group" aria-label="기간">
        ${PERIODS.map((pd) => `<button type="button" class="period${state.period === pd.id ? ' on' : ''}" data-period="${pd.id}">${pd.label}</button>`).join('')}
      </div>
      <p class="hot-help">🔥 핫 지수 = 추천(비율과 수) + 댓글(참여한 사람 수, 글쓴이 제외) + 조회수 + 참여율(본 사람 중 반응한 비율)</p>` : ''}
      ${q ? '' : tabs}
      <div class="list${state.compact ? ' compact' : ''}" id="list"><div class="empty">불러오는 중…</div></div>`;

    view.querySelectorAll('[data-period]').forEach((b) => {
      b.onclick = () => { state.period = b.dataset.period; store.set('period', state.period); renderList({ cat, q }); };
    });
    view.querySelectorAll('[data-sort]').forEach((b) => {
      b.onclick = () => { state.sort = b.dataset.sort; store.set('sort', state.sort); renderList({ cat, q }); };
    });
    $('#btnLayout').onclick = () => { state.compact = !state.compact; store.set('compact', state.compact); renderList({ cat, q }); };

    const params = new URLSearchParams({ sort: state.sort });
    if (state.sort === 'hot') params.set('period', state.period);
    if (cat) params.set('cat', cat);
    if (q) params.set('q', q);
    let posts;
    try {
      posts = await api('/posts?' + params);
    } catch (e) {
      $('#list').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
      return;
    }
    const count = $('#countLabel');
    if (count) count.textContent = `글 ${posts.length}개`;

    if (!posts.length) {
      const msg = state.sort === 'hot' && state.period !== 'all'
        ? `${PERIODS.find((pd) => pd.id === state.period).label} 올라온 핫한 글이 없어요. 기간을 늘려 보세요.`
        : '아직 글이 없어요. 첫 글을 남겨 보세요!';
      $('#list').innerHTML = `<div class="empty"><img src="assets/ghost.svg" alt="">${msg}</div>`;
      return;
    }
    $('#list').innerHTML = posts.map((p) => {
      const read = state.read.has(p.id);
      const notice = p.category === 'notice' && !cat;
      const thumbAttrs = p.thumb ? ` data-thumb="${esc(p.thumb)}" data-count="${p.imageCount}"` : '';
      return `<a class="post-card${read ? ' read' : ''}${notice ? ' notice' : ''}" href="#/p/${p.id}"${thumbAttrs}>
        <div class="post-main">
          <div class="post-cat"><span class="avatar"></span>${notice ? '📌 ' : ''}${catLabel(p.category)}<span class="cat-who">${esc(p.nick)} · ${timeAgo(p.createdAt)}</span></div>
          <div class="post-title">${esc(p.title)}${p.imageCount ? `<span class="has-img" title="이미지 ${p.imageCount}장">${icon.image}${p.imageCount > 1 ? p.imageCount : ''}</span>` : ''}</div>
          ${voteStats(p, { comments: p.commentCount, views: p.views, who: `${p.nick} · ${timeAgo(p.createdAt)}` })}
        </div>
        ${p.hot ? hotBadge(p.hot) : ''}
        ${!read ? `<span class="heart" title="안 읽은 글">${icon.heart}</span><span class="unread-dot" title="안 읽은 글"></span>` : ''}
      </a>`;
    }).join('');
  }

  // ---------- 상세 화면 ----------
  let current = null; // 현재 보고 있는 글

  async function renderPost(id, { countView = true } = {}) {
    if (countView) view.innerHTML = '<div class="empty">불러오는 중…</div>';
    try {
      current = await api(`/posts/${id}${countView ? '?view=1' : ''}`);
    } catch (e) {
      view.innerHTML = `<div class="empty"><img src="assets/ghost.svg" alt="">${esc(e.message)}<br><br><a class="btn ghost" href="#/" style="display:inline-flex;align-items:center">목록으로</a></div>`;
      setTitle('다크넷');
      return;
    }
    markRead(current.id);
    renderDrawer(current.category);
    setTitle(current.title);
    drawPost();
    if (countView) view.scrollTop = 0;
  }

  function drawPost() {
    const p = current;
    const top = p.comments.filter((c) => c.parentId == null);
    const replies = (pid) => p.comments.filter((c) => c.parentId === pid);

    const commentHtml = (c) => `
      <div class="comment" id="c${c.id}">
        <div class="who"><span class="avatar"></span>${esc(c.nick)}${c.nick === p.nick ? '<span class="op">글쓴이</span>' : ''}<time>${timeAgo(c.createdAt)}</time></div>
        <div class="text${c.deleted ? ' deleted' : ''}">${c.deleted ? '삭제된 댓글입니다.' : esc(c.body)}</div>
        ${c.deleted ? '' : voteStats(c, {
          interactive: true, kind: 'comment', id: c.id,
          menu: `<span class="menu-wrap"><button type="button" class="stat stat-more" data-menu="c${c.id}">•••</button></span>`,
        })}
        <div class="reply-slot" data-reply-slot="${c.id}"></div>
      </div>`;

    view.innerHTML = `
      <article class="detail">
        <div class="detail-head">
          <div class="post-cat"><span class="avatar"></span>${catLabel(p.category, true)}</div>
          <div class="author">${esc(p.nick)}<time>${timeAgo(p.createdAt)} · 조회 ${p.views}</time></div>
          <button type="button" class="back-btn" id="btnBack" aria-label="뒤로">${icon.back}</button>
        </div>
        <h1>${esc(p.title)}</h1>
        <div class="body">${esc(p.body)}</div>
        ${p.images?.length ? `<div class="post-images">${p.images.map((img) => `<a href="${esc(img.src)}" target="_blank" rel="noopener"><img src="${esc(img.src)}" alt="첨부 이미지" loading="lazy" width="${Number(img.w) || ''}" height="${Number(img.h) || ''}"></a>`).join('')}</div>` : ''}
        ${voteStats(p, {
          interactive: true, kind: 'post', id: p.id, comments: p.comments.length,
          menu: `<span class="menu-wrap"><button type="button" class="stat stat-more" data-menu="post">•••</button></span>`,
        })}
        <hr class="divider">
        ${p.spoiler ? `<button type="button" class="spoiler-bar" id="btnSpoiler">스포일러 보기</button><div class="spoiler-body" id="spoilerBody" hidden>${esc(p.spoiler)}</div>` : ''}
        <div class="comments-title">댓글 ${p.comments.length}</div>
        <div id="comments">
          ${top.length ? top.map((c) => {
            const rs = replies(c.id);
            return `<div class="thread${rs.length ? ' has-replies' : ''}">${commentHtml(c)}${rs.length ? `<div class="replies">${rs.map(commentHtml).join('')}</div>` : ''}</div>`;
          }).join('') : '<div class="empty" style="padding:20px">첫 댓글을 남겨 보세요.</div>'}
        </div>
        <hr class="divider">
        ${commentForm(null)}
      </article>`;

    $('#btnBack').onclick = () => (history.length > 1 ? history.back() : (location.hash = '#/'));
    const sp = $('#btnSpoiler');
    if (sp) sp.onclick = () => {
      const body = $('#spoilerBody');
      body.hidden = !body.hidden;
      sp.textContent = body.hidden ? '스포일러 보기' : '스포일러 숨기기';
    };
    bindCommentForm(view.querySelector('form[data-parent=""]'));
  }

  function commentForm(parentId) {
    return `<form class="form" data-parent="${parentId ?? ''}">
      <div class="form-row">
        <input class="field" name="nick" maxlength="20" placeholder="닉네임" value="${esc(state.nick)}" required>
        <input class="field" name="password" type="password" maxlength="64" placeholder="비밀번호 (삭제용)" value="${esc(state.password)}" required>
      </div>
      <textarea class="field" name="body" maxlength="1000" placeholder="${parentId ? '답글을 입력하세요' : '댓글을 입력하세요'}" required></textarea>
      <div class="form-actions">
        <span class="count">0 / 1000</span>
        ${parentId ? '<button type="button" class="btn ghost" data-cancel>취소</button>' : ''}
        <button class="btn pink">${parentId ? '답글 등록' : '댓글 등록'}</button>
      </div>
    </form>`;
  }

  function bindCommentForm(form) {
    const ta = form.querySelector('textarea');
    const count = form.querySelector('.count');
    ta.oninput = () => (count.textContent = `${ta.value.length} / 1000`);
    const cancel = form.querySelector('[data-cancel]');
    if (cancel) cancel.onclick = () => form.remove();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const btn = form.querySelector('.btn.pink');
      btn.disabled = true;
      try {
        rememberIdentity(fd.get('nick'), fd.get('password'));
        current = await api(`/posts/${current.id}/comments`, {
          method: 'POST',
          body: {
            nick: fd.get('nick'),
            password: fd.get('password'),
            body: fd.get('body'),
            parentId: form.dataset.parent ? Number(form.dataset.parent) : null,
          },
        });
        const scroll = view.scrollTop;
        drawPost();
        view.scrollTop = scroll;
        const last = current.comments[current.comments.length - 1];
        document.getElementById('c' + last.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        toast('댓글이 등록되었습니다');
      } catch (err) {
        toast(err.message);
        btn.disabled = false;
      }
    };
  }

  function rememberIdentity(nick, password) {
    nick = String(nick || '').trim();
    if (nick && nick !== state.nick) {
      state.nick = nick;
      store.set('nick', nick);
      $('#nickLabel').textContent = nick;
    }
    state.password = String(password || '');
    store.set('password', state.password);
  }

  // 상세 화면 클릭 처리 (추천/메뉴)
  view.addEventListener('click', async (e) => {
    const voteBtn = e.target.closest('[data-vote]');
    if (voteBtn && current) {
      const { vote, kind, id } = voteBtn.dataset;
      try {
        if (kind === 'post') {
          const res = await api(`/posts/${current.id}/vote`, { method: 'POST', body: { type: vote } });
          Object.assign(current, { up: res.up, down: res.down, myVote: res.myVote });
        } else {
          current = await api(`/posts/${current.id}/comments/${id}/vote`, { method: 'POST', body: { type: vote } });
        }
        const scroll = view.scrollTop;
        drawPost();
        view.scrollTop = scroll;
      } catch (err) {
        toast(err.message);
      }
      return;
    }

    const menuBtn = e.target.closest('[data-menu]');
    closeMenus();
    if (menuBtn && current) {
      e.stopPropagation();
      const target = menuBtn.dataset.menu;
      const isPost = target === 'post';
      const menu = document.createElement('div');
      menu.className = 'menu';
      menu.innerHTML = isPost
        ? '<button type="button" data-act="copy">링크 복사</button><button type="button" class="danger" data-act="delete">글 삭제</button>'
        : '<button type="button" data-act="reply">답글 달기</button><button type="button" class="danger" data-act="delete">댓글 삭제</button>';
      menuBtn.parentElement.appendChild(menu);
      menu.onclick = (ev) => {
        const act = ev.target.closest('[data-act]')?.dataset.act;
        ev.stopPropagation();
        closeMenus();
        if (!act) return;
        if (isPost) postAction(act);
        else commentAction(act, Number(target.slice(1)));
      };
    }
  });
  document.addEventListener('click', closeMenus);
  function closeMenus() {
    document.querySelectorAll('.menu').forEach((m) => m.remove());
  }

  async function postAction(act) {
    if (act === 'copy') {
      const url = location.origin + location.pathname + '#/p/' + current.id;
      try { await navigator.clipboard.writeText(url); toast('링크를 복사했습니다'); }
      catch { toast(url); }
      return;
    }
    const pw = await ask({ title: '글 삭제', desc: '글을 쓸 때 정한 비밀번호를 입력하세요.', type: 'password', value: state.password, ok: '삭제' });
    if (pw == null) return;
    try {
      await api(`/posts/${current.id}`, { method: 'DELETE', body: { password: pw } });
      toast('글이 삭제되었습니다');
      location.hash = '#/b/' + current.category;
    } catch (err) {
      toast(err.message);
    }
  }

  async function commentAction(act, cid) {
    if (act === 'reply') {
      const slot = view.querySelector(`[data-reply-slot="${cid}"]`);
      if (slot.firstChild) return;
      slot.innerHTML = `<div class="reply-box">${commentForm(cid)}</div>`;
      const form = slot.querySelector('form');
      bindCommentForm(form);
      form.querySelector('textarea').focus();
      return;
    }
    const pw = await ask({ title: '댓글 삭제', desc: '댓글을 쓸 때 정한 비밀번호를 입력하세요.', type: 'password', value: state.password, ok: '삭제' });
    if (pw == null) return;
    try {
      current = await api(`/posts/${current.id}/comments/${cid}`, { method: 'DELETE', body: { password: pw } });
      const scroll = view.scrollTop;
      drawPost();
      view.scrollTop = scroll;
      toast('댓글이 삭제되었습니다');
    } catch (err) {
      toast(err.message);
    }
  }

  // ---------- 글쓰기 화면 ----------
  function renderWrite({ cat }) {
    renderDrawer('');
    setTitle('글쓰기');
    const usable = visibleCats();
    let category = usable.some((c) => c.id === cat) ? cat : 'general';

    view.innerHTML = `
      <article class="detail write">
        <div class="detail-head">
          <h2><img src="assets/ghost.svg" alt="" width="30"> 새 글 쓰기</h2>
          <button type="button" class="back-btn" id="btnBack" aria-label="뒤로">${icon.back}</button>
        </div>
        <form class="form" id="writeForm">
          <div class="label">말머리</div>
          <div class="chips" id="catChips"></div>
          <div class="cat-desc" id="catDesc"></div>
          <input class="field" name="adminPassword" type="password" maxlength="64" placeholder="관리자 비밀번호 (공지 작성용)" hidden>
          <input class="field" name="title" maxlength="80" placeholder="제목" required>
          <textarea class="field" name="body" maxlength="5000" placeholder="내용을 입력하세요. 익명성은 보장됩니다(아마도)." style="min-height:200px" required></textarea>
          <div class="label">이미지 (최대 4장 · 본문에 붙여넣기 가능)</div>
          <div class="img-picker" id="imgPicker"></div>
          <div class="label">스포일러 (선택)</div>
          <textarea class="field" name="spoiler" maxlength="2000" placeholder="'스포일러 보기'를 눌러야 보이는 내용" style="min-height:60px"></textarea>
          <div class="form-row">
            <input class="field" name="nick" maxlength="20" placeholder="닉네임" value="${esc(state.nick)}" required>
            <input class="field" name="password" type="password" maxlength="64" placeholder="비밀번호 (삭제용)" value="${esc(state.password)}" required>
          </div>
          <div class="form-actions">
            <span class="count" id="bodyCount">0 / 5000</span>
            <button type="button" class="btn ghost" id="btnCancel">취소</button>
            <button class="btn pink" id="btnSubmit">등록</button>
          </div>
        </form>
      </article>`;

    const drawChips = () => {
      $('#catChips').innerHTML = usable
        .map((c) => `<button type="button" class="chip${c.id === category ? ' on' : ''}" data-cat="${esc(c.id)}"><span class="dot" style="background:${esc(c.color)}"></span>${esc(c.name)}</button>`)
        .join('');
      const cur = usable.find((c) => c.id === category);
      $('#catDesc').textContent = cur?.desc || '';
      const admin = $('#writeForm [name=adminPassword]');
      admin.hidden = !cur?.admin;
      admin.required = !!cur?.admin;
    };
    drawChips();
    $('#catChips').onclick = (e) => { const b = e.target.closest('[data-cat]'); if (b) { category = b.dataset.cat; drawChips(); } };

    // 첨부 이미지 (File 객체) — 등록할 때 줄여서 보낸다
    const files = [];
    const drawPicker = () => {
      for (const el of $('#imgPicker').querySelectorAll('img')) URL.revokeObjectURL(el.src);
      $('#imgPicker').innerHTML = files
        .map((f, i) => `<div class="img-item"><img src="${URL.createObjectURL(f)}" alt=""><button type="button" data-remove="${i}" aria-label="이미지 빼기">×</button></div>`)
        .join('') + (files.length < MAX_IMAGES
        ? `<label class="img-add" title="이미지 추가">${icon.image}<span>${files.length}/${MAX_IMAGES}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden></label>`
        : '');
      const input = $('#imgPicker input');
      if (input) input.onchange = () => { addFiles(input.files); };
    };
    const addFiles = (list) => {
      for (const f of list) {
        if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) { toast('jpg, png, webp, gif만 올릴 수 있어요'); continue; }
        if (files.length >= MAX_IMAGES) { toast(`이미지는 ${MAX_IMAGES}장까지예요`); break; }
        files.push(f);
      }
      drawPicker();
    };
    $('#imgPicker').onclick = (e) => {
      const b = e.target.closest('[data-remove]');
      if (b) { files.splice(Number(b.dataset.remove), 1); drawPicker(); }
    };
    drawPicker();

    const form = $('#writeForm');
    form.body.addEventListener('paste', (e) => {
      const pasted = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
      if (pasted.length) { e.preventDefault(); addFiles(pasted); }
    });
    form.body.oninput = () => ($('#bodyCount').textContent = `${form.body.value.length} / 5000`);
    const leave = () => (history.length > 1 ? history.back() : (location.hash = '#/'));
    $('#btnBack').onclick = leave;
    $('#btnCancel').onclick = leave;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const btn = $('#btnSubmit');
      btn.disabled = true;
      try {
        rememberIdentity(fd.get('nick'), fd.get('password'));
        let images = [];
        if (files.length) {
          btn.textContent = '이미지 처리 중…';
          images = await Promise.all(files.map(prepareImage));
        }
        btn.textContent = '등록 중…';
        const post = await api('/posts', {
          method: 'POST',
          body: {
            category,
            title: fd.get('title'),
            body: fd.get('body'),
            spoiler: fd.get('spoiler'),
            adminPassword: fd.get('adminPassword') || undefined,
            nick: fd.get('nick'),
            password: fd.get('password'),
            images,
          },
        });
        markRead(post.id);
        toast('글이 등록되었습니다');
        location.replace('#/p/' + post.id);
      } catch (err) {
        toast(err.message);
        btn.disabled = false;
        btn.textContent = '등록';
      }
    };
    form.title.focus();
  }

  // ---------- 이미지 줄이기 ----------
  const MAX_IMAGES = 4;
  const canWebp = (() => {
    try { return document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp'); } catch { return false; }
  })();

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없어요')); };
      img.src = url;
    });
  }

  function encode(img, maxSide, quality) {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!canWebp) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(canWebp ? 'image/webp' : 'image/jpeg', quality);
  }

  const dataUrlBytes = (u) => Math.floor((u.length - u.indexOf(',') - 1) * 0.75);

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('이미지를 읽을 수 없어요'));
      r.readAsDataURL(file);
    });
  }

  // 원본은 긴 변 1600px, 미리보기용 썸네일은 480px로 줄인다. 움직이는 GIF는 작으면 그대로 보낸다
  async function prepareImage(file) {
    const img = await loadImage(file);
    let full;
    if (file.type === 'image/gif' && file.size <= 3.5 * 1024 * 1024) full = await readAsDataUrl(file);
    else {
      full = encode(img, 1600, 0.85);
      if (dataUrlBytes(full) > 3.5 * 1024 * 1024) full = encode(img, 1200, 0.7);
    }
    let thumb = encode(img, 480, 0.8);
    if (dataUrlBytes(thumb) > 380 * 1024) thumb = encode(img, 320, 0.6);
    return { full, thumb, w: img.naturalWidth, h: img.naturalHeight };
  }

  // ---------- 아카라이브식 미리보기 ----------
  // 글 줄에 마우스를 올리거나 손가락을 대면, 그 줄 왼쪽 아래에 정사각형 썸네일을 붙여서 띄운다
  const preview = $('#preview');
  let previewCard = null;

  function placePreview(card) {
    const r = card.getBoundingClientRect();
    const size = preview.offsetHeight;
    const pad = 8;
    let top = r.bottom - 14;
    if (top + size > innerHeight - pad) top = r.top - size + 14; // 아래 공간이 없으면 위로
    preview.style.left = Math.max(pad, Math.min(r.left + 10, innerWidth - preview.offsetWidth - pad)) + 'px';
    preview.style.top = Math.max(pad, top) + 'px';
  }

  function showPreview(card) {
    if (previewCard && previewCard !== card) previewCard.classList.remove('previewing');
    previewCard = card;
    card.classList.add('previewing');
    const img = preview.querySelector('img');
    const count = Number(card.dataset.count) || 1;
    const badge = preview.querySelector('.preview-count');
    badge.textContent = `+${count - 1}`;
    badge.hidden = count < 2;
    if (img.getAttribute('src') !== card.dataset.thumb) img.src = card.dataset.thumb;
    preview.hidden = false;
    placePreview(card);
  }

  function hidePreview() {
    previewCard?.classList.remove('previewing');
    previewCard = null;
    preview.hidden = true;
  }

  // PC: 마우스를 올리면 바로
  view.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const card = e.target.closest('.post-card[data-thumb]');
    if (card && card !== previewCard) showPreview(card);
  });
  view.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse' || !previewCard) return;
    if (!previewCard.contains(e.relatedTarget)) hidePreview();
  });

  // 휴대폰: 손가락을 대고 있으면 뜨고, 떼거나 스크롤하면 사라진다. 짧게 누르면 그대로 글이 열린다
  let pressTimer = null;
  let pressStart = null;
  let suppressClick = false;
  view.addEventListener('touchstart', (e) => {
    const card = e.target.closest('.post-card[data-thumb]');
    if (!card || e.touches.length > 1) return;
    const t = e.touches[0];
    pressStart = { x: t.clientX, y: t.clientY, at: Date.now() };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => showPreview(card), 120); // 스크롤하려고 스치는 손가락에는 안 뜨게 살짝 기다린다
  }, { passive: true });
  view.addEventListener('touchmove', (e) => {
    if (!pressStart) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - pressStart.x, t.clientY - pressStart.y) > 10) {
      clearTimeout(pressTimer);
      pressStart = null;
      hidePreview();
    }
  }, { passive: true });
  const endPress = () => {
    clearTimeout(pressTimer);
    // 오래 눌러서 미리보기만 본 경우에는 손을 뗄 때 글이 열리지 않게 한다
    if (pressStart && previewCard && Date.now() - pressStart.at > 500) suppressClick = true;
    pressStart = null;
    setTimeout(hidePreview, suppressClick ? 0 : 150);
  };
  view.addEventListener('touchend', endPress);
  view.addEventListener('touchcancel', endPress);
  view.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); }
  }, true);
  view.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.post-card[data-thumb]') && e.pointerType !== 'mouse' && !matchMedia('(hover: hover)').matches) e.preventDefault();
  });
  view.addEventListener('scroll', hidePreview, { passive: true });

  // ---------- 라우터 ----------
  function route() {
    hidePreview();
    openDrawer(false);
    closeMenus();
    const hash = location.hash.slice(1) || '/';
    const [path, query] = hash.split('?');
    const params = new URLSearchParams(query || '');
    const parts = path.split('/').filter(Boolean);

    if (parts[0] === 'p' && parts[1]) return renderPost(Number(parts[1]));
    current = null;
    if (parts[0] === 'write') return renderWrite({ cat: params.get('cat') });
    if (parts[0] === 'b' && parts[1]) return renderList({ cat: parts[1] });
    if (parts[0] === 'search') return renderList({ q: params.get('q') || '' });
    return renderList({});
  }

  // ---------- 전역 이벤트 ----------
  $('#btnSearch').onclick = () => {
    const open = !$('.topbar').classList.contains('search-open');
    $('.topbar').classList.toggle('search-open', open);
    if (open) $('#searchInput').focus();
  };

  $('#searchForm').onsubmit = (e) => {
    e.preventDefault();
    const q = $('#searchInput').value.trim();
    location.hash = q ? '#/search?q=' + encodeURIComponent(q) : '#/';
  };

  $('#btnNick').onclick = async () => {
    const v = await ask({ title: '닉네임 바꾸기', desc: '다크넷에서 쓸 닉네임 (20자 이하)', value: state.nick, placeholder: '예: 건전한엘프명15T' });
    if (v == null) return;
    const nick = v.trim().slice(0, 20);
    if (!nick) return toast('닉네임을 입력해 주세요');
    state.nick = nick;
    store.set('nick', nick);
    $('#nickLabel').textContent = nick;
    toast('닉네임이 바뀌었습니다');
    if (current) drawPost();
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { openDrawer(false); closeMenus(); }
  });

  window.addEventListener('hashchange', route);

  // ---------- 시작 ----------
  $('#nickLabel').textContent = state.nick;
  renderAd();
  api('/categories')
    .then((cats) => { state.categories = cats; })
    .catch(() => toast('서버에 연결할 수 없습니다'))
    .finally(route);
})();
