// Tier A archive records, Tier B live logs baseline, and endings text.
import type { ImageKey } from './imageAssets';
import { PLAYER, FORMER } from './building';

export interface ArchiveRecord {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  image?: ImageKey;
  /** discovered records appear in the archive tab only after pickup */
  discovered: boolean;
  where?: string;
}

export const ARCHIVE_RECORDS: ArchiveRecord[] = [
  {
    id: 'A1',
    title: '사용승인 도면 원본',
    subtitle: '1994. 11. 30. 사용승인 · 청운빌딩',
    body: '지하 1층, 지상 12층. 옥탑: 기계실.\n각 주거층(3~12층) 8세대, 복도 끝 창 1개소, 동측 비상계단.\n층별 도면은 시설도 원본 탭에서 볼 수 있다.',
    discovered: false,
  },
  {
    id: 'A2',
    title: '시설 기준 사진 원본 (날인본)',
    subtitle: '2026. 09. 01. 촬영 · 관리소장 확인',
    body: '9월 1일 정기 점검 때 촬영한 원본 인화본. 태블릿의 기준 사진은 이 원본을 스캔한 사본이다.\n원본은 수정되지 않는다.',
    discovered: false,
  },
  {
    id: 'A3',
    title: '입주자 원본 카드',
    subtitle: '2026. 09. 01. 기준 · 관리사무소 날인',
    body: '세대별 입주자 카드 원본. 이주 완료 세대는 붉은 선으로 표시.\n거주자 명부(태블릿)는 이 카드를 입력한 사본이다.',
    discovered: false,
  },
  {
    id: 'A4',
    title: `근로계약서 원본 — ${PLAYER.name}`,
    subtitle: '2026. 09. 29. 체결 · 본사 인사팀 날인',
    body: `성명: ${PLAYER.name}\n사번: ${PLAYER.id}\n계약 형태: ${PLAYER.contract}\n근무 시간: 2026. 09. 30. ${PLAYER.shift}\n근무지: 청운빌딩 (지상 12층)\n\n계약 종료: 2026. 09. 30. 06:00 교대 시 자동 종료.`,
    discovered: false,
  },
  {
    id: 'A5',
    title: '승강기 설치 검사서 원본',
    subtitle: '1994. 11. 28. · 청운승강기(주)',
    body: '정지층: B1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 (13개 정지층)\n운행 구간: 지하 1층 ~ 지상 12층\n※ 버튼 배열 변경 이력 없음.',
    discovered: false,
  },
  {
    id: 'A6',
    title: '전기 계통도 원본',
    subtitle: '1994. 11. · 전기 안전관리자 날인',
    body: '전등 분기 차단기 (15회로)\n1층 로비 · 2층 상가 · 3층 · 4층 · 5층 · 6층 · 7층 · 8층 · 9층 · 10층 · 11층 · 12층 · 옥탑 기계실 · 비상 조명 · 승강기',
    discovered: false,
  },
  {
    id: 'D1',
    title: '1994년 관리대장',
    subtitle: '청운건설 관리부 · B1 문서고에서 발견',
    body: '11.01  13층 1301~1308호 가입주 8세대 확인. (서류상 옥탑 기계실)\n11.02  01:13 야간 경비 오명수, 1301호 호출 받고 13층으로 올라감. 복귀하지 않음.\n11.02  09:00 준공 검사 대비 13층 출입구 봉쇄. 승강기 13 버튼 제거.\n11.02  13층 거주 세대 전출 처리 완료. (행정 처리)\n11.30  사용승인. 지상 12층.',
    discovered: true,
    where: 'B1 문서고',
  },
  {
    id: 'D2',
    title: '구조 계산서 원본',
    subtitle: '1993. 06. · 잠긴 서류함에서 발견',
    body: '청운빌딩 신축공사 — 지상 13층 / 지하 1층, 각 층 하중 검토 완료.\n\n[붉은 정정 도장] 13층 → 옥탑 기계실로 용도 변경 (1994. 11. 02.)\n비고: 13층 공간은 설계대로 시공됨. 개방 금지.',
    image: 'archive_13f_construction',
    discovered: true,
    where: 'B1 문서고 서류함',
  },
  {
    id: 'D3',
    title: '이상현상 신고서 (1994. 11. 02. 01:13)',
    subtitle: '야간 경비 오명수 · 1204호 붙박이장에서 발견',
    body: '신고자: 야간 경비 오명수\n내용: 1301호에서 인터폰 호출. 올라가 보니 13층 복도가 있음. 사람들이 전부 나를 보고 있음. 13층은 없다고 들었는데 13층이 있음. 확인 바람.\n처리: (공란)\n\n— 뒷면, 다른 필체 —\n이게 첫 번째 신고다. 그 뒤로 야간 근무자는 전부 이걸 보다가 없어졌다. 틀리게 신고할수록 빨리. — 박정호 2026. 09. 20.',
    discovered: true,
    where: '1204호',
  },
  {
    id: 'D4',
    title: `${FORMER.name}의 마지막 근무 일지`,
    subtitle: '2026. 09. 21. · 13층 복도에서 발견',
    body: '01:13 1301호 호출. 올라왔다.\n신고한 것들은 사라지는 게 아니었다. 전부 여기 있다. 의자도, 문도, 사진 속 사람도.\n틀린 신고를 할 때마다 건물이 나를 조금씩 가져간다. 명부에서, 사진에서, 기록에서.\n원본은 바뀌지 않는다. 붉은 도장을 믿어라.\n06시 전에 내려가라. 교대자가 오면 문이 열린다.\n나는 너무 많이 틀렸다.',
    discovered: true,
    where: '13층',
  },
];

export interface LogEntry {
  date: string;
  time: string;
  text: string;
  by: string;
  injected?: boolean;
}

/** Maintenance log baseline (Tier B). Known defects listed here are NOT anomalies. */
export const MAINT_LOG: LogEntry[] = [
  { date: '09.28', time: '23:55', text: '주간 → 야간 인수인계. 특이사항 없음.', by: '주간 관리 이미숙' },
  { date: '09.27', time: '22:10', text: '7층 복도 3번 등(엘리베이터 서쪽) 안정기 불량으로 깜빡임. 교체 요청함. 이상현상 아님.', by: FORMER.name },
  { date: '09.26', time: '03:20', text: '2층 상가 복도 5번 등 절전 소등 (조합 요청). 이상현상 아님.', by: FORMER.name },
  { date: '09.24', time: '23:50', text: '1204호 퇴거 후 도어락 전원 차단. 마스터키 관리실 열쇠함 보관.', by: FORMER.name },
  { date: '09.22', time: '09:00', text: `${FORMER.name} 퇴사 처리. 신규 야간 근무자 채용 전까지 주간 인력 대체.`, by: '본사 시설팀' },
  { date: '09.21', time: '01:13', text: '■■■■ 1301 ■■■■■■■■ (관리자에 의해 삭제된 기록)', by: '—' },
  { date: '09.20', time: '04:10', text: 'B1 기계실 펌프 소음 — 정상 작동 확인.', by: FORMER.name },
  { date: '09.19', time: '02:00', text: '5층 추억 사진전 액자 5점 설치 완료.', by: FORMER.name },
  { date: '09.18', time: '11:00', text: '승강기 월간 점검 완료. 정지층 B1~12 정상.', by: '청운승강기(주)' },
  { date: '09.01', time: '10:00', text: '시설 기준 사진 정기 촬영. 원본은 관리실 원본 기록 보관함.', by: '관리소장' },
];

export const FUTURE_LOG: LogEntry = { date: '09.30', time: '05:40', text: '13층 점검 완료. 이상 없음. 계속 근무함.', by: PLAYER.name, injected: true };

export interface EndingDef {
  id: 'good' | 'bad' | 'secret';
  title: string;
  subtitle: string;
  paragraphs: string[];
}

export const ENDINGS: Record<EndingDef['id'], EndingDef> = {
  good: {
    id: 'good',
    title: '퇴근',
    subtitle: 'ENDING A',
    paragraphs: [
      '06:00. 출입문 잠금이 풀리는 소리가 났다.',
      '교대 근무자는 당신의 이름을 정확히 불렀다. 태블릿의 인사 기록은 원본 계약서와 같았다. 임시직, 1일.',
      '{evidence}',
      '12월 1일, 청운빌딩은 예정대로 철거되었다. 철거 업체의 작업 일지에는 "지상 12층"이라고 적혀 있다.',
    ],
  },
  bad: {
    id: 'bad',
    title: '상주 관리인',
    subtitle: 'ENDING B',
    paragraphs: [
      '06:00. 출입문은 열리지 않았다.',
      '유리문 너머로 주간 근무자가 들어오는 것이 보였다. 그는 당신을 지나쳐 관리실로 걸어갔다. 당신 쪽은 한 번도 보지 않았다.',
      '태블릿에 새 신고가 들어왔다. 발신: 13층. 근무 형태: 상주.',
      '로비의 층별 안내판 맨 위 칸에, 당신의 이름이 끼워져 있었다.',
    ],
  },
  secret: {
    id: 'secret',
    title: '1301호',
    subtitle: 'ENDING C — 최초의 기록',
    paragraphs: [
      '1994년 11월 2일 01시 13분의 신고서에는 처리란이 비어 있었다.',
      '당신은 그 칸에 적었다. "13층 존재 확인. 거주 8세대. 기록 복원 요청." 붉은 도장은 바뀌지 않는다. 그래서 원본 위에 적었다.',
      '06:00. 출입문이 열렸다. 뒤에서 승강기 도착음이 들렸다. 문이 열리고, 오래된 옷차림의 사람들이 조용히 로비로 걸어 나왔다.',
      '아무도 당신을 보지 않았다. 그들은 밖으로 나갔다. 31년 만이었다.',
      '12월 1일, 철거 업체는 지붕 아래에서 도면에 없는 한 개 층을 발견했다고 보고했다. 그 보고서는 아직 접수되지 않았다.',
    ],
  },
};

export const EVIDENCE_LINES = {
  many: '당신이 찍은 증거 사진 {n}장은 원본 기록철과 함께 본사로 보내졌다. 답장은 오지 않았지만, 사진은 지워지지 않았다.',
  few: '증거라고 부를 만한 것은 거의 남지 않았다. 당신의 기억만 남았다. 그리고 기억은 기준 자료가 아니다.',
};
