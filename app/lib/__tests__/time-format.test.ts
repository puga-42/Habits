import {
  formatElapsed,
  formatTarget,
  secondsFromInput,
  inputFromSeconds,
} from '../time-format';

describe('formatElapsed', () => {
  it('formats seconds display unit', () => {
    expect(formatElapsed(45, 'seconds')).toBe('0:45');
    expect(formatElapsed(90, 'seconds')).toBe('1:30');
  });

  it('formats minutes display unit', () => {
    expect(formatElapsed(0, 'minutes')).toBe('0:00');
    expect(formatElapsed(90, 'minutes')).toBe('1:30');
    expect(formatElapsed(3661, 'minutes')).toBe('61:01');
  });

  it('formats hours display unit', () => {
    expect(formatElapsed(0, 'hours')).toBe('0:00:00');
    expect(formatElapsed(3661, 'hours')).toBe('1:01:01');
    expect(formatElapsed(7200, 'hours')).toBe('2:00:00');
  });

  it('handles zero seconds', () => {
    expect(formatElapsed(0, 'seconds')).toBe('0:00');
    expect(formatElapsed(0, 'minutes')).toBe('0:00');
  });
});

describe('formatTarget', () => {
  it('formats seconds target', () => {
    expect(formatTarget(30, 'seconds')).toBe('30 sec');
    expect(formatTarget(90, 'seconds')).toBe('90 sec');
  });

  it('formats minutes target', () => {
    expect(formatTarget(60, 'minutes')).toBe('1 min');
    expect(formatTarget(1800, 'minutes')).toBe('30 min');
    expect(formatTarget(5400, 'minutes')).toBe('90 min');
  });

  it('formats hours target', () => {
    expect(formatTarget(3600, 'hours')).toBe('1 hr');
    expect(formatTarget(7200, 'hours')).toBe('2 hr');
    expect(formatTarget(5400, 'hours')).toBe('1.5 hr');
  });
});

describe('secondsFromInput', () => {
  it('converts seconds input', () => {
    expect(secondsFromInput(30, 'seconds')).toBe(30);
  });

  it('converts minutes input', () => {
    expect(secondsFromInput(10, 'minutes')).toBe(600);
    expect(secondsFromInput(30, 'minutes')).toBe(1800);
  });

  it('converts hours input', () => {
    expect(secondsFromInput(1, 'hours')).toBe(3600);
    expect(secondsFromInput(2, 'hours')).toBe(7200);
  });
});

describe('inputFromSeconds', () => {
  it('converts to seconds display', () => {
    expect(inputFromSeconds(30, 'seconds')).toBe(30);
  });

  it('converts to minutes display', () => {
    expect(inputFromSeconds(600, 'minutes')).toBe(10);
    expect(inputFromSeconds(1800, 'minutes')).toBe(30);
  });

  it('converts to hours display', () => {
    expect(inputFromSeconds(3600, 'hours')).toBe(1);
    expect(inputFromSeconds(7200, 'hours')).toBe(2);
  });
});
