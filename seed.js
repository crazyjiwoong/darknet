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
      category: 'info',
      nick: '무엇이든대답해드립니다',
      title: '엘리아스 침공전 때 다크넷 접속 안 됐던 이유',
      body: '그때 모나티엄 도시 자체가 초기화되면서 엘프넷 전산망이 통째로 내려갔음.\n다크넷도 그 위에 있어서 같이 날아갈 뻔했는데, 모나티엄 시스템이 복원되면서 다시 접속 가능해진 거.\n\n백업은 생활화합시다.',
      agoH: 24 * 60,
      up: 58,
      down: 2,
      views: 2100,
      comments: [
        comment('다크불릿', '…그때 진짜 식은땀 났다', 24 * 60 - 1, 44),
      ],
    },
    {
      category: 'ballfic',
      nick: '다크불릿',
      title: '[볼문학] 다크넷 개설 기념 첫 번째 볼문학',
      body: '태초에 볼이 있었다.\n그리고 그 볼은 말랑했다.\n\n— 다크넷 1번 글을 기념하며',
      agoH: 24 * 400,
      up: 120,
      down: 5,
      views: 5000,
      comments: [
        comment('이터널불릿', '이게 1번 글이라고…?', 24 * 400 - 2, 60),
      ],
    },
    {
      category: 'guide',
      nick: '탑스핀블레이드',
      title: '[공략] 리그 오브 엘프 브론즈 탈출 공략',
      body: '1. 미니맵을 보세요. 진짜로.\n2. 혼자 싸우러 들어가지 마세요.\n3. 지면 채팅 끄고 다음 판 하세요.\n4. 연패하면 오늘은 그만. 내일의 내가 더 잘함.\n\n이것만 지켜도 실버는 갑니다. 질문은 댓글로',
      agoH: 9,
      up: 24,
      down: 1,
      views: 300,
      comments: [
        comment('짱킹갓존재', '3번 못 지켜서 아직 브론즈임', 8, 17),
        comment('레볼루션10', '4번이 제일 어려움', 7, 8),
      ],
    },
    {
      category: 'meme',
      nick: 'IlilillIlIill',
      title: '다크넷 이름의 진실',
      images: [{ src: '/assets/seed/darknet-list.jpg', thumb: '/assets/seed/darknet-list_t.jpg', w: 1000, h: 566 }],
      body: '이름: 다크넷\n실제: 시장, 회장, 여왕까지 다 하는 라이트넷\n\n교주: "이젠 라이트넷이라고 불러야 되는 거 아니야?"\n\nVVVVVVVVVVVV',
      agoH: 4,
      up: 30,
      down: 2,
      views: 260,
      comments: [
        comment('언니여왕', '여왕이 누군데', 3, 22),
      ],
    },
    {
      category: 'info',
      nick: '다크불릿',
      title: '[정보] 다크넷 이용 수칙 (운영자 피셜)',
      body: '어둠의 계약에 응한 자들이여, 다음을 지켜라.\n\n1. 운영자(검고 검은 마스터 게시판 관리장)의 정체를 캐지 말 것\n2. 진압반 홈페이지 테러 인증글 금지\n3. 모나티엄 기밀 문서 유출 금지 (걸리면 나도 곤란함)\n4. 글 종류(말머리)를 꼭 골라서 쓸 것\n5. 악플러는 사이버 수사과에 넘긴다\n\n— 검고 검은 마스터 게시판 관리장',
      agoH: 200,
      up: 40,
      down: 3,
      views: 1500,
      comments: [
        comment('지나가던엘프', '줄여서 껌맛게장 ㅋㅋ', 199, 25),
        comment('이터널불릿', '언니… 아니 운영자님 3번은 본인 얘기 아님?', 198, 18),
      ],
    },
    {
      category: 'ballfic',
      nick: '소정의원고료',
      title: '[볼문학] 볼따구를 지키는 자들 1화',
      body: '"교주님, 오늘도 볼을 만지실 건가요?"\n\n에르핀이 경계하는 눈빛으로 물었다. 그 뒤로 사도들이 줄지어 볼을 가리고 서 있었다.\n\n"아니, 그냥 지나가던 길인데…"\n\n아무도 믿지 않았다.\n\n(2화는 원고료 받으면 씀)',
      agoH: 12,
      up: 33,
      down: 2,
      views: 410,
      comments: [
        comment('와구와구프린세스', '에르핀 볼은 소중하다', 11, 20),
        comment('언니여왕', '원고료 내가 줄 테니까 빨리 2화', 10, 14),
      ],
    },
    {
      category: 'info',
      nick: '스핑크스',
      title: '[정보] 다크넷 처음 온 엘프들을 위한 용어 정리',
      body: 'VVVV : 웃음 (ㅋㅋ랑 같음)\n껌맛게장 : 운영자. 검고 검은 마스터 게시판 관리장의 줄임말\n유동 : 닉 정해두지 않고 쓰는 사람 (ㅇㅇ)\n볼문학 : 볼따구가 나오는 팬 문학\n엘프넷 : 모나티엄 인트라넷. 감시당하니까 사적인 얘기는 여기서\n\n추가할 거 있으면 댓글로',
      agoH: 40,
      up: 27,
      down: 0,
      views: 620,
      comments: [
        comment('정직믿음신용', '엘튜브랑 엘스타그램도 추가해 주세요', 39, 6),
      ],
    },
    {
      category: 'meme',
      nick: '냥냥구루',
      title: '진압반 홈페이지 공지 문구 바뀐 거 봤냐 VVVVVVV',
      body: '"다크넷 접속을 자제해 주시기 바랍니다"\n\n근데 이 공지를 다크넷에서 보고 있음 VVVVVVVVV',
      agoH: 8,
      up: 41,
      down: 1,
      views: 530,
      comments: [
        comment('정의]무력진압[충성', '…', 7, 52),
        comment('땅콩이간다!', 'VVVVVVVVVVVV', 6, 9),
      ],
    },
    {
      category: 'general',
      nick: '근본생식가',
      title: '엘레강스 부띠끄 다녀옴',
      body: '옷 예쁘고 사장님 친절함.\n근데 붕대 감고 간 사람은 입구에서 조용히 돌려보내는 거 같았음…',
      agoH: 5,
      up: 12,
      down: 0,
      views: 140,
      comments: [],
    },
    {
      category: 'creative',
      nick: '샤인그레이프',
      title: '[창작] 꿈꾸는 포도 응원가 가사 써봄',
      body: '포도알 하나 꿈 하나\n무대 위에서 반짝 반짝\n샤인 샤인 그레이프\n오늘도 춤을 춰요\n\n곡은 아직 없음',
      agoH: 2,
      up: 9,
      down: 0,
      views: 70,
      comments: [],
    },
    {
      category: 'general',
      nick: '빅시스터',
      title: '위대한 시장 엘레나',
      body: '모나티엄을 이끄는 위대한 시장 엘레나 님을 찬양합시다.\n오늘도 엘프넷은 평화롭습니다.\n\n※ 이 글은 모나티엄 시청 공식 입장과 무관합니다(아마도).',
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
      category: 'general',
      nick: '건전한엘프명15T',
      title: '편의점 심야 알바',
      body: '심야 편의점 알바 하는데 새벽 3시에 이상한 손님이 와서 컵라면 물만 받아가고 그냥 갔음…\n이거 신고해야 됨?\n\n그리고 내 원래 닉네임 돌려줘라 껌맛게장아',
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
      category: 'question',
      nick: '지나가던엘프',
      title: '뭐 추천할 만한 영화 있어?',
      images: [{ src: '/assets/seed/darknet-movie.jpg', thumb: '/assets/seed/darknet-movie_t.jpg', w: 1000, h: 566 }],
      body: '요즘 화제인 추천 영화 있으면 알려줘.\n나도 문화생활이라는 걸 즐겨봐야지.',
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
      category: 'ballfic',
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
      category: 'general',
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
      category: 'question',
      nick: '빵집아니고마법학교입니다',
      title: '빵 굽는 마법 배울 수 있는 곳 아시는 분?',
      body: '갓 구운 빵 냄새가 나는 마법 학교가 있다던데 혹시 아시는 분…?\n(광고 아님)',
      agoH: 3,
      up: 5,
      down: 11,
      views: 64,
      comments: [
        comment('꽈배기', '닉네임에서 이미 답이 나왔는데요', 2.5, 9),
      ],
    },
    {
      category: 'general',
      nick: '쩐$땡겨드립니다※',
      title: '[채용] 엘리아스 킹짱 언더돌 매니저 보조 구함',
      body: '업무: 팬서비스 보조, 굿즈 판매\n급여: 성과급 (협의)\n우대: 키샤땅을 진심으로 사랑하는 분\n\n연락은 쪽지로.',
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
      images: p.images || [],
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
