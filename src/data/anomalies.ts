// Anomaly registry: every anomaly the player can be asked to detect. Data only; realisation lives in
// the world builders (physical mods), systems/anomaly (runtime behaviours) and data overrides.
import { FLOOR_PROPS, GENERIC_CORRIDOR_FLOORS, RESIDENTIAL_FLOORS } from './building';
import type { AnomalyDef, Category } from './types';

type Def = Omit<AnomalyDef, 'resetRule' | 'persistent' | 'contaminationImpact' | 'forbiddenDifferences'> &
  Partial<Pick<AnomalyDef, 'resetRule' | 'persistent' | 'contaminationImpact' | 'forbiddenDifferences'>>;

const SIGNATURE_FLOORS = GENERIC_CORRIDOR_FLOORS.filter((f) => FLOOR_PROPS[f].signature);
const VACANT_FLOORS = GENERIC_CORRIDOR_FLOORS.filter((f) => FLOOR_PROPS[f].vacantTape.length > 0);
const NOT_12 = GENERIC_CORRIDOR_FLOORS.filter((f) => f !== 12);

const RAW: Def[] = [
  // ---------------- residential corridor ----------------
  {
    id: 'obj_chair_center', category: 'OBJECT', difficulty: 1, loc: 'res', channels: ['visual'], realisation: ['physical'],
    title: '복도 한가운데 의자', baselineState: 'corridor_clear', anomalyState: 'plastic_chair_mid_corridor',
    intendedDifference: 'a single white plastic chair stands in the middle of the corridor facing the elevator hall',
    detection: '복도 서쪽에 의자가 놓여 있다. 기준 사진의 복도는 비어 있다.', minAct: 1, purpose: 'Teaches that anything new in the corridor matters.',
  },
  {
    id: 'obj_parcel_tower', category: 'OBJECT', difficulty: 1, loc: 'res', channels: ['visual'], realisation: ['physical'],
    title: '천장까지 쌓인 택배', baselineState: 'parcels_per_floor', anomalyState: 'eleven_parcels_stacked',
    intendedDifference: 'eleven identical parcels stacked to the ceiling beside unit 04',
    detection: '04호 옆에 택배 상자가 천장까지 쌓였다.', minAct: 1, purpose: 'Obvious object anomaly.',
  },
  {
    id: 'obj_shoes_row', category: 'OBJECT', difficulty: 1, loc: 'res', channels: ['visual'], realisation: ['physical'],
    title: '벽을 향해 늘어선 신발', baselineState: 'no_shoes', anomalyState: 'seven_pairs_facing_wall',
    intendedDifference: 'seven pairs of shoes lined up along the south wall, toes facing the wall',
    detection: '남쪽 벽을 따라 신발 일곱 켤레가 벽을 보고 서 있다.', minAct: 1, purpose: 'Culturally uncanny (shoes point inward).',
  },
  {
    id: 'geo_extra_door', category: 'GEOMETRY', difficulty: 1, loc: 'res', channels: ['visual', 'reference'], realisation: ['physical'],
    title: '번호 없는 현관문', baselineState: 'eight_doors', anomalyState: 'ninth_unnumbered_door',
    intendedDifference: 'an extra unnumbered apartment door between 01 and 02; the extinguisher stand shifts to make room',
    detection: '01호와 02호 사이에 번호판 없는 문이 있다. 시설도에는 8세대뿐이다.', minAct: 1, purpose: 'First impossible-space anomaly.',
  },
  {
    id: 'geo_missing_door', category: 'GEOMETRY', difficulty: 1, loc: 'res', channels: ['visual', 'reference'], realisation: ['physical'],
    title: '사라진 06호 현관', baselineState: 'eight_doors', anomalyState: 'unit06_door_missing',
    intendedDifference: 'unit 06 door is gone; only its number plate remains on a blank wall',
    detection: '06호 번호판은 있는데 문이 없다.', minAct: 1, purpose: 'Absence is as loud as presence.',
  },
  {
    id: 'hum_window_figure', category: 'HUMAN', difficulty: 1, loc: 'res', channels: ['visual'], realisation: ['physical', 'runtime'],
    title: '창가에 선 사람', baselineState: 'window_empty', anomalyState: 'figure_facing_window',
    intendedDifference: 'a person stands motionless at the west window facing outside; vanishes when approached',
    detection: '복도 끝 창가에 누군가 밖을 보고 서 있다. 다가가면 사라진다.', minAct: 1, purpose: 'Early human presence scare without a sting.',
  },
  {
    id: 'obj_extinguisher_moved', category: 'OBJECT', difficulty: 2, loc: 'res', channels: ['visual', 'reference'], realisation: ['physical'],
    title: '자리를 옮긴 소화기', baselineState: 'extinguisher_in_stand', anomalyState: 'extinguisher_by_unit05',
    intendedDifference: 'the extinguisher left its red stand and stands alone in front of unit 05',
    detection: '소화기 거치대가 비었고 소화기가 05호 앞에 서 있다.', minAct: 1, purpose: 'Memory: requires knowing where it belongs.',
  },
  {
    id: 'geo_corridor_extended', category: 'GEOMETRY', difficulty: 2, loc: 'res', channels: ['visual', 'reference'], realisation: ['physical'],
    title: '길어진 복도', baselineState: 'corridor_24m', anomalyState: 'corridor_30m_two_extra_doors',
    intendedDifference: 'the corridor continues 6 m further west with two extra numbered doors (09, 10) before the window',
    detection: '창문이 멀어졌고 09호, 10호가 생겼다. 시설도의 복도 길이와 다르다.', minAct: 2, purpose: 'Spatial wrongness.',
  },
  {
    id: 'geo_window_walled', category: 'GEOMETRY', difficulty: 2, loc: 'res', channels: ['visual', 'reference'], realisation: ['physical'],
    title: '막혀 버린 창문', baselineState: 'west_window', anomalyState: 'west_wall_solid',
    intendedDifference: 'the west-end window is gone; the end wall is solid',
    detection: '복도 끝 창문이 벽이 되었다.', minAct: 1, purpose: 'Missing exit to the outside world.',
  },
  {
    id: 'sys_numbers_swapped', category: 'SYSTEM', accept: ['GEOMETRY'], difficulty: 2, loc: 'res', channels: ['visual', 'reference'], realisation: ['physical'],
    title: '뒤바뀐 호수', baselineState: 'plates_in_order', anomalyState: 'plates_02_03_swapped',
    intendedDifference: 'the number plates of units 02 and 03 are swapped (03 appears west of the elevator)',
    detection: '엘리베이터 서쪽에 03호, 동쪽에 02호. 시설도 순서와 반대.', minAct: 2, purpose: 'Room-number system anomaly.',
  },
  {
    id: 'aud_room_silence', category: 'AUDIO', difficulty: 2, loc: 'res', channels: ['audio'], realisation: ['runtime'],
    title: '소리가 사라진 층', baselineState: 'fluorescent_hum_and_room_tone', anomalyState: 'total_silence_no_footsteps',
    intendedDifference: 'all room tone and the player\'s own footsteps are silent on this floor only',
    detection: '형광등 소음도, 내 발소리도 들리지 않는다.', minAct: 2, purpose: 'Silence used aggressively.',
  },
  {
    id: 'aud_follow_steps', category: 'AUDIO', difficulty: 2, loc: 'res', channels: ['audio'], realisation: ['runtime'],
    title: '따라오는 발소리', baselineState: 'own_steps_only', anomalyState: 'second_steps_behind',
    intendedDifference: 'a second set of footsteps follows a beat behind the player and stops when they stop',
    detection: '멈추면 뒤의 발소리도 멈춘다. 돌아보면 아무도 없다.', minAct: 2, purpose: 'Directional audio dread.',
  },
  {
    id: 'obj_exit_sign_reversed', category: 'OBJECT', difficulty: 2, loc: 'res', channels: ['visual', 'reference'], realisation: ['physical'],
    title: '거꾸로 가리키는 유도등', baselineState: 'arrows_point_to_stairs', anomalyState: 'arrows_point_to_dead_end',
    intendedDifference: 'all three corridor guidance lights point west toward the dead-end window instead of the stairs',
    detection: '통로 유도등 화살표가 막다른 창문 쪽을 가리킨다.', minAct: 2, purpose: 'The building misleads you.',
  },
  {
    id: 'hum_door_ajar_watch', category: 'HUMAN', difficulty: 2, loc: 'res', channels: ['visual'], realisation: ['physical', 'runtime'],
    title: '문틈의 사람', baselineState: 'unit06_closed', anomalyState: 'unit06_ajar_with_figure',
    intendedDifference: 'unit 06 door stands ajar with a dark figure watching through the gap; it slams shut on approach',
    detection: '06호 문이 열려 있고 틈으로 누가 보고 있다. 다가가면 쾅 닫힌다.', minAct: 2, purpose: 'Jump moment #1 candidate (random).',
  },
  {
    id: 'obj_prop_missing', category: 'OBJECT', difficulty: 2, loc: 'res', floors: SIGNATURE_FLOORS, channels: ['visual', 'reference'], realisation: ['physical'],
    title: '사라진 층별 물건', baselineState: 'signature_prop_present', anomalyState: 'signature_prop_absent',
    intendedDifference: 'the floor\'s signature object (bicycle, stroller, plants, ...) is gone; nothing else moved',
    detection: '기준 사진에 있던 이 층의 물건이 없다.', minAct: 2, purpose: 'Pure memory/comparison.',
  },
  {
    id: 'sys_elevator_display', category: 'SYSTEM', difficulty: 2, loc: 'res', channels: ['visual'], realisation: ['physical'],
    title: '13을 가리키는 층 표시등', baselineState: 'indicator_shows_car_floor', anomalyState: 'indicator_frozen_13',
    intendedDifference: 'this floor\'s hall indicator shows 13 regardless of where the car is',
    detection: '승강기 층 표시가 13에 멈춰 있다. 이 건물은 12층이다.', minAct: 2, purpose: 'Seeds the 13 motif.',
  },
  {
    id: 'aud_elevator_uncalled', category: 'AUDIO', accept: ['SYSTEM'], difficulty: 2, loc: 'res', floors: NOT_12, channels: ['audio', 'records'], realisation: ['runtime'],
    title: '부르지 않은 승강기', baselineState: 'elevator_idle', anomalyState: 'elevator_arrives_uncalled',
    intendedDifference: 'the elevator chimes and opens on this floor with nobody calling it; the log records no call',
    detection: '호출하지 않았는데 도착음과 함께 문이 열린다. 승강기 기록에는 호출이 없다.', minAct: 2, purpose: 'Elevator as agent.',
  },
  {
    id: 'geo_ceiling_low', category: 'GEOMETRY', difficulty: 3, loc: 'res', channels: ['visual', 'reference'], realisation: ['physical'],
    title: '낮아진 천장', baselineState: 'ceiling_2_7m', anomalyState: 'ceiling_2_28m',
    intendedDifference: 'the corridor ceiling is 42 cm lower; doors nearly touch it; the elevator hall keeps its height',
    detection: '천장이 문틀에 닿을 듯 낮다. 엘리베이터 홀과 턱이 생겼다.', minAct: 2, purpose: 'Subtle proportion change.',
  },
  {
    id: 'aud_voice_vacant', category: 'AUDIO', accept: ['HUMAN'], difficulty: 3, loc: 'res', floors: VACANT_FLOORS, channels: ['audio', 'records'], realisation: ['runtime'],
    title: '공실에서 들리는 목소리', baselineState: 'vacant_units_silent', anomalyState: 'murmur_behind_vacant_door',
    intendedDifference: 'muffled TV voices come from behind a unit the directory lists as moved out',
    detection: '이주 완료 세대 문 너머에서 텔레비전 소리와 말소리가 난다.', minAct: 2, purpose: 'Audio + records reasoning.',
  },
  {
    id: 'hum_cctv_only_figure', category: 'HUMAN', accept: ['SYSTEM'], difficulty: 3, loc: 'res', channels: ['cctv'], realisation: ['physical'],
    title: 'CCTV에만 보이는 사람', baselineState: 'corridor_empty_everywhere', anomalyState: 'figure_on_cctv_only',
    intendedDifference: 'a person stands near unit 03 facing the camera; visible only on this floor\'s CCTV feed',
    detection: '태블릿 CCTV 화면에는 03호 앞에 사람이 있는데 실제 복도에는 없다.', minAct: 2, story: true, purpose: 'First CCTV contradiction (story).',
  },
  {
    id: 'tmp_cctv_delay', category: 'TEMPORAL', difficulty: 4, loc: 'res', channels: ['cctv'], realisation: ['runtime'],
    title: '늦게 따라오는 CCTV 속 나', baselineState: 'cctv_realtime', anomalyState: 'player_on_cctv_4s_late',
    intendedDifference: 'on this floor\'s CCTV the player moves about four seconds late; everything else is live',
    detection: '멈춰도 CCTV 속 나는 몇 초 동안 계속 걷는다.', minAct: 3, purpose: 'Temporal CCTV contradiction.',
  },
  {
    id: 'tmp_cctv_timestamp', category: 'TEMPORAL', accept: ['SYSTEM'], difficulty: 3, loc: 'res', channels: ['cctv'], realisation: ['data'], requires: ['cctvReliable'],
    title: '1994년의 타임스탬프', baselineState: 'timestamp_tonight', anomalyState: 'timestamp_1994_11_02_0113',
    intendedDifference: 'this floor\'s CCTV overlay reads 1994-11-02 01:13 and does not advance',
    detection: 'CCTV 시각 표시가 1994-11-02 01:13에 멈춰 있다.', minAct: 2, purpose: 'Links to the original incident date.',
  },
  {
    id: 'sys_directory_extra_unit', category: 'SYSTEM', difficulty: 3, loc: 'res', channels: ['records'], realisation: ['data'],
    title: '존재하지 않는 09호 거주자', baselineState: 'eight_units_listed', anomalyState: 'unit09_listed_with_resident',
    intendedDifference: 'the resident directory lists a ninth unit (x09) on this floor with a resident name',
    detection: '거주자 명부에 09호가 있다. 복도에는 문이 8개뿐이고 원본 입주자 카드에도 없다.', minAct: 2, purpose: 'Database vs physical count.',
  },
  {
    id: 'meta_ref_corridor', category: 'META', difficulty: 5, loc: 'res', channels: ['reference'], realisation: ['data'], requires: ['refReliable'],
    title: '바뀐 기준 사진', baselineState: 'reference_matches_reality', anomalyState: 'live_reference_shows_moved_extinguisher',
    intendedDifference: 'the live reference photo shows the extinguisher in front of 05 and is stamped as edited tonight; the corridor itself and the archive original are normal',
    detection: '현장은 원본 기록철 사진과 같다. 태블릿 기준 사진만 다르고 수정일이 오늘 밤이다.', minAct: 3, purpose: 'Reference corruption (level 5).',
  },
  {
    id: 'meta_map_corridor', category: 'META', difficulty: 5, loc: 'res', channels: ['reference'], realisation: ['data'], requires: ['refReliable'],
    title: '문이 하나 더 그려진 시설도', baselineState: 'map_matches_reality', anomalyState: 'live_map_shows_ninth_unit',
    intendedDifference: 'the live floor map draws a ninth unit at the west end; the corridor and the archive blueprint have eight',
    detection: '태블릿 시설도에만 09호가 있다. 현장과 원본 도면은 8세대.', minAct: 3, purpose: 'Reference corruption via map.',
  },
  // ---------------- 5F photo exhibition ----------------
  {
    id: 'img_family_extra_person', category: 'IMAGE', difficulty: 2, loc: 'gallery', floors: [5], channels: ['image', 'reference'], realisation: ['physical'],
    title: '가족사진 속 다섯 번째 사람', baselineState: 'family_of_four', anomalyState: 'fifth_adult_behind_sofa',
    intendedDifference: 'one unfamiliar pale man in a gray work jacket stands behind the sofa between the parents',
    forbiddenDifferences: ['existing faces changed', 'clothing changed', 'background changed', 'framing changed'],
    detection: '1998년 가족사진에 소파 뒤에 선 낯선 남자가 있다.', minAct: 2, story: true,
    imagePair: { normal: 'gallery_family_normal', anomaly: 'gallery_family_anomaly' }, purpose: 'Introduces image anomalies (story).',
  },
  {
    id: 'img_ceremony_gaze', category: 'IMAGE', difficulty: 3, loc: 'gallery', floors: [5], channels: ['image', 'reference'], realisation: ['physical'],
    title: '카메라를 보는 준공식 사람들', baselineState: 'attendees_look_at_ribbon', anomalyState: 'attendees_stare_at_camera',
    intendedDifference: 'all seven attendees now stare into the camera instead of looking down at the ribbon',
    forbiddenDifferences: ['bodies moved', 'building changed', 'ribbon changed', 'people added or removed'],
    detection: '준공식 사진의 일곱 명이 모두 고개를 들어 나를 본다.', minAct: 2,
    imagePair: { normal: 'gallery_ceremony_normal', anomaly: 'gallery_ceremony_anomaly' }, purpose: 'Gaze anomaly.',
  },
  {
    id: 'meta_ref_gallery', category: 'META', difficulty: 5, loc: 'gallery', floors: [5], channels: ['reference', 'image'], realisation: ['data'], requires: ['refReliable'],
    title: '다섯 명이 찍힌 기준 사진', baselineState: 'reference_family_of_four', anomalyState: 'live_reference_family_of_five',
    intendedDifference: 'the live reference photo of the family frame shows five people; the frame and the archive original show four',
    detection: '액자 속 가족은 네 명. 태블릿 기준 사진에는 다섯 명이고 수정일이 오늘이다.', minAct: 3, purpose: 'Reference corruption with image pair.',
  },
  {
    id: 'img_ceremony_both', category: 'IMAGE', accept: ['META'], difficulty: 5, loc: 'gallery', floors: [5], channels: ['image', 'reference'], realisation: ['physical', 'data'],
    title: '기준 사진까지 바뀐 준공식', baselineState: 'attendees_look_at_ribbon', anomalyState: 'frame_and_live_reference_both_stare',
    intendedDifference: 'both the frame and the live reference show the staring attendees; only the archive original shows them looking at the ribbon',
    detection: '현장과 기준 사진이 일치하지만 원본 기록철 사진과 다르다.', minAct: 3, optional: true,
    imagePair: { normal: 'gallery_ceremony_normal', anomaly: 'gallery_ceremony_anomaly' }, purpose: 'Optional high-difficulty archive check (secret ending).',
  },
  // ---------------- 1F lobby ----------------
  {
    id: 'obj_vending_duplicate', category: 'OBJECT', difficulty: 1, loc: 'lobby', floors: [1], channels: ['visual', 'reference'], realisation: ['physical'],
    title: '두 대가 된 자판기', baselineState: 'one_vending_machine', anomalyState: 'two_identical_vending_machines',
    intendedDifference: 'an identical second coffee vending machine stands beside the original',
    detection: '자판기가 두 대다. 기준 사진에는 한 대.', minAct: 1, story: true, purpose: 'Tutorial anomaly.',
  },
  {
    id: 'img_missing_poster_empty', category: 'IMAGE', difficulty: 2, loc: 'lobby', floors: [1], channels: ['image', 'reference'], realisation: ['physical'],
    title: '사람이 사라진 실종 전단', baselineState: 'poster_with_portrait', anomalyState: 'poster_portrait_empty_background',
    intendedDifference: 'the missing-person poster photo shows only the empty backdrop; 박정호 is gone from his own photo',
    forbiddenDifferences: ['poster text changed', 'backdrop color changed'],
    detection: '실종 전단 사진 속에 사람이 없다.', minAct: 2,
    imagePair: { normal: 'staff_parkjeongho', anomaly: 'staff_parkjeongho_empty' }, purpose: 'Former employee motif.',
  },
  {
    id: 'tmp_lobby_clock_backward', category: 'TEMPORAL', difficulty: 2, loc: 'lobby', floors: [1], channels: ['visual'], realisation: ['physical'],
    title: '거꾸로 가는 로비 시계', baselineState: 'clock_matches_time', anomalyState: 'clock_runs_backward',
    intendedDifference: 'the lobby wall clock shows a mirrored time and its hands move counter-clockwise',
    detection: '로비 시계가 태블릿 시각과 다르고 바늘이 거꾸로 돈다.', minAct: 1, purpose: 'Temporal basic.',
  },
  {
    id: 'sys_lobby_board_13', category: 'SYSTEM', difficulty: 2, loc: 'lobby', floors: [1], channels: ['visual', 'reference'], realisation: ['physical'],
    title: '층별 안내에 생긴 13F', baselineState: 'board_B1_to_12F', anomalyState: 'board_lists_13F',
    intendedDifference: 'the lobby directory board has an extra top row: 13F 관리사무소',
    detection: '층별 안내판 맨 위에 13F가 있다.', minAct: 2, purpose: '13 motif, public signage.',
  },
  // ---------------- control room ----------------
  {
    id: 'tmp_log_future_entry', category: 'TEMPORAL', difficulty: 4, loc: 'control', floors: [1], channels: ['records'], realisation: ['data'],
    title: '미래 시각의 일지', baselineState: 'log_up_to_now', anomalyState: 'log_entry_at_0540_by_player',
    intendedDifference: 'the maintenance log contains an entry signed by the player dated tonight 05:40',
    detection: '점검 일지에 05:40에 내가 쓴 기록이 이미 있다.', minAct: 3, purpose: 'Time loop hint.',
  },
  {
    id: 'sys_personnel_two', category: 'SYSTEM', accept: ['HUMAN'], difficulty: 4, loc: 'control', floors: [1], channels: ['records'], realisation: ['data'],
    title: '근무 중인 박정호', baselineState: 'one_night_worker', anomalyState: 'two_workers_on_duty',
    intendedDifference: 'the duty roster lists 박정호 as on duty tonight alongside the player',
    detection: '근무자 현황에 박정호가 근무 중으로 떠 있다. 원본 근로계약서상 오늘 근무자는 나 혼자.', minAct: 3, purpose: 'Former employee returns in data.',
  },
  {
    id: 'sys_identity_record', category: 'SYSTEM', accept: ['META', 'HUMAN'], difficulty: 5, loc: 'control', floors: [1], channels: ['records', 'reference'], realisation: ['data'],
    title: '바뀐 나의 인사 기록', baselineState: 'player_record_matches_contract', anomalyState: 'player_record_rewritten',
    intendedDifference: 'the live personnel record says the player was hired 1994-11-02 as permanent resident night manager; the signed contract says a one-night temporary shift',
    detection: '태블릿 인사 기록과 붉은 도장 근로계약서가 다르다.', minAct: 4, story: true, purpose: 'Final identity check (ending gate).',
  },
  // ---------------- elevator ----------------
  {
    id: 'hum_mirror_figure', category: 'HUMAN', difficulty: 3, loc: 'elevator', channels: ['visual'], realisation: ['physical', 'runtime'],
    title: '거울 속 뒷사람', baselineState: 'mirror_shows_empty_car', anomalyState: 'mirror_shows_person_behind',
    intendedDifference: 'the elevator mirror shows a person standing in the back corner who is not in the car',
    detection: '거울에는 뒤 구석에 사람이 서 있는데 돌아보면 없다.', minAct: 2, purpose: 'Mirror scare.',
  },
  {
    id: 'img_elevator_ad_figure', category: 'IMAGE', difficulty: 3, loc: 'elevator', channels: ['image', 'reference'], realisation: ['physical'],
    title: '광고 속 옥상의 사람', baselineState: 'ad_rendering_normal', anomalyState: 'figure_on_tower_roof',
    intendedDifference: 'a dark human figure stands on the roof edge of the central tower in the redevelopment ad',
    forbiddenDifferences: ['towers changed', 'sky changed', 'ad text changed'],
    detection: '승강기 분양 광고 속 가운데 건물 옥상에 사람이 서 있다.', minAct: 2,
    imagePair: { normal: 'ad_elevator_normal', anomaly: 'ad_elevator_anomaly' }, purpose: 'Printed-image anomaly.',
  },
  {
    id: 'sys_elevator_log_13', category: 'SYSTEM', difficulty: 3, loc: 'elevator', channels: ['records', 'reference'], realisation: ['data'],
    title: '13층 운행 기록', baselineState: 'log_B1_to_12', anomalyState: 'log_trips_to_13',
    intendedDifference: 'the elevator log contains trips to floor 13; the car panel and the archived installation record list only B1–12',
    detection: '승강기 기록에 13층 운행이 있다. 원본 설치 검사서의 정지층은 B1~12층.', minAct: 3, story: true, purpose: 'Systems begin to lie (story).',
  },
  // ---------------- stairwell ----------------
  {
    id: 'geo_stair_loop', category: 'GEOMETRY', difficulty: 3, loc: 'stair', floors: RESIDENTIAL_FLOORS.filter((f) => f >= 4), channels: ['visual'], realisation: ['runtime'],
    title: '같은 층으로 이어지는 계단', baselineState: 'stairs_descend_normally', anomalyState: 'descending_returns_same_floor',
    intendedDifference: 'walking down one flight from this floor arrives back at the same floor number',
    detection: '계단을 내려가도 층 표시가 그대로다.', minAct: 2, purpose: 'Loop geometry.',
  },
  {
    id: 'aud_steps_above', category: 'AUDIO', difficulty: 3, loc: 'stair', floors: [12], channels: ['audio'], realisation: ['runtime'],
    title: '옥상 위의 발소리', baselineState: 'stairwell_quiet', anomalyState: 'footsteps_above_top_floor',
    intendedDifference: 'slow footsteps pace above the 12F landing, where only the locked rooftop door is',
    detection: '12층 계단실 위쪽, 잠긴 옥상 쪽에서 누가 걷는다.', minAct: 2, maxAct: 3, purpose: 'Audio foreshadowing of 13F.',
  },
  {
    id: 'sys_stair_sign', category: 'SYSTEM', difficulty: 2, loc: 'stair', floors: RESIDENTIAL_FLOORS.filter((f) => f <= 10), channels: ['visual'], realisation: ['physical'],
    title: '틀린 층수 표기', baselineState: 'stair_sign_matches_floor', anomalyState: 'stair_sign_two_floors_higher',
    intendedDifference: 'the stairwell floor sign at this landing shows a floor two higher',
    detection: '계단실 층 표시가 실제 층보다 2층 높다.', minAct: 1, purpose: 'Signage lie.',
  },
  // ---------------- parcel room ----------------
  {
    id: 'sys_delivery_vacant', category: 'SYSTEM', difficulty: 4, loc: 'parcel', floors: [1], channels: ['records'], realisation: ['physical', 'data'],
    title: '공실로 온 택배', baselineState: 'no_parcel_for_vacant_units', anomalyState: 'parcel_for_1204_bak',
    intendedDifference: 'a parcel is registered in locker 12 for unit 1204 (박정호), which is officially vacant',
    detection: '택배함에 1204호 박정호 앞 택배. 명부상 1204호는 공실.', minAct: 3, story: true, purpose: 'Contextual logic (story).',
  },
  {
    id: 'obj_lockers_open', category: 'OBJECT', difficulty: 2, loc: 'parcel', floors: [1], channels: ['visual', 'reference'], realisation: ['physical'],
    title: '모두 열린 택배함', baselineState: 'lockers_closed', anomalyState: 'all_lockers_open',
    intendedDifference: 'every locker door in the parcel room stands open',
    detection: '택배함 문이 전부 열려 있다.', minAct: 1, purpose: 'Delivery corner anomaly.',
  },
  // ---------------- B1 ----------------
  {
    id: 'obj_breaker_13', category: 'SYSTEM', accept: ['OBJECT'], difficulty: 4, loc: 'b1', floors: [0], channels: ['visual', 'reference'], realisation: ['physical'],
    title: '13층 차단기', baselineState: 'breakers_12_floors', anomalyState: 'breaker_for_13F',
    intendedDifference: 'the lighting breaker panel has an extra breaker labelled 13층 between 12층 and 옥탑; the archived electrical diagram has none',
    detection: '차단기 목록에 13층이 있다. 원본 전기 계통도에는 없다.', minAct: 3, optional: true, purpose: 'Optional hard anomaly (secret ending).',
  },
  // ---------------- 2F shops ----------------
  {
    id: 'geo_extra_shop', category: 'GEOMETRY', difficulty: 2, loc: 'shops', floors: [2], channels: ['visual', 'reference'], realisation: ['physical'],
    title: '없던 사진관', baselineState: 'six_shops', anomalyState: 'seventh_shop_photo_studio',
    intendedDifference: 'a seventh shutter labelled 청운사진관 appears on the south side',
    detection: '남쪽에 청운사진관 셔터가 있다. 층별 안내와 기준 사진에 없다.', minAct: 2, purpose: 'Commercial-floor geometry.',
  },
  {
    id: 'obj_shutter_open', category: 'OBJECT', difficulty: 2, loc: 'shops', floors: [2], channels: ['visual', 'reference'], realisation: ['physical'],
    title: '반쯤 열린 폐업 치과', baselineState: 'all_shutters_down', anomalyState: 'dental_shutter_half_open_lit',
    intendedDifference: 'the closed dental clinic\'s shutter is half open with bright light inside',
    detection: '폐업한 미소치과 셔터가 반쯤 올라가 있고 안에 불이 켜져 있다.', minAct: 1, purpose: 'Something awake at 3am.',
  },
  // ---------------- residents ----------------
  {
    id: 'hum_resident_smile', category: 'HUMAN', accept: ['SYSTEM', 'IMAGE'], difficulty: 4, loc: 'res', floors: [8], channels: ['records', 'reference'], realisation: ['data'],
    title: '웃고 있는 803호 명부 사진', baselineState: 'directory_photo_neutral', anomalyState: 'directory_photo_wide_smile',
    intendedDifference: 'the live directory photo of 이순자 shows an unnaturally wide smile; the archive resident card shows her calm face',
    detection: '거주자 명부 사진과 원본 입주자 카드 사진이 다르다.', minAct: 3, optional: true,
    imagePair: { normal: 'res_leesoonja', anomaly: 'res_leesoonja_smile' }, purpose: 'Optional identity-record anomaly (secret ending).',
  },
  // ---------------- 13F ----------------
  {
    id: 'geo_floor_13', category: 'GEOMETRY', accept: ['SYSTEM'], difficulty: 5, loc: 'f13', floors: [13], channels: ['visual', 'reference'], realisation: ['physical'],
    title: '존재하지 않는 13층', baselineState: 'building_12_floors', anomalyState: 'floor_13_accessible',
    intendedDifference: 'a thirteenth floor exists above 12F, furnished in 1994',
    detection: '승강기 13 버튼과 13층 복도. 원본 도면은 12층.', minAct: 4, story: true, purpose: 'Act 4 reveal (story).',
  },
  {
    id: 'sys_cctv_13', category: 'SYSTEM', difficulty: 4, loc: 'f13', floors: [13], channels: ['cctv', 'records'], realisation: ['data'],
    title: '새로 생긴 13층 CCTV 채널', baselineState: 'channels_B1_to_12', anomalyState: 'channel_13F_registered',
    intendedDifference: 'the CCTV system lists a 13층 복도 channel, showing 박정호 standing by 1308',
    detection: 'CCTV 채널 목록에 13층이 생겼고 화면에는 1308호 앞에 사람이 서 있다.', minAct: 4, story: true, purpose: 'Former employee located (story).',
  },
];

export const ANOMALIES: AnomalyDef[] = RAW.map((d) => ({
  resetRule: 'on_report',
  persistent: false,
  contaminationImpact: d.difficulty >= 4 ? 14 : 12,
  forbiddenDifferences: ['any unrelated prop moved', 'lighting changed elsewhere', 'text changed elsewhere'],
  ...d,
}));

export const ANOMALY_BY_ID = new Map(ANOMALIES.map((a) => [a.id, a]));

export function anomaly(id: string): AnomalyDef {
  const a = ANOMALY_BY_ID.get(id);
  if (!a) throw new Error(`unknown anomaly ${id}`);
  return a;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  OBJECT: '물체 이상',
  GEOMETRY: '구조 이상',
  IMAGE: '사진·게시물 이상',
  HUMAN: '사람 이상',
  TEMPORAL: '시간 이상',
  AUDIO: '소리 이상',
  SYSTEM: '기록·번호 이상',
  META: '기준 자료 이상',
};

export const CATEGORY_HELP: Record<Category, string> = {
  OBJECT: '물건이 생기거나 사라지거나 옮겨졌다',
  GEOMETRY: '문·벽·창·복도·계단의 구조가 다르다',
  IMAGE: '사진·포스터·액자 속 내용이 달라졌다',
  HUMAN: '있을 수 없는 사람, 혹은 사람의 모습·존재가 이상하다',
  TEMPORAL: '시계·날짜·영상의 시간이 맞지 않는다',
  AUDIO: '있을 수 없는 소리가 나거나 소리가 사라졌다',
  SYSTEM: '명부·기록·호수·표시 정보가 있을 수 없다',
  META: '비교에 쓰는 기준 사진·시설도 자체가 틀렸다',
};

export const CATEGORIES: Category[] = ['OBJECT', 'GEOMETRY', 'IMAGE', 'HUMAN', 'TEMPORAL', 'AUDIO', 'SYSTEM', 'META'];
