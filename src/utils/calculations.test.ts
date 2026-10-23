import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSDI,
  calculateMarkovProjection,
  DEFAULT_MARKOV_MATRIX,
  DEFAULT_UNIT_COSTS,
  evaluateSegment,
  formatSta,
  generateSegmentsForRuas,
  validateMarkovMatrix,
} from './calculations';

test('formatSta formats meters into Bina Marga STA notation', () => {
  assert.equal(formatSta(0), '0+000');
  assert.equal(formatSta(100), '0+100');
  assert.equal(formatSta(325), '0+325');
  assert.equal(formatSta(1450), '1+450');
});

test('generateSegmentsForRuas splits 325m road into three 100m segments and one 25m remainder', () => {
  const segments = generateSegmentsForRuas('RN-01', 0, 325);
  assert.equal(segments.length, 4);
  assert.equal(segments[0].staLabel, '0+000 - 0+100');
  assert.equal(segments[0].lengthM, 100);
  assert.equal(segments[1].staLabel, '0+100 - 0+200');
  assert.equal(segments[1].lengthM, 100);
  assert.equal(segments[2].staLabel, '0+200 - 0+300');
  assert.equal(segments[2].lengthM, 100);
  assert.equal(segments[3].staLabel, '0+300 - 0+325');
  assert.equal(segments[3].lengthM, 25);
});

test('calculateSDI implements exact 4-step Bina Marga formula across all 4 condition classes', () => {
  // Case 1: Baik (crackArea 4% -> sdi1=5, width 1.5mm -> sdi2=5, 0 potholes -> sdi3=5, 0.5cm rutting -> sdi4=7.5)
  const baik = calculateSDI({
    crackAreaPct: 4,
    crackWidthMm: 1.5,
    potholeCount: 0,
    ruttingDepthCm: 0.5,
    segmentLengthM: 100,
  });
  assert.equal(baik.sdi1, 5);
  assert.equal(baik.sdi2, 5);
  assert.equal(baik.sdi3, 5);
  assert.equal(baik.finalSdi, 7.5);
  assert.equal(baik.condition, 'Baik');

  // Case 2: Sedang (crackArea 15% -> sdi1=20, width 4mm -> sdi2=40, 2 potholes/100m -> sdi3=55, rutting 1.5cm -> sdi4=65)
  const sedang = calculateSDI({
    crackAreaPct: 15,
    crackWidthMm: 4,
    potholeCount: 2,
    ruttingDepthCm: 1.5,
    segmentLengthM: 100,
  });
  assert.equal(sedang.sdi1, 20);
  assert.equal(sedang.sdi2, 40);
  assert.equal(sedang.sdi3, 55);
  assert.equal(sedang.finalSdi, 65);
  assert.equal(sedang.condition, 'Sedang');

  // Case 3: Rusak Ringan (crackArea 22% -> sdi1=20, width 2.5mm -> sdi2=20, 12 potholes/100m -> sdi3=95, rutting 2.2cm -> sdi4=105)
  const rusakRingan = calculateSDI({
    crackAreaPct: 22,
    crackWidthMm: 2.5,
    potholeCount: 12,
    ruttingDepthCm: 2.2,
    segmentLengthM: 100,
  });
  assert.equal(rusakRingan.sdi1, 20);
  assert.equal(rusakRingan.sdi2, 20);
  assert.equal(rusakRingan.sdi3, 95);
  assert.equal(rusakRingan.finalSdi, 105);
  assert.equal(rusakRingan.condition, 'Rusak Ringan');

  // Case 4: Rusak Berat on a 25m remainder segment (crackArea 35% -> sdi1=40, width 5mm -> sdi2=80, 4 potholes in 25m = 16/100m -> sdi3=155, rutting 3.5cm -> sdi4=175)
  const rusakBerat = calculateSDI({
    crackAreaPct: 35,
    crackWidthMm: 5,
    potholeCount: 4,
    ruttingDepthCm: 3.5,
    segmentLengthM: 25,
  });
  assert.equal(rusakBerat.sdi1, 40);
  assert.equal(rusakBerat.sdi2, 80);
  assert.equal(rusakBerat.potholesPer100m, 16);
  assert.equal(rusakBerat.sdi3, 155);
  assert.equal(rusakBerat.finalSdi, 175);
  assert.equal(rusakBerat.condition, 'Rusak Berat');
});

test('evaluateSegment computes exact proportional segment cost (25m at Rp 50.000.000/km = Rp 1.250.000)', () => {
  const seg = generateSegmentsForRuas('RN-01', 300, 325)[0];
  const evaluation = evaluateSegment(seg, 6.0, DEFAULT_UNIT_COSTS);
  assert.equal(evaluation.condition, 'Baik');
  assert.equal(evaluation.treatment, 'Pemeliharaan Rutin');
  assert.equal(evaluation.priorityRank, 'P4');
  assert.equal(evaluation.estimatedCostRp, 1_250_000);
});

test('calculateMarkovProjection weights initial state strictly by segment length in meters', () => {
  const segments = generateSegmentsForRuas('RN-01', 0, 325);
  // Seg 1 (100m): Baik
  segments[0].crackAreaPct = 4;
  // Seg 2 (100m): Sedang
  segments[1].crackAreaPct = 15;
  segments[1].crackWidthMm = 4;
  segments[1].potholeCount = 2;
  segments[1].ruttingDepthCm = 1.5;
  // Seg 3 (100m): Rusak Ringan
  segments[2].crackAreaPct = 22;
  segments[2].potholeCount = 12;
  segments[2].ruttingDepthCm = 2.2;
  // Seg 4 (25m): Rusak Berat
  segments[3].crackAreaPct = 35;
  segments[3].crackWidthMm = 5;
  segments[3].potholeCount = 4;
  segments[3].ruttingDepthCm = 3.5;

  const proj = calculateMarkovProjection(segments, DEFAULT_MARKOV_MATRIX, 2026, 5);
  assert.equal(proj.length, 6);
  // Year 0 lengths must match exact meters: 100m, 100m, 100m, 25m
  assert.equal(proj[0].lengthsM.Baik, 100);
  assert.equal(proj[0].lengthsM.Sedang, 100);
  assert.equal(proj[0].lengthsM['Rusak Ringan'], 100);
  assert.equal(proj[0].lengthsM['Rusak Berat'], 25);
  // Proportions: 100/325 = 30.77%, 25/325 = 7.69%
  assert.equal(proj[0].proportions.Baik, 30.77);
  assert.equal(proj[0].proportions['Rusak Berat'], 7.69);
});

test('validateMarkovMatrix validates row sums = 1.00', () => {
  const checkDefault = validateMarkovMatrix(DEFAULT_MARKOV_MATRIX);
  assert.equal(checkDefault.valid, true);

  const badMatrix = JSON.parse(JSON.stringify(DEFAULT_MARKOV_MATRIX));
  badMatrix[0][0] = 0.5;
  const checkBad = validateMarkovMatrix(badMatrix);
  assert.equal(checkBad.valid, false);
  assert.deepEqual(checkBad.invalidRows, [0]);
});
