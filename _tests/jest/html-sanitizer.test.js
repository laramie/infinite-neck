import { isAllowedInfoAnchorHref } from '../../html-sanitizer.js';

describe('html sanitizer Info anchor rules', () => {
  test('allows only plugin raise URI fragments for Info anchors', () => {
    expect(isAllowedInfoAnchorHref('#raise=transpose.USER')).toBe(true);
    expect(isAllowedInfoAnchorHref('#raise=transpose.USER,raise=arpeggio.MySettings2')).toBe(true);
    expect(isAllowedInfoAnchorHref('#raise=transpose.USER,arpeggio.MySettings2')).toBe(true);

    expect(isAllowedInfoAnchorHref('http://example.com#raise=transpose.USER')).toBe(false);
    expect(isAllowedInfoAnchorHref('#raise=transpose.Bad.Key')).toBe(false);
    expect(isAllowedInfoAnchorHref('#raise=transpose.Bad,Key')).toBe(false);
    expect(isAllowedInfoAnchorHref('#other=transpose.USER')).toBe(false);
  });
});
