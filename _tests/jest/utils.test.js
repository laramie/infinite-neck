import { convertRGB_to_HEX } from '../../utils.js';

describe('convertRGB_to_HEX', () => {
  test('converts rgb colors', () => {
    expect(convertRGB_to_HEX('rgb(255, 254, 248)')).toBe('#fffef8');
  });

  test('converts rgba colors by ignoring alpha', () => {
    expect(convertRGB_to_HEX('rgba(84, 79, 73, 0.45)')).toBe('#544f49');
  });

  test('extracts a color stop from gradients', () => {
    expect(convertRGB_to_HEX('linear-gradient(180deg, #fffef8 0%, #f5f0e1 65%, #ddd2b5 100%)')).toBe('#fffef8');
  });

  test('returns null for transparent colors', () => {
    expect(convertRGB_to_HEX('transparent')).toBeNull();
    expect(convertRGB_to_HEX('rgba(0, 0, 0, 0)')).toBeNull();
  });

  test('returns null for unsupported inputs', () => {
    expect(convertRGB_to_HEX(null)).toBeNull();
    expect(convertRGB_to_HEX('inherit')).toBeNull();
  });
});