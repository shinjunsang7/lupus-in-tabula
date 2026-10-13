# Lupus In Tabula v0.8 — Online Multiplayer

## 변경사항
- 낮 기본 토론 2분, 생존자별 낮마다 1회 1분 연장
- 공표 작성자별 색상 6종 및 글씨 크기 4종 선택
- 공표 게시판의 가독성 개선, 플레이어당 최신 글 한 개 유지
- 채팅 로그 영역 확대 (PC 380px, 모바일 300px)
- 이전 v0.7 기능 유지

## 로컬 실행
`npm install` 후 `npm start`

## 실제 웹사이트 배포: Render Web Service
1. ZIP의 lupus-online 폴더 내용을 GitHub 저장소의 최상위에 업로드합니다.
2. Render에서 New > Web Service > Git Provider로 해당 저장소를 연결합니다.
3. Runtime Node, Build Command `npm install`, Start Command `npm start`를 설정합니다.
4. Health Check Path `/health`, 인스턴스 1개로 설정합니다.
5. 배포 완료 후 제공되는 https://...onrender.com 주소를 친구들에게 공유합니다.

**주의**: 게임 방은 서버 메모리에만 저장됩니다. 서버 재시작/재배포/절전 시 방이 초기화되며, 서버를 여러 인스턴스로 확장하면 방이 분산되어 작동하지 않습니다. 실서비스 이전에 영속 저장 및 재접속 기능 보강이 필요합니다.

## v0.9 변경사항
- 플레이어 채팅은 `번호번 닉네임`으로 표시, 시스템 안내는 SYSTEM 유지
- Chaos 규칙에서 Saved / For honor 소리와 보호 원인 공개 제거
- Chaos 규칙에서 공격 미실행/보호/퇴역군인 생존 모두 동일한 무사망 메시지
- 낮 토론 기본 시간 안내를 2분으로 정정

Version 1.0: Header shows v1.0 and subtitle is simplified.


## v1.1
Lobby chat before games and after game over; in-game all chat during day. Separate chat histories across rounds.


## v1.2
Fix player chat labels: number + beon + nickname, no trailing beon after nickname; SYSTEM stays SYSTEM.


## v1.3
Fix chat sender display: server sends complete sender label; client renders it unchanged, no extra suffix. SYSTEM stays SYSTEM.


## v1.4 업데이트
- 토론 시간 연장: 120초가 아닌 정확히 60초 추가.
- 개인 메모 위에 게임 규칙 / 직업 설명 탭을 추가했습니다.
- 투표 마감 동의는 투표권과 독립적으로 기록되며, 모두 동의했더라도 미행사 투표권이 있으면 투표를 종료하지 않습니다.
- 라이브 투표 현황에 마감 동의 인원 표시.
- 직업 표시 이름 '광신도'를 '마녀'로 변경 (내부 role key `fanatic`은 호환성 유지를 위해 그대로).
- 실제 운영 웹사이트는 GitHub 커밋과 Render 배포가 필요합니다.


## v1.5
- 생존자 전원이 마감 동의하면 투표 미행사자 유무와 관계없이 즉시 집계하고 10초 후 밤으로 전환합니다.
- 전원 투표/기권 역시 즉시 집계하고 10초 후 밤으로 전환합니다.
- 라이브 투표 현황에 마감 동의 인원과 진행률 막대를 표시합니다.
- 게임 규칙과 직업 설명 도움말을 사용자가 제공한 상세 내용으로 대체했습니다.
- 전원 마감으로 낮이 끝난 경우 미행사 투표권은 소멸합니다.


## v1.6
- 개인 직업 정보 상세 설명
- 투표/기권 후 30초간 마감 동의 비활성화
- 라이브 투표 현황에 기권 표 및 진행 막대 표시

## v1.7 — 후계자 계승 능력 수정
- 후계자가 마녀를 계승했을 때 투표로 처형되면 최초 투표자가 함께 사망하도록 수정 (`activeRole` 적용).
- 후계자가 퇴역군인을 계승했을 때 일반 공격 1회 생존 능력을 적용하도록 수정 (`activeRole` 적용). 참살은 여전히 생존 불가.
- 예언자, 보디가드, 추격자, 영매, 감시자 계승 경로를 코드에서 확인했으며, 후계자 관련 자동 회귀 테스트 7건을 통과했습니다.
- 주의: 자동 테스트는 실제 여러 브라우저에서 진행한 멀티플레이 테스트를 대신하지 않습니다.

## v1.8
- 마감 동의 후 투표/기권 시 해당 플레이어의 마감 동의 자동 취소
- 투표/기권 후 30초 재동의 제한 유지, 서버 상태에 즉시 반영

## v2.0 — HD-2D scene prototype
- Upgraded to a cinematic, painterly HD-2D village backdrop based on the approved concept art.
- Larger canvas, highlighted players with colored numbered nameplates, gold halo for yourself, minimap, dialogue bubbles, corpse sprites, day/night grading.
- Click-to-move and network movement continue to use the existing v1.9 server protocol.
- IMPORTANT: The scene artwork is a **concept-art composite**. Some small static figures and scenery labels are baked into the image and are not live players. Live players are identified by their glowing rings and numbered nameplates. A clean layered environment and separately animated sprites are a future asset-production task.

## v2.1 — 움직이는 캐릭터 그래픽 업데이트
- `public/village_clean.jpg`: 이전 배경에 고정되어 있던 인물과 이름표를 제거한 배경(일부 보정 흔적 있음).
- `public/village_characters.png`: 번호별 의상 색상이 게임 내 번호 색상과 일치하는 11인용 픽셀 캐릭터 시트. 앞/뒤/좌/우 4방향, 방향별 4프레임 걷기 애니메이션.
- `public/village.js`: 스프라이트 애니메이션, 마우스 클릭 이동, 분수대 이동 방지, 전체 채팅 말풍선, 사망 연출, 밤 조명, 미니맵.
- `public/preview_village.html`: 11명으로 화면을 확인하는 그래픽 전용 미리보기. 실제 게임의 역할/투표 로직을 대체하지 않음.
- 기존 직업, 투표, 메모, 공표, 채팅 및 서버 룰은 유지함.
- 그래픽은 기존 HD-2D 시안을 바탕으로 한 개선판이며, 시안과 동일한 수준의 고급 스프라이트 일러스트는 아직 아님.


## v2.2
- 고정 인물과 이름표가 전혀 없는 새 HD-2D 마을 배경으로 교체
- 접속한 플레이어만 별도 스프라이트로 생성/제거
- 기존 4방향 걷기 애니메이션과 번호별 의상 색상 유지, 그림자/캐릭터 표시 강화
- 낮/밤 조명, 전체 채팅 말풍선, 투표/직업 등 기존 기능 유지


## v2.3
- 마을 이동 가능 범위를 확대하고 분수대 주변 충돌 시 가장자리를 따라 이동하도록 개선
- 클릭 위치가 장애물 내부여도 가장 가까운 접근 가능한 위치로 안내
- 80×112 픽셀의 세밀한 4방향×4프레임 캐릭터 시트 추가 (`public/village_characters_hd.png`)
- 기존 배경 이미지 변경 없음; 플레이어 번호 색상과 의상 색상 일치


## v2.4 visual update
- Crisp multiline high-contrast public chat bubbles, thick colored border and strong shadow.
- 160x224 pixel 4-direction/4-frame character sheet with new fine pixel details, same 11 player colors.
- Nighttime characters receive separate dim/cool grading without modifying the town background.
- All game rules, movement, voting, chat and server state logic unchanged.

## v2.5: 2턴제 진행 및 정밀 캐릭터 패치
- 기본(2턴제)/혼란(2턴제): 첫 번째 밤(60초) → 10초 짧은 낮(투표·기권·마감동의·시간연장 불가) → 두 번째 밤(60초) → 세 번째 날 일반 낮(120초).
- 짧은 낮에도 일반 채팅 및 마우스 이동은 허용하며, 투표 기능은 서버와 클라이언트 양쪽에서 차단.
- 기존 160×224px 4방향×4프레임 스프라이트에 픽셀 단위의 머리카락 결, 눈, 옷 자수, 허리 장식, 신발 디테일 추가.
- 배경과 기존 게임의 다른 기능은 변경하지 않음.

## v2.6
- 방에 입장하지 않은 모든 웹사이트 방문자가 이용할 수 있는 사이트 전체 채팅 추가 (최대 최근 100개 메시지, 서버 메모리 저장).
- 방에 입장하면 사이트 전체 채팅이 자동으로 숨겨지고 해당 방의 대화만 보임.
- 게임 시작 전 대기실에서도 마을 클릭 이동과 전체 채팅 말풍선 사용 가능.
- 서버가 이동과 사이트 전체 채팅의 입장 상태를 검증함.

## v2.7
- 웹사이트 전체 채팅은 방 대기실과 게임 종료 후에도 이용 가능. 게임 중에는 숨김 및 서버 전송 제한.
- 방 대기실에서는 웹사이트 전체 채팅과 방 전용 채팅을 별도 창에 동시 표시.
- 현재 웹사이트 연결 수, 닉네임, 웹사이트/방 대기/게임 중 상태를 실시간 표시.
- 접속자 수는 Socket.IO 연결 기준으로 집계하며 브라우저 탭별로 계산.


## v2.8
- 접속자 목록을 데스크톱 화면 오른쪽 사이드바로 이동. 작은 화면에서는 본문 아래로 이동.
- 별도 웹사이트 전체 대화 패널을 제거하고 기존 대화창에 웹 로비/게임 로비 탭으로 통합.
- 게임 시작 전에는 두 탭을 자유롭게 전환, 게임 중에는 웹 로비 탭을 숨기고 게임 방 채팅만 표시.
- 서버 프로토콜은 v2.7과 동일.

## v2.9 — 게임 로비 채팅 복구
- 방 입장 전 웹 로비 탭만 표시.
- 방 입장 후, 게임 시작 전/종료 후 웹 로비와 게임 로비 두 탭을 한 채팅창에 표시.
- 게임 진행 중 전체/동맹/귓속말/유령 탭 표시, 웹 로비 숨김.
- v2.8에서 방 입장 전 숨긴 게임 로비 탭을 방 입장 후 복구하지 않아 채팅이 불가능하던 UI 버그 수정.
- 접속자 목록 오른쪽 배치 및 기존 서버/게임 규칙 유지.
