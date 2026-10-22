import {
  SAME_BASE_MAX_GAP_MS,
  SAME_BASE_MIN_GAP_MS,
  TOUCH_PROBE_TARGET,
  median,
  p95,
  recordTouch,
  touchProbeReport,
  type TouchSample,
} from './touchProbeReport';

/** Des appuis reçus par le JS `gap` ms après leur toucher, sur la même base. */
function samplesWithGaps(gaps: readonly number[], touchedAt = 1_000): TouchSample[] {
  return gaps.map((gap, index) => ({
    touchedAt: touchedAt + index * 1_000,
    receivedAt: touchedAt + index * 1_000 + gap,
  }));
}

/** 20 appuis dont l'écart vaut `gap` ms, sauf le premier, qui vaut `first`. */
function twentyWith(first: number, gap = 8): TouchSample[] {
  return samplesWithGaps([first, ...Array.from({ length: 19 }, () => gap)]);
}

describe('median', () => {
  it('is the middle value of an odd number of samples, whatever their order', () => {
    expect(median([9, 1, 5])).toBe(5);
  });

  it('is the mean of the two middle values of an even number of samples', () => {
    expect(median([10, 2, 4, 8])).toBe(6);
  });

  it('is the only value of a single sample', () => {
    expect(median([7])).toBe(7);
  });

  it('does not exist without samples', () => {
    expect(median([])).toBeNull();
  });

  it('does not reorder the samples it is given', () => {
    const samples = [3, 1, 2];

    median(samples);

    expect(samples).toEqual([3, 1, 2]);
  });
});

describe('p95 (nearest rank)', () => {
  it('is the 19th smallest of 20 samples', () => {
    const samples = Array.from({ length: 20 }, (_, index) => 20 - index);

    expect(p95(samples)).toBe(19);
  });

  it('is the largest of fewer than 20 samples', () => {
    expect(p95([4, 12, 9])).toBe(12);
  });

  it('is the 20th smallest of 21 samples', () => {
    const samples = Array.from({ length: 21 }, (_, index) => index + 1);

    expect(p95(samples)).toBe(20);
  });

  it('is the only value of a single sample', () => {
    expect(p95([7])).toBe(7);
  });

  it('does not exist without samples', () => {
    expect(p95([])).toBeNull();
  });

  it('does not reorder the samples it is given', () => {
    const samples = [3, 1, 2];

    p95(samples);

    expect(samples).toEqual([3, 1, 2]);
  });
});

describe('recordTouch', () => {
  it('adds a touch, dated by its beginning and by its reception', () => {
    expect(recordTouch([], 1_000, 1_008)).toEqual([{ touchedAt: 1_000, receivedAt: 1_008 }]);
  });

  it('keeps the touches already recorded, in order', () => {
    const first = recordTouch([], 1_000, 1_008);

    expect(recordTouch(first, 2_000, 2_005)).toEqual([
      { touchedAt: 1_000, receivedAt: 1_008 },
      { touchedAt: 2_000, receivedAt: 2_005 },
    ]);
    expect(first).toHaveLength(1);
  });

  it(`ignores the touches after the ${TOUCH_PROBE_TARGET}th`, () => {
    const full = twentyWith(8);

    expect(recordTouch(full, 99_000, 99_008)).toBe(full);
  });
});

describe('touchProbeReport', () => {
  it(`aims at ${TOUCH_PROBE_TARGET} touches, inside a same-base gap of [−2 ms, 500 ms]`, () => {
    expect(TOUCH_PROBE_TARGET).toBe(20);
    expect(SAME_BASE_MIN_GAP_MS).toBe(-2);
    expect(SAME_BASE_MAX_GAP_MS).toBe(500);
  });

  it('reports nothing measured without any touch', () => {
    expect(touchProbeReport([])).toEqual({
      count: 0,
      complete: false,
      median: null,
      p95: null,
      method: null,
    });
  });

  it('counts the touches and is complete at the target', () => {
    expect(touchProbeReport(samplesWithGaps([8, 9])).count).toBe(2);
    expect(touchProbeReport(samplesWithGaps([8, 9])).complete).toBe(false);
    expect(touchProbeReport(twentyWith(8)).count).toBe(20);
    expect(touchProbeReport(twentyWith(8)).complete).toBe(true);
  });

  it('measures the median and the p95 of the gaps between touch and reception', () => {
    const gaps = Array.from({ length: 20 }, (_, index) => index + 1);

    const report = touchProbeReport(samplesWithGaps(gaps));

    expect(report.median).toBe(10.5);
    expect(report.p95).toBe(19);
  });

  describe('method (a): touches dated on the same base as the JS clock', () => {
    it.each([
      ['the lower bound', -2],
      ['the upper bound', 500],
      ['an ordinary gap', 8],
    ])('is chosen when every gap is within the range, %s included', (_, gap) => {
      expect(touchProbeReport(twentyWith(gap)).method).toBe('a');
    });

    it('is chosen without any calibration', () => {
      expect(touchProbeReport(twentyWith(8), undefined).method).toBe('a');
    });

    it('is chosen even when a calibration exists', () => {
      expect(touchProbeReport(twentyWith(8), { offset: 1_000 }).method).toBe('a');
    });
  });

  describe('method (b): a calibrated offset brings the gaps into the range', () => {
    it.each([
      ['−3 ms, just below the range', -3],
      ['501 ms, just above the range', 501],
    ])('is not (a) as soon as one gap is %s', (_, gap) => {
      expect(touchProbeReport(twentyWith(gap)).method).not.toBe('a');
    });

    it('is chosen when the UI clock is ahead and the offset compensates for it', () => {
      // Horloge UI en avance de 50 s : le JS reçoit chaque toucher 50 s « avant » qu'il ait lieu.
      const samples = samplesWithGaps(Array.from({ length: 20 }, () => 8 - 50_000));

      const report = touchProbeReport(samples, { offset: 50_000 });

      expect(report.method).toBe('b');
      expect(report.median).toBe(8);
      expect(report.p95).toBe(8);
    });

    it('is chosen when the UI clock is behind and the offset compensates for it', () => {
      const samples = samplesWithGaps(Array.from({ length: 20 }, () => 8 + 50_000));

      expect(touchProbeReport(samples, { offset: -50_000 }).method).toBe('b');
    });

    it.each([
      ['the lower bound', -2],
      ['the upper bound', 500],
    ])('is chosen when a calibrated gap is exactly %s', (_, gap) => {
      const samples = samplesWithGaps([gap - 50_000, ...Array.from({ length: 19 }, () => -49_992)]);

      expect(touchProbeReport(samples, { offset: 50_000 }).method).toBe('b');
    });
  });

  describe('method (c): touches dated at their JS reception', () => {
    it('is chosen when the gaps are out of range and nothing was calibrated', () => {
      expect(touchProbeReport(twentyWith(501)).method).toBe('c');
    });

    it.each([
      ['−3 ms', -3],
      ['501 ms', 501],
    ])('is chosen when a calibrated gap is %s, just out of range', (_, gap) => {
      const samples = samplesWithGaps([gap - 50_000, ...Array.from({ length: 19 }, () => -49_992)]);

      expect(touchProbeReport(samples, { offset: 50_000 }).method).toBe('c');
    });

    it('reports the raw gaps, since no offset makes them comparable', () => {
      const gaps = Array.from({ length: 20 }, (_, index) => 1_000 + index);

      const report = touchProbeReport(samplesWithGaps(gaps), { offset: 10 });

      expect(report.method).toBe('c');
      expect(report.median).toBe(1_009.5);
      expect(report.p95).toBe(1_018);
    });
  });
});
