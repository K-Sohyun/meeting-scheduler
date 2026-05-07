# 프로젝트 가이드 (현재 구현)

이 프로젝트는 친구들과 **일반/여행 모임 일정**을 빠르게 맞추기 위한 모바일 우선 웹앱입니다.  
기술 스택은 **Next.js App Router + Supabase + Tailwind CSS 4**를 사용합니다.

이 문서는 “지금 코드가 실제로 어떻게 동작하는지”를 한 번에 파악하기 위한 기준 문서예요.

**권장 읽기 순서:** 환경 변수 → 라우트/쿼리 → 쿠키 → DB → 도메인 → 소스 맵

---

## 1. 전체 개요

### 사용자 흐름
- 방 생성 (`/rooms/new` → `POST /rooms/new/create`) 후 `/rooms?created=...` 이동, 이때 개설자 쿠키 발급
- `/rooms`에서 방 선택 → `/rooms/[roomId]` 진입 (비밀번호 방은 먼저 잠금 해제)
- 닉네임 참여 (`POST /rooms/[roomId]/join`) → 참가 쿠키 설정 후 기본 상세 화면(`joined=1` 등)에서 참여자·추천 확인 → `내 캘린더 열기`로 `?view=calendar` 진입
- `?view=calendar`에서 일정 입력(`best`/`ok`) 후 저장
- 상세 화면에서 참여자/추천 일정 확인, 방장은 마감·픽스·삭제 관리 가능

### UI 규칙
- 모바일 우선: `max-w-[480px]`, `min-h-dvh` · 상단 pill 내비(`홈` / `방 리스트`) · 라우트 전환 시 `app/loading.tsx`
- 피드백: 성공(초록) / 안내·정보(보라) / 에러(빨강) / 중립(회색). 완료형(방 생성·삭제·캘린더 저장)은 하단 토스트, 캘린더 저장은 초록 배너 + 토스트, 확정 일정은 상단 초록 안내
- 제출(방 생성·참여): 진행 중 비활성 + 스피너
- 방 목록·상세: 비밀번호 방은 유형 옆 `🔒` · 목록 `max-h-[min(60dvh,26rem)] overflow-y-auto` · 마감+픽스된 방은 회색 `일정이 확정된 방` · 삭제 후 `/rooms?deleted=1` 토스트 1회 후 쿼리 제거
- 마감 후 캘린더 읽기 전용 문구는 회색 중립 톤

---

## 2. 기술 스택 (package.json 기준)

| 구분 | 내용 |
|------|------|
| Next.js | 16.x (App Router) |
| React | 19.x |
| TypeScript | 5.x |
| Tailwind CSS | 4.x |
| Supabase | `@supabase/supabase-js` |
| 폼/검증 | `react-hook-form`, `@hookform/resolvers`, `zod` |
| 날짜 | `date-fns` |
| 린트 | `eslint`, `eslint-config-next` |

참고: Next 16은 변경 폭이 크므로 필요 시 `node_modules/next/dist/docs`를 우선 확인합니다.

---

## 3. 환경 변수

로컬은 루트에 `.env.local`을 사용합니다.

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 키(서버/브라우저 공통 클라이언트에서 사용) |
| `HOLIDAY_API_SERVICE_KEY` | 공휴일 API 키 (`/api/holidays`에서만 사용) |
| `NEXT_PUBLIC_APP_URL` (선택) | 공개 사이트 원점(커스텀 도메인 등). 미설정 시 `next dev`는 localhost, 그 외 프로덕션은 루트 `layout`에 적힌 기본 URL(`moyora-scheduler.vercel.app`)로 `metadataBase`를 잡는다(배포마다 바뀌는 `VERCEL_URL`은 og 이미지 URL에 쓰지 않음). |

---

## 4. 라우트 / 쿼리 / API

### 페이지 라우트
| 경로 | 설명 |
|------|------|
| `/` | 랜딩 |
| `/rooms/new` | 방 생성 폼 (`single` / `travel`) |
| `/rooms` | 방 목록 (`created`, `deleted=1` 완료 토스트 1회 노출 후 쿼리 정리) |
| `/rooms/[roomId]` | 방 상세 (참여, 참여자, 추천, 방장 관리, `view=calendar`) |
| `POST /rooms/new/create` | 방 생성 + `creator_claim_token` 저장 + 개설자 쿠키 발급 |
| `POST /rooms/[roomId]/join` | 참여 처리 + 참가 쿠키. `Accept`에 `application/json` 포함 시 `200` + `{ ok, redirect }`·`Set-Cookie` 후 클라이언트가 `redirect`로 이동 |

### `/rooms/[roomId]` 쿼리
| 키 | 설명 |
|----|------|
| `view=calendar` | 캘린더/결과 탭 |
| `joined`, `rejoin` | 참여 완료/재연결 메시지 |
| `error` | 참여 에러 |
| `pw=wrong` | 비밀번호 오류 |
| `managed`, `manageError` | 방장 액션 결과 |

### API 라우트
| 경로 | 설명 |
|------|------|
| `GET/PUT /api/rooms/[roomId]/schedules` | 본인 일정 조회/저장 (`participant` 쿠키). 응답 본문은 `{ entries }`만 · 여행 방은 연속 `nights+1`일 이상인 **모두 best** 청크만 허용(서버 검증) |
| `GET /api/rooms/[roomId]/results` | 결과 집계 전용 API. 참여자 수·닉네임 맵·날짜 랭킹·응답 수·여행 시 공통 n박 후보(`travelOverlapRanges`)·개인 연속 구간(`travelSoloSegments`)을 서버에서 계산해 반환 |
| `POST /api/rooms/[roomId]/unlock` | 방 비밀번호 검증 후 잠금 쿠키 발급 |
| `POST /api/rooms/[roomId]/manage` | 방장 액션 (`close`/`fix`/`clear_fix`/`delete_room`) |
| `GET /api/holidays` | 공휴일 프록시 API |

`delete_room` 처리 순서: `schedules` 삭제 → `owner_participant_id` null → `participants` 삭제 → `rooms` 삭제 → `/rooms?deleted=1` 리다이렉트 + 쿠키 제거

---

## 5. 쿠키 정책 (httpOnly, `path: "/"`)

| 이름 | 역할 |
|------|------|
| `meeting_scheduler_participant_{roomId}` | 해당 방의 `participants.id` 식별 |
| `meeting_scheduler_room_unlock_{roomId}` | 비밀번호 방 입장 상태 |
| `meeting_scheduler_room_creator_{roomId}` | 방 개설자 검증용 토큰 쿠키 (`rooms.creator_claim_token`과 비교) |

추가: `rooms.password_hash`는 SHA-256 hex만 저장합니다.

---

## 6. 방장(owner) 규칙

- 방장은 닉네임이 아니라 `rooms.owner_participant_id`(participant UUID)로 관리합니다.
- **신규 방**: 개설자 쿠키 값과 `creator_claim_token`이 일치하는 참여자가 owner를 선점합니다.
- `creator_claim_token`이 비어 있거나 쿠키가 일치하지 않으면 자동 owner 선점은 일어나지 않습니다.
- 동일 닉네임 재입장은 기존 participant 쿠키가 같은 경우만 허용합니다.
- 방장 관리 섹션은 **owner면 항상 노출**됩니다.
  - 방 삭제: 언제든 가능
  - 모집 마감: `canClose`(예상 인원 참여/응답 충족)일 때만
  - 일정 픽스/해제: 마감(`is_closed`) 이후만

---

## 7. 일정 도메인

| 상태 | 의미 | 점수 |
|------|------|------|
| `best` | 선호 | 2 |
| `ok` | 가능 | 1 |
| 없음 | 불가 | 0 (행 없음) |

- **일반 모임(single)**: 날짜 단위 토글
- **여행 모임(travel)**:
  - `nights = N`이면 연속 `N+1`일 구간 선택
  - 저장 상태는 해당 구간 전부 `best`
  - 이미 선택된 구간의 **캘린더상 첫날**(전날이 비어 있음)을 다시 누르면 구간 해제
  - 구간 내부 날짜를 누르면 해당 날짜를 새 시작일로 재지정
- **결과 표시** (`RoomDateResults`, `lib/schedule-results.ts`, `lib/travel-recommendation.ts`):
  - `scheduleRowCount === 0`: 「아직 응답이 없어요. … 표시됩니다.」(일반·여행 공통)
  - 상단 한 줄 안내: **일반**만 「모이기 좋은 날부터 순서대로…」·**여행**은 제목·「모두 가능」「개인 선호」소제목만으로 충분해 별도 문단 없음
  - `buildDateResults`: 일정이 한 번이라도 있는 참가자 id만 모수(응답자 기준). 날짜별 `canParticipantIds`로 `가능한 사람` 표시
  - 일반(single): `canCount > 0`만 노출 · 기본 상세 최대 **3**줄 · `view=calendar` **6**줄 (`page.tsx`의 `maxRows`)
  - 일반: `선호`/`가능` 숫자 강조, 닉네임 목록(긴 이름 줄바꿈)
  - **여행**은 `schedules`만 사용:
    - **모두 가능 (n박)** (`buildTravelOverlapNightRanges`, UI 부가 설명: 「N박 단위 또는, 연속으로 겹치는 전체 기간이 표시됩니다.」): 응답 참가자 **전원**이 그날 모두 가능한 날만 골라 연속 구간(run)으로 나눈다(응답자 2명 미만이면 비움). **응답자 전원의 `best`가 날짜 공백 없이 한 덩어리**이면 각 공통 run을 **`nights+1`보다 길어도 시작~끝 전체 한 줄**. **누구라도 `best`가 둘 이상의 연속 덩어리**면 각 run 안에서 `nights+1`일 창 슬라이딩 후, **같은 참가자·같은 추천 여부**이고 **시작일이 하루씩만 밀린** 줄들은 **병합**해 전체 가능 기간 한 줄(예: 4~6, 5~7, … → 4~9). 공통 run이 끊기면 병합도 run 경계에서 끊김. 후보가 없어도 **제목·위 설명** 유지·빈 때 「아직 모두 가능한 날짜가 없어요.」. 줄마다 **추천**/**참고** 배지(`perfectMatch`)·**가능한 사람**만 표시(여행은 전원 선호라 카드에 `선호 N` 숫자 줄 없음).
  - 일반(single) 배지: `respondedCount >= 2 && perfectMatch`일 때만 **추천**, 그 외는 **참고**(1인 응답 초기 과추천 방지)
    - **개인 선호** (`buildTravelSoloSegments`, 부가 문구: 「모두 가능한 날이 없다면? 참가자별 선호 일정을 확인해 보세요.」): 참가자별 `best` 일정을 날짜 공백으로 끊긴 연속 구간마다 **시작~끝 전체** 한 줄 · UI에서 **같은 구간**은 한 카드로 묶어 `가능한 사람: 닉네임, 닉네임`. **화면에 표시 중인 「모두 가능」 줄**과 시작·종료일이 문자열로 완전히 같으면 개인 선호 목록에서 빼서 중복 노출 방지(한쪽이 다른 쪽에 **포함**만 되는 경우는 그대로 둠). **전부 표시**(스크롤 영역 안, `maxRows`는 모두 가능에만).
    - `maxRows`(`view=calendar` 등): **모두 가능** 블록만 최대 N줄로 제한 · **개인 선호**는 줄 수 제한 없음

마감 후에는 일정 `PUT`이 403으로 막히고, 방장만 관리 액션 가능.

---

## 8. DB 요약

### `rooms`
`name`, `type(single|travel)`, `nights`, `date_range_start/end`, `expected_participant_count`, `password_hash`, `owner_participant_id`, `creator_claim_token`, `is_closed`, `closed_at`, `fixed_start_date`, `fixed_end_date`

### `participants`
`room_id`, `nickname`  
같은 방에서 정규화 닉네임 유니크를 권장합니다.

### `schedules`
`room_id`, `participant_id`, `date(YYYY-MM-DD)`, `status(best|ok)`  
`UNIQUE(participant_id, date)`

### 필요한 SQL (직접 실행)
`rooms.creator_claim_token` 컬럼이 없으면 아래를 Supabase SQL Editor에서 실행합니다.

```sql
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS creator_claim_token text;

COMMENT ON COLUMN rooms.creator_claim_token IS
  'join 시 개설자 쿠키와 일치할 때만 owner_participant_id 선점(자동 1인 방장은 없음)';
```

---

## 9. Realtime

`RoomRealtimeListener`(항상 마운트): `schedules`·`participants` **postgres_changes** → **250ms** 디바운스 후  
항상 `room-results-revalidate` 이벤트로 SWR(`/results`) 재검증을 트리거합니다.
- **상세 화면**(`variant=full`): 추가로 `router.refresh()`로 참여자 목록 등 RSC 갱신
- **캘린더**(`view=calendar`, `variant=light`): 위 이벤트만 — 전체 RSC 갱신 없음

폴링은 탭이 보일 때만: 구독 성공(`SUBSCRIBED`) 전까지 **15초**, 이후 **45초** · `CHANNEL_ERROR`/`TIMED_OUT`이면 다시 15초로(이벤트가 주 갱신).

`RoomResultsLive`·`RoomLiveCounts`는 Supabase 채널을 따로 열지 않고, 위 이벤트·저장 시 발행과 동일한 흐름으로 `/results`만 재검증합니다.

Supabase에서 아래를 확인합니다.

- Dashboard → **Database → Tables** → `schedules`, `participants`에서 **Realtime** 활성화  
- 또는 SQL Editor에서 **publication**에 테이블이 포함돼 있는지 확인 (프로젝트 설정에 따라 예시):

```sql
alter publication supabase_realtime add table public.schedules;
alter publication supabase_realtime add table public.participants;
```

`app/rooms/[roomId]/page.tsx`: `dynamic = "force-dynamic"` — 방 상세·추천 RSC 캐시 고정 방지.

---

## 10. 공휴일

- 서버에서 공휴일 API 호출(`lib/holidays.ts`, `/api/holidays`)
- 캘린더에서 범위 조회 후 일요일/휴일 강조 표시

---

## 11. 주요 파일 빠른 지도

| 경로 | 역할 |
|------|------|
| `app/loading.tsx` | 라우트 전환 공통 로딩 |
| `app/rooms/new/create/route.ts` | 방 생성 + 개설자 토큰/쿠키 |
| `app/rooms/new/CreateRoomForm.tsx` | 방 생성 폼(제출 중 스피너) |
| `app/rooms/[roomId]/join/route.ts` | 참여 처리 + owner 할당 규칙 |
| `app/rooms/page.tsx` | 방 목록(🔒/완료 회색/생성·삭제 토스트) |
| `app/rooms/RoomsActionToast.tsx` | `/rooms` 생성·삭제 완료 토스트 + 쿼리 정리 |
| `app/rooms/[roomId]/page.tsx` | 방 상세 조합 |
| `app/rooms/[roomId]/ScheduleCalendar.tsx` | 캘린더(저장 성공 시 `room-results-revalidate` 이벤트 발행으로 SWR 결과 키 재검증 트리거) |
| `app/rooms/[roomId]/RoomResultsLive.tsx` / `RoomLiveCounts.tsx` | `/results` SWR 구독·`room-results-revalidate` 수신으로 부분 갱신 |
| `app/rooms/[roomId]/RoomRealtimeListener.tsx` | 방당 Realtime 채널 1개 + 폴링·디바운스(`full`/`light`) |
| `app/rooms/[roomId]/RoomDateResults.tsx` | 추천 결과 UI |
| `app/rooms/[roomId]/DeleteRoomForm.tsx` | 방 삭제 확인 |
| `app/api/rooms/[roomId]/manage/route.ts` | 방장 액션 API |
| `app/api/rooms/[roomId]/schedules/route.ts` | 일정 API |
| `app/api/rooms/[roomId]/unlock/route.ts` | 잠금 해제 API |
| `components/ui/InlineMessage.tsx` | 성공/안내/에러 공통 배너 |
| `components/ui/ToastPopup.tsx` | 완료 피드백 공통 토스트 |
| `lib/room-creator.ts` / `participant-session.ts` / `room-unlock.ts` | 쿠키 키 유틸 |
| `lib/schedule-validate.ts` / `schedule-results.ts` / `travel-recommendation.ts` / `availability-utils.ts` / `room-results.ts` / `nickname.ts` | 도메인 로직 |
| `lib/supabase/server.ts`, `lib/supabase/client.ts` | Supabase 클라이언트 |

---

## 12. Supabase 점검 체크리스트

1. `rooms.creator_claim_token` 포함 필수 컬럼이 모두 있는지
2. `participants` 닉네임 유니크 정책(정규화 기준) 적용 여부
3. RLS 사용 시 anon 권한이 앱 동작(`join`, `schedules`, `manage`)과 맞는지
4. `schedules`, `participants` Realtime·RLS 여부
5. `/rooms` 목록에서 `password_hash` 조회 정책 허용 여부(🔒 표시용)

---

동작을 바꾼 커밋에는 이 문서를 같이 맞춥니다.
