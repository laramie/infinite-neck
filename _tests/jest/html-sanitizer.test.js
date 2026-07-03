import { isAllowedInfoAnchorHref } from '../../html-sanitizer.js';

describe('html sanitizer Info anchor rules', () => {
  test('allows plugin raise and help URI fragments for Info anchors', () => {
    expect(isAllowedInfoAnchorHref('#raise=transpose.USER')).toBe(true);
    expect(isAllowedInfoAnchorHref('#raise=transpose.USER,raise=arpeggio.MySettings2')).toBe(true);
    expect(isAllowedInfoAnchorHref('#raise=transpose.USER,arpeggio.MySettings2')).toBe(true);
    expect(isAllowedInfoAnchorHref('#raise=arpeggio.color,macro=show-instruments')).toBe(true);
    expect(isAllowedInfoAnchorHref('#macro=show-instruments')).toBe(true);
    expect(isAllowedInfoAnchorHref('help.html#one-line-CommandLine')).toBe(true);
    expect(isAllowedInfoAnchorHref('help.html#key-bindings')).toBe(true);
    expect(isAllowedInfoAnchorHref('help-plugins.html#plugins-summary')).toBe(true);

    expect(isAllowedInfoAnchorHref('http://example.com#raise=transpose.USER')).toBe(false);
    expect(isAllowedInfoAnchorHref('#raise=transpose.Bad.Key')).toBe(false);
    expect(isAllowedInfoAnchorHref('#raise=transpose.Bad,Key')).toBe(false);
    expect(isAllowedInfoAnchorHref('#raise=transpose.USER,macro=1bad')).toBe(false);
    expect(isAllowedInfoAnchorHref('http://example.com#macro=show-instruments')).toBe(false);
    expect(isAllowedInfoAnchorHref('#other=transpose.USER')).toBe(false);
    expect(isAllowedInfoAnchorHref('help.html')).toBe(false);
    expect(isAllowedInfoAnchorHref('help.html#')).toBe(false);
    expect(isAllowedInfoAnchorHref('help-plugins.html')).toBe(false);
    expect(isAllowedInfoAnchorHref('help-plugins.html#')).toBe(false);
    expect(isAllowedInfoAnchorHref('https://example.com/help.html#one-line-CommandLine')).toBe(false);
    expect(isAllowedInfoAnchorHref('https://example.com/help-plugins.html#plugins-summary')).toBe(false);
  });
});
