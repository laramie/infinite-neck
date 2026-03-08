export class Emoji {

    static Chars = Object.freeze({
        FLOPPY_DISK: "\uD83D\uDCBE",           // 💾
        OPEN_FILE_FOLDER: "\uD83D\uDCC2",      // 📂
        PAGE_FACING_UP: "\uD83D\uDCC4",       // 📄
        NOTEBOOK_WITH_DECORATIVE_COVER: "\uD83D\uDCD2", // 🗒
        SCROLL: "\uD83D\uDCDC",               // 📜
        PAGE_WITH_CURL: "\uD83D\uDCC3",       // 📃
        SQUARE_WITH_VERTICAL_FILL: "\u25A4",   // ▤
        THUMBS_UP: "\uD83D\uDC4D",            // 👍
        PANCAKES: "\uD83E\uDD5E",             // 🥞
        CRESCENT_MOON: "\uD83C\uDF1B",        // 🌛
        PROHIBITED: "\uD83D\uDEAB",           // 🚫
        STOP_SIGN: "\uD83D\uDEA9",            // 🛑
        BEETLE: "\uD83E\uDEB2",               // 🪲
        CROSS_MARK: "\u274C",                  // ❌
        GAME_DIE: "\uD83C\uDFB2",             // 🎲
        CHEESE_WEDGE: "\uD83E\uDDC0",         // 🧀
        GLOBE_WITH_MERIDIANS: "\uD83C\uDF10", // 🌐
        BACKHAND_INDEX_POINTING_RIGHT: "\uD83D\uDC49", // 👉
        HEAVY_ROUND_BULLET: "\u25CF"                   // ●
    });

    static get FILEACCESS() { return Emoji.Chars.FLOPPY_DISK; }
    static get FILEINFO() { return Emoji.Chars.OPEN_FILE_FOLDER; }
    static get CONTENTS() { return Emoji.Chars.PAGE_FACING_UP; }
    static get CONTENTS2() { return Emoji.Chars.NOTEBOOK_WITH_DECORATIVE_COVER; }
    static get OK() { return Emoji.Chars.THUMBS_UP; }
    static get PANCAKES() { return Emoji.Chars.PANCAKES; }
    static get NOOP() { return Emoji.Chars.CRESCENT_MOON; }
    static get EMPTY() { return Emoji.Chars.PROHIBITED; }
    static get STOP() { return Emoji.Chars.STOP_SIGN; }
    static get BEETLE() { return Emoji.Chars.BEETLE; }
    static get WARNX() { return Emoji.Chars.CROSS_MARK; }
    static get GENERATE() { return Emoji.Chars.GAME_DIE; }
    static get CHEESE() { return Emoji.Chars.CHEESE_WEDGE; }
    static get BIGPLAN() { return Emoji.Chars.GLOBE_WITH_MERIDIANS; }
    static get INFO() { return Emoji.Chars.BACKHAND_INDEX_POINTING_RIGHT; }
    static get BULLET() { return Emoji.Chars.HEAVY_ROUND_BULLET; }
}
