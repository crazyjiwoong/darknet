// 처음 실행할 때 들어가는 예시 글 (나무위키 다크넷 문서 + 게임 화면 참고)
const crypto = require('node:crypto');

// 시드 글은 아무도 비밀번호를 모르게 무작위 해시를 넣는다
function lockedPw() {
  return `${crypto.randomBytes(8).toString('hex')}:${crypto.randomBytes(32).toString('hex')}`;
}

function fakeVoters(n, tag) {
  return Array.from({ length: n }, (_, i) => `seed-${tag}-${i}`);
}

module.exports = function seed(nextId) {
  const now = Date.now();
  const H = 3.6e6;
  let tag = 0;

  const comment = (nick, body, agoH, up = 0, children = []) => ({ nick, body, agoH, up, children });

  const posts = [
    {
      category: 'daily',
      nick: '빅시스터',
      title: '위대한 시장 엘레나',
      body: '모나티엄을 이끄는 위대한 시장 엘레나 님을 찬양합시다.\n오늘도 엘프넷은 평화롭습니다.\n\n※ 이 글은 모나티엄 시청 공식 입장과 무관합니다(아마도).',
      reward: 'gold',
      agoH: 30,
      up: 2,
      down: 9,
      views: 120,
      comments: [
        comment('지나가던엘프', '빅시스터… 닉네임부터 수상한데', 29, 4),
        comment('엘레나님최고', '엘레나 시장님 최고!! 엘레나 시장님 최고!!', 28, 1, [
          comment('IlilillIlIill', '알바 냄새 오지고요 VVVVVVV', 27, 6),
        ]),
        comment('익명의엘프', '또 시장님 글이네', 26),
        comment('신경질적인엘프', '이런 글은 인트라넷에나 쓰라고', 25, 3),
        comment('MONATI27899', '[자동 응답] 위대한 시장님에 대한 긍정적인 반응 감사합니다.', 24),
      ],
    },
    {
      category: 'daily',
      nick: '건전한엘프명15T',
      title: '편의점 심야 알바',
      body: '심야 편의점 알바 하는데 새벽 3시에 이상한 손님이 와서 컵라면 물만 받아가고 그냥 갔음…\n이거 신고해야 됨?\n\n그리고 내 원래 닉네임 돌려줘라 껌맛게장아',
      reward: 'drink',
      agoH: 20,
      up: 49,
      down: 6,
      views: 340,
      comments: [
        comment('다크불릿', '후후… 어둠의 손님이 강림했군. 그건 신고 대상이 아니다.', 19, 2, [
          comment('건전한엘프명15T', '닉 바꾼 범인은 조용히 해', 18, 31),
        ]),
        comment('냥냥구루', '컵라면 물 리필은 국룰 아님?', 17, 5),
        comment('땅콩이간다!', '나도 심야 알바 해봤는데 진짜 별 사람 다 옴', 16, 7),
        comment('와구와구프린세스', '컵라면 먹고 싶어졌다', 15, 12),
        comment('정의]무력진압[충성', '수상한 인물이면 사이버 수사과로 제보 바랍니다.', 14, 3),
      ],
    },
    {
      category: 'curious',
      nick: '지나가던엘프',
      title: '뭐 추천할 만한 영화 있어?',
      body: '요즘 화제인 추천 영화 있으면 알려줘.\n나도 문화생활이라는 걸 즐겨봐야지.',
      reward: 'drink',
      spoiler: '결말: 엘레나 시장님이 모나티엄을 구한다.\n(1편부터 7편까지 전부 같은 결말)',
      agoH: 6,
      up: 14,
      down: 1,
      views: 88,
      comments: [
        comment('엘레나님최고', '「모나티엄의 부흥기 ~엘레나 시장님의 위대한 선택~」을 보세요.', 5.5, 1, [
          comment('지나가던엘프', '그거 3시간 동안 시장 찬양만 하는 졸린 영화잖아. 속았다…', 5, 5),
        ]),
        comment('고스쉐리', '고딕 호러 추천. 「검은 성의 장미」 강추', 4, 3),
        comment('반투명드래곤', '드래곤 나오는 거면 다 좋아', 3),
      ],
    },
    {
      category: 'novel',
      nick: '다크불릿',
      title: '[연재] 칠흑의 군주와 봉인된 오른팔 — 제13화',
      body: '크윽… 오른팔이 또 날뛰기 시작했다.\n"물러서라, 이 힘은 너희가 감당할 수 있는 것이 아니다…!"\n\n칠흑의 군주는 그렇게 말하며 붕대를 고쳐 맸다.\n\n(다음 화에 계속)\n\n※ 악플 달면 사이버 수사과에 신고합니다',
      agoH: 50,
      up: 8,
      down: 22,
      views: 210,
      comments: [
        comment('이터널불릿', '언니 이거 언제 끝나?', 49, 15),
        comment('완벽한고스트', '13화까지 봉인만 하고 있음', 48, 9),
        comment('소정의원고료', '원고료는 언제 주시나요', 47, 4),
      ],
    },
    {
      category: 'ad',
      nick: '엘레강스부띠끄',
      title: '[엘레강스 부띠끄] 가을 신상 입고! 다크넷 회원 10% 할인',
      body: '엘레강스 부띠끄에서 가을 신상이 입고되었습니다.\n다크넷 보고 왔다고 말씀하시면 10% 할인해 드려요.\n\n※ 붕대, 안대, 검은 망토 계열 상품은 취급하지 않습니다.',
      agoH: 10,
      up: 21,
      down: 2,
      views: 150,
      comments: [
        comment('다크불릿', '왜 우리 취향만 콕 집어서 빼는 건데', 9, 18),
      ],
    },
    {
      category: 'qna',
      nick: '빵집아니고마법학교입니다',
      title: '빵 굽는 마법 배울 수 있는 곳 아시는 분?',
      body: '갓 구운 빵 냄새가 나는 마법 학교가 있다던데 혹시 아시는 분…?\n(광고 아님)',
      reward: 'bread',
      agoH: 3,
      up: 5,
      down: 11,
      views: 64,
      comments: [
        comment('꽈배기', '닉네임에서 이미 답이 나왔는데요', 2.5, 9),
      ],
    },
    {
      category: 'jobs',
      nick: '쩐$땡겨드립니다※',
      title: '[채용] 엘리아스 킹짱 언더돌 매니저 보조 구함',
      body: '업무: 팬서비스 보조, 굿즈 판매\n급여: 성과급 (협의)\n우대: 키샤땅을 진심으로 사랑하는 분\n\n연락은 쪽지로.',
      reward: 'gold',
      agoH: 1,
      up: 3,
      down: 0,
      views: 22,
      comments: [],
    },
  ];

  const db = { seq: 0, posts: [] };
  for (const p of posts) {
    const id = nextId();
    const createdAt = now - p.agoH * H;
    const flat = [];
    const addComments = (list, parentId) => {
      for (const c of list) {
        const cid = nextId();
        flat.push({
          id: cid,
          parentId,
          nick: c.nick,
          pw: lockedPw(),
          body: c.body,
          createdAt: now - c.agoH * H,
          up: fakeVoters(c.up, ++tag),
          down: [],
        });
        addComments(c.children, cid);
      }
    };
    addComments(p.comments, null);
    db.posts.push({
      id,
      category: p.category,
      title: p.title,
      body: p.body,
      nick: p.nick,
      pw: lockedPw(),
      spoiler: p.spoiler || '',
      reward: p.reward || '',
      createdAt,
      views: p.views,
      up: fakeVoters(p.up, ++tag),
      down: fakeVoters(p.down, ++tag),
      comments: flat,
    });
  }
  db.seq = nextId();
  return db;
};
