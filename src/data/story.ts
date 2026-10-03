// Shift structure, incident slots, complaint templates and narrative text (Korean, player-facing).
import type { Channel, LocKind } from './types';

export interface SlotDef {
  id: string;
  act: number;
  time: string; // HH:MM
  kind: 'story' | 'random';
  anomaly?: string;
  normal?: boolean;
  location?: string; // may contain '?' floor placeholder for story anomalies on random floors
  channel?: Channel;
  from?: string;
  text?: string;
  pool?: { minD: number; maxD: number; normalChance: number; kinds?: LocKind[] };
}

export const SLOTS: SlotDef[] = [
  // ACT 1 — 근무 시작
  { id: 's01', act: 1, time: '00:05', kind: 'story', anomaly: 'obj_vending_duplicate', location: 'lobby:1', channel: 'visual', from: '602호 박영수', text: '로비 자판기 쪽이 뭔가 이상하다는 입주민 전화입니다. 현장을 확인해 주세요.' },
  { id: 's02', act: 1, time: '00:15', kind: 'story', normal: true, location: 'res:7', channel: 'visual', from: '7층 입주민 (705호)', text: '7층 복도 형광등이 계속 깜빡거린다는 신고입니다.' },
  { id: 's03', act: 1, time: '00:30', kind: 'random', pool: { minD: 1, maxD: 1, normalChance: 0.2, kinds: ['res', 'shops', 'parcel', 'lobby', 'stair'] } },
  { id: 's04', act: 1, time: '00:45', kind: 'random', pool: { minD: 1, maxD: 2, normalChance: 0.3 } },
  // ACT 2 — 이상 징후
  { id: 's05', act: 2, time: '01:05', kind: 'story', anomaly: 'img_family_extra_person', location: 'gallery:5', channel: 'image', from: '원격 관제센터', text: '5층 추억 사진전 액자 관련 민원이 들어왔습니다. 액자 상태를 확인해 주세요.' },
  { id: 's06', act: 2, time: '01:25', kind: 'random', pool: { minD: 2, maxD: 2, normalChance: 0.25 } },
  { id: 's07', act: 2, time: '01:45', kind: 'story', anomaly: 'hum_cctv_only_figure', location: 'res:?', channel: 'cctv', from: '원격 관제센터', text: '{loc} CCTV에 사람이 20분째 같은 자리에 서 있습니다. 현장 확인 부탁드립니다.' },
  { id: 's08', act: 2, time: '02:00', kind: 'random', pool: { minD: 2, maxD: 3, normalChance: 0.25 } },
  { id: 's09', act: 2, time: '02:15', kind: 'random', pool: { minD: 2, maxD: 3, normalChance: 0.2 } },
  // ACT 3 — 정보 충돌
  { id: 's10', act: 3, time: '02:35', kind: 'story', anomaly: 'sys_delivery_vacant', location: 'parcel:1', channel: 'records', from: '무인 택배함', text: '보관함 12번 장기 미수령 알림입니다. 수령 세대를 확인해 주세요.' },
  { id: 's11', act: 3, time: '02:55', kind: 'random', pool: { minD: 3, maxD: 5, normalChance: 0.2 } },
  { id: 's12', act: 3, time: '03:10', kind: 'story', anomaly: 'sys_elevator_log_13', location: 'elevator', channel: 'records', from: '승강기 원격감시', text: '새벽 시간 무인 운행이 감지되었습니다. 승강기 운행 기록과 차내를 점검해 주세요.' },
  { id: 's13', act: 3, time: '03:30', kind: 'story', anomaly: 'meta_ref_corridor', location: 'res:?', channel: 'reference', from: '본사 시설팀', text: '{loc} 소화기 위치 확인 요청입니다. 기준 사진과 대조해 주세요.' },
  { id: 's14', act: 3, time: '03:45', kind: 'random', pool: { minD: 3, maxD: 5, normalChance: 0.2 } },
  // ACT 4 — 13층
  { id: 's15', act: 4, time: '04:05', kind: 'story', anomaly: 'geo_floor_13', location: 'f13:13', channel: 'visual', from: '인터폰 1301호', text: '"…관리실이죠? 여기 천장에서 물이 새요." 발신 세대: 1301호. 이 건물에 13층은 없습니다.' },
  { id: 's16', act: 4, time: '04:35', kind: 'story', anomaly: 'sys_cctv_13', location: 'f13:13', channel: 'cctv', from: 'CCTV 시스템', text: '신규 채널이 등록되었습니다: CH13 "13층 복도". 채널과 현장을 확인해 주세요.' },
  { id: 's17', act: 4, time: '05:10', kind: 'story', anomaly: 'sys_identity_record', location: 'control:1', channel: 'records', from: '본사 인사팀', text: '야간 근무자 본인 확인 요청입니다. 인사 기록을 확인하고 이상 여부를 보고하세요.' },
];

export interface OptionalDef {
  id: string;
  anomaly: string;
  location: string;
  unlockAfter: string; // slot id whose resolution unlocks it
  from: string;
  text: string;
}

export const OPTIONALS: OptionalDef[] = [
  { id: 'o1', anomaly: 'obj_breaker_13', location: 'b1:0', unlockAfter: 's10', from: '본사 전기팀', text: '[선택 점검] B1 전기실 전등 차단기 목록을 원본 전기 계통도와 대조해 주세요.' },
  { id: 'o2', anomaly: 'img_ceremony_both', location: 'gallery:5', unlockAfter: 's11', from: '관리사무소 (보존 담당)', text: '[선택 점검] 5층 준공식 사진을 원본 기록철 사진과 대조해 주세요. 기준 사진만 믿지 마세요.' },
  { id: 'o3', anomaly: 'hum_resident_smile', location: 'res:8', unlockAfter: 's12', from: '803호 가족', text: '[선택 점검] "어머니 명부 사진이 이상하다"는 문의입니다. 803호 거주자 명부를 원본 입주자 카드와 대조해 주세요.' },
];

export const TEMPLATES: Record<Channel, string[]> = {
  visual: ['{loc}이 평소와 다르다는 신고입니다.', '{loc}에서 뭔가 달라진 것 같다는 전화가 왔습니다.', '{loc} 순찰 요청입니다. 기준 사진과 비교해 주세요.'],
  image: ['{loc}의 사진이나 게시물이 이상하다는 신고입니다.', '{loc} 게시물 상태를 확인해 주세요.'],
  audio: ['{loc}에서 이상한 소리가 난다는 신고입니다. 직접 들어 보고 판단해 주세요.', '{loc} 소음 민원입니다. 조용히 들어 보세요.'],
  cctv: ['원격 관제: {loc} CCTV 영상이 이상합니다. 화면과 현장을 대조해 주세요.', '{loc} CCTV 점검 요청입니다.'],
  records: ['{loc} 관련 시스템 기록 점검 요청입니다.', '{loc} 기록이 맞는지 확인해 주세요.'],
  reference: ['{loc} 기준 자료 대조 요청입니다.', '{loc}을 기준 사진과 대조해 주세요.'],
};

/** Channels plausible for a normal (false-alarm) incident at a location kind. */
export const NORMAL_CHANNELS: Partial<Record<LocKind, Channel[]>> = {
  res: ['visual', 'audio', 'cctv', 'records'],
  gallery: ['image', 'visual'],
  lobby: ['visual', 'image', 'cctv'],
  parcel: ['visual', 'records'],
  elevator: ['visual', 'image', 'records'],
  stair: ['visual', 'audio'],
  shops: ['visual', 'audio'],
  b1: ['visual', 'audio'],
};

export const HQ = '야간 상황실 윤 주임';

export const MESSAGES = {
  start: '한서진 씨, 첫 야간 근무 고생 많으세요. 오늘 밤 신고는 전부 태블릿으로 들어갑니다. Tab 키로 태블릿을 여세요.',
  binder: '관리실 서쪽 캐비닛에 붉은 도장이 찍힌 원본 기록철이 있어요. 본사 원본이라 바뀌지 않습니다. 먼저 챙겨 두세요.',
  s01done: '잘하셨어요. 이런 식입니다. 기준 사진과 다르면 이상현상, 같으면 정상.',
  s02hint: '점검 일지에 이미 적힌 고장은 이상현상이 아닙니다. 일지부터 보세요.',
  act2: '01시입니다. 근무 일지를 한 번 쓰고 계속하세요. 관리실 책상에 있어요.',
  s07done: '…화면에서 사라졌네요. 확인 고맙습니다. 엘리베이터 조심해서 내려오세요.',
  act3: '02시 30분. 이상하게 신고가 많은 밤이네요. 태블릿 시스템이 가끔 느립니다. 판단이 어려우면 원본 기록철을 보세요.',
  s10done: '1204호는 공실이 맞아요. 전 거주자는… 박정호 씨였습니다. 관리실 열쇠함에 마스터키가 있으니 확인해 주세요.',
  s13hint: '기준 사진도 틀릴 수 있어요. 그럴 땐 원본 기록철과 대조하세요. 원본은 바뀌지 않습니다.',
  act4: '[전송 실패] 야간 상황실과 연결할 수 없습니다.',
  s15done: '[시스템] 13층 복도 CCTV 채널 등록 대기 중…',
  final: '[시스템] 05:50 — 교대 근무자가 곧 도착합니다. 1층 출입문에서 교대하세요.',
};

export interface VoiceLine {
  speaker: string;
  text: string;
}

/** Player-initiated intercom calls (baseline answers). */
export const INTERCOM_ANSWERS: Record<string, VoiceLine[]> = {
  '803': [
    { speaker: '803호 이순자', text: '네에… 관리실이우? 이 밤에 무슨 일이래.' },
    { speaker: '803호 이순자', text: '박씨 아저씨는 요새 안 보이던데. 그 사람이 12층 위에서 발소리 난다고 그렇게 올라가더니.' },
  ],
  '602': [{ speaker: '602호 박영수', text: '재개발 얘기면 내일 조합 사무실로 하세요. 지금 몇 시예요.' }],
  '305': [{ speaker: '305호 김도현', text: '아, 저 배달 나와 있어요. 무슨 일 있어요? …없으면 끊을게요.' }],
  '1108': [{ speaker: '1108호 오지은', text: '…네? 아무 일 없어요. 저 공부 중이에요.' }],
  '1007': [{ speaker: '1007호', text: '(연결음만 이어진다. 이주 완료 세대다.)' }],
  '1204': [{ speaker: '1204호', text: '(연결음만 이어진다. 공실이다.)' }],
  HQ: [{ speaker: HQ, text: '네, 상황실입니다. 신고 목록 순서대로 처리하시면 됩니다.' }],
};

export const INCOMING_803: VoiceLine[] = [
  { speaker: '803호 이순자', text: '관리실이죠? 거기 박씨 아저씨 아직 있어요?' },
  { speaker: '803호 이순자', text: '그 양반이 지난주에 그러더라고. 이 건물은 원래 열세 층이었다고. 늙은이 놀리는 줄 알았지.' },
];

export const INCOMING_1301: VoiceLine[] = [
  { speaker: '1301호', text: '(한참 동안 숨소리만 들린다)' },
  { speaker: '1301호', text: '…관리실이죠? 여기 천장에서 물이 새요. 올라와 주세요.' },
];
