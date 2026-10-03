// 2D facility plans drawn by code (Korean labels rendered at runtime, never by image generation).
import { B1, EXTINGUISHER_BOX, FLOOR_13, HYDRANT, SHOPS, UNIT_SLOTS, floorLabel, unitNumber } from '../data/building';
import { FONT } from '../world/textures';

export interface PlanOpts {
  archive: boolean;
  extraUnit?: boolean; // META: live map draws a ninth unit
  f13?: boolean;
}

const S = 30;
const OX = -15.5;
const OZ = -7.2;
const px = (x: number) => (x - OX) * S;
const pz = (z: number) => (z - OZ) * S;

export function drawPlan(c: HTMLCanvasElement, floor: number, o: PlanOpts): void {
  c.width = 1040;
  c.height = 430;
  const g = c.getContext('2d')!;
  const ink = o.archive ? '#2c2a26' : '#c9ced6';
  const faint = o.archive ? 'rgba(44,42,38,0.45)' : 'rgba(201,206,214,0.35)';
  const fillRoom = o.archive ? 'rgba(120,100,60,0.08)' : 'rgba(255,255,255,0.035)';
  const accent = o.archive ? '#b3261e' : '#e2a441';
  g.fillStyle = o.archive ? '#e9e3d4' : '#0f1113';
  g.fillRect(0, 0, c.width, c.height);
  // grid
  g.strokeStyle = o.archive ? 'rgba(80,70,50,0.08)' : 'rgba(255,255,255,0.04)';
  g.lineWidth = 1;
  for (let x = 0; x < c.width; x += S) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, c.height);
    g.stroke();
  }
  for (let y = 0; y < c.height; y += S) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(c.width, y);
    g.stroke();
  }
  const rect = (x0: number, z0: number, x1: number, z1: number, label?: string, size = 15, fill = fillRoom) => {
    g.fillStyle = fill;
    g.fillRect(px(x0), pz(z0), (x1 - x0) * S, (z1 - z0) * S);
    g.strokeStyle = ink;
    g.lineWidth = 2;
    g.strokeRect(px(x0), pz(z0), (x1 - x0) * S, (z1 - z0) * S);
    if (label) {
      g.fillStyle = ink;
      g.font = `700 ${size}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label, px((x0 + x1) / 2), pz((z0 + z1) / 2));
    }
  };
  const doorMark = (x: number, z: number) => {
    g.strokeStyle = accent;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(px(x - 0.48), pz(z));
    g.lineTo(px(x + 0.48), pz(z));
    g.stroke();
  };
  const dot = (x: number, z: number, color: string, label: string) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(px(x), pz(z), 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = ink;
    g.font = `500 11px ${FONT}`;
    g.textAlign = 'center';
    g.fillText(label, px(x), pz(z) + 14);
  };
  // shared core: corridor, hall, shaft, stair
  const westX = o.extraUnit ? -16 : -12;
  rect(westX, -1.1, 12, 1.1, '', 14, o.archive ? 'rgba(120,100,60,0.04)' : 'rgba(255,255,255,0.02)');
  rect(-1.6, -3.6, 1.6, -1.1, '승강기 홀', 12);
  rect(-1.0, -5.6, 1.0, -3.6, 'EV', 13, o.archive ? 'rgba(80,70,50,0.12)' : 'rgba(255,255,255,0.06)');
  rect(12, -2.5, 18.2, 2.5, '비상계단', 14);
  g.fillStyle = faint;
  g.font = `600 12px ${FONT}`;
  g.textAlign = 'center';
  g.fillText('복도', px(-7.2), pz(0) + 4);

  const kind = floor === B1 ? 'b1' : floor === 1 ? 'lobby' : floor === 2 ? 'shops' : 'res';
  if (kind === 'res') {
    for (const s of UNIT_SLOTS) {
      const north = s.side === -1;
      const w = s.idx === 7 ? 4.2 : 4.4;
      if (north) rect(s.x - w / 2, -6.6, s.x + w / 2, -1.1, `${unitNumber(floor, s.idx)}호`, 15);
      else rect(s.x - w / 2, 1.1, s.x + w / 2, 6.6, `${unitNumber(floor, s.idx)}호`, 15);
      doorMark(s.x, north ? -1.1 : 1.1);
    }
    rect(7.4, 1.1, 10.8, 3.3, 'EPS', 11);
    if (o.extraUnit) {
      rect(-16, -6.6, -12.1, -1.1, `${unitNumber(floor, 9)}호`, 15);
      doorMark(-14, -1.1);
    }
    // west window
    g.strokeStyle = o.archive ? '#3a6fa0' : '#7fa6c9';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(px(westX), pz(-0.7));
    g.lineTo(px(westX), pz(0.7));
    g.stroke();
    dot(EXTINGUISHER_BOX.x, -0.8, '#c8412f', '소화기');
    dot(HYDRANT.x, 0.8, '#c8412f', '소화전');
    if (floor === 5) {
      g.fillStyle = accent;
      for (const x of [-3.1, 2.8]) g.fillRect(px(x - 0.4), pz(-1.1) - 3, 0.8 * S, 6);
      for (const x of [-7.25, -2.5, 2.3]) g.fillRect(px(x - 0.4), pz(1.1) - 3, 0.8 * S, 6);
      g.fillStyle = ink;
      g.font = `500 11px ${FONT}`;
      g.fillText('액자 5점 (추억 사진전)', px(0), pz(1.1) + 16);
    }
  } else if (kind === 'lobby') {
    rect(-12, -6.6, -3, -1.25, '관리실', 16);
    rect(6.2, -5.6, 11.8, -1.25, '택배보관실', 15);
    rect(-4, 1.1, 4, 3.6, '로비 · 출입구', 14);
    doorMark(-5, -1.1);
    doorMark(8, -1.1);
    g.strokeStyle = accent;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(px(-1.2), pz(3.6));
    g.lineTo(px(1.2), pz(3.6));
    g.stroke();
    g.fillStyle = ink;
    g.font = `500 11px ${FONT}`;
    g.fillText('출입문', px(0), pz(3.6) + 14);
    dot(3.6, 2.9, '#7fa6c9', '자판기');
    dot(-3.7, 2.2, '#7fa6c9', '우편함');
    dot(3.4, -0.9, '#7fa6c9', '층별 안내');
  } else if (kind === 'shops') {
    for (const s of SHOPS) {
      const north = s.side === -1;
      if (north) rect(s.x - 1.8, -6.6, s.x + 1.8, -1.1, s.name, 13);
      else rect(s.x - 1.8, 1.1, s.x + 1.8, 6.6, s.name, 13);
    }
  } else {
    rect(-12, -6.6, -3, -1.25, '전기실', 16);
    rect(-10, 1.25, -3, 6.0, '문서고', 16);
    rect(-15.2, -1.1, -12.1, 1.1, '기계실', 12);
  }
  // title block
  g.fillStyle = ink;
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.font = `800 20px ${FONT}`;
  g.fillText(`청운빌딩 ${floor === FLOOR_13 ? '13층' : floorLabel(floor)} 평면`, 16, 12);
  g.font = `500 12px ${FONT}`;
  g.fillStyle = faint;
  g.fillText(o.archive ? '1994. 11. 30. 사용승인 도면 원본 (A1)' : '시설관리 시스템 · 실시간 시설도 (사본)', 16, 38);
  if (o.archive) {
    g.save();
    g.translate(c.width - 70, 58);
    g.rotate(-0.2);
    g.strokeStyle = '#b3261e';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, 34, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#b3261e';
    g.font = `900 17px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('원본', 0, 0);
    g.restore();
  }
  // scale bar
  g.strokeStyle = ink;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(16, c.height - 18);
  g.lineTo(16 + 5 * S, c.height - 18);
  g.stroke();
  g.fillStyle = ink;
  g.font = `500 11px ${FONT}`;
  g.textAlign = 'left';
  g.textBaseline = 'bottom';
  g.fillText('5 m', 16, c.height - 22);
}
