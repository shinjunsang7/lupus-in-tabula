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
