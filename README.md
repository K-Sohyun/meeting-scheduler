# meeting-scheduler-app

친구·동료와 **일반/여행 모임 일정**을 빠르게 맞추는 모바일 우선 웹앱입니다.  
기술 스택은 **Next.js 16 (App Router)** + **Supabase** + **Tailwind CSS 4**를 사용합니다.

## 먼저 읽기

- **[PROJECT_GUIDE.md](./PROJECT_GUIDE.md)**  
  현재 구현(라우트, 쿠키, DB, 모임장 규칙, 일정 도메인, 파일 맵)을 가장 정확하게 정리한 문서입니다.  
  기능 수정 전에 먼저 읽어 주세요.

## 빠른 시작

```bash
npm install
```

프로젝트 루트에 `.env.local`을 만들고, 아래 값을 넣습니다.
(자세한 설명은 `PROJECT_GUIDE.md`의 환경 변수 섹션 참고)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `HOLIDAY_API_SERVICE_KEY` (공휴일 기능을 쓸 때만 필요)

개발 서버 실행:

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

검증 커맨드:

```bash
npm run build
npm run lint
```

## Supabase

스키마(`creator_claim_token` 포함)와 운영 체크리스트는  
`PROJECT_GUIDE.md`의 DB/Supabase 섹션을 기준으로 적용해 주세요.  
(`PROJECT_GUIDE.md`에 SQL Editor에서 바로 실행할 쿼리를 함께 적어두었습니다.)

## Next.js

이 프로젝트는 Next 16 기반이라, 구현 시 아래 문서를 우선 참고합니다.

- 로컬 문서: `node_modules/next/dist/docs`
- 공식 문서: [nextjs.org/docs](https://nextjs.org/docs)

---

배포 대상은 기본적으로 [Vercel](https://vercel.com)을 가정합니다.
