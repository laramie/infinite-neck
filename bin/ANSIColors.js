
// Singleton ANSIColor with static API and environment detection
class ANSIColors {
    // Static color codes
    static Reset = '\x1b[0m';
    static Bold = '\x1b[1m';
    static Dim =  '\x1b[2m';
    static Underline = '\x1b[4m';
    static Inverse = '\x1b[7m';
    static Black = '\x1b[30m';
    static Red = '\x1b[31m';
    static Green = '\x1b[32m';
    static Yellow = '\x1b[33m';
    static Blue = '\x1b[34m';
    static Magenta = '\x1b[35m';
    static Cyan = '\x1b[36m';
    static White = '\x1b[37m';
    static BgBlack = '\x1b[40m';
    static BgRed = '\x1b[41m';
    static BgGreen = '\x1b[42m';
    static BgYellow = '\x1b[43m';
    static BgBlue = '\x1b[44m';
    static BgMagenta = '\x1b[45m';
    static BgCyan = '\x1b[46m';
    static BgWhite = '\x1b[47m';
    static BQ = ANSIColors.Magenta + '❝' + ANSIColors.Reset;
    static EQ = ANSIColors.Magenta + '❞' + ANSIColors.Reset;
    static BQ_NOCOLOR = '❝';
    static EQ_NOCOLOR = '❞';

    // Singleton instance
    static #instance = null;

    // Internal state
    #nocolor = true;
    #blame = [];

    constructor() {
        this.#nocolor = !ANSIColors.#checkColorSupport();
    }

    static #getInstance() {
        if (!ANSIColors.#instance) {
            ANSIColors.#instance = new ANSIColors();
        }
        return ANSIColors.#instance;
    }

    // Environment color support detection
    static #checkColorSupport() {
        if (typeof process !== 'undefined' && process.env) {
            if (process.env.FORCE_COLOR !== undefined) {
                //console.log('>>>>>>>>>>>>>>FORCE_COLOR:'+process.env.FORCE_COLOR+">>>>>>>>>"+(parseInt(process.env.FORCE_COLOR) > 0));
                return parseInt(process.env.FORCE_COLOR) > 0;
            }
            if (process.env.NO_COLOR !== undefined || process.env.NODE_DISABLE_COLORS !== undefined) {
                //console.log('>>>>>>>>>>>>>>>>>>>>>>NO_COLOR:'+process.env.NO_COLOR);
                return false;
            }
        }
        return false;
    }

    // API: setColor(yes)
    static setColor(yes) {
        const inst = ANSIColors.#getInstance();
        try {
            const err = new Error('ANSIColors.setColor('+yes+') called');
            err.name = "BlameTrace";
            throw err;
        } catch (e) {
            inst.#blame.push(e.stack);
        }
        inst.#nocolor = !yes;
    }

    // API: isColoring()
    static isColoring() {
        return !ANSIColors.#getInstance().#nocolor;
    }

    // API: getBlame()
    static getBlame() {
        return ANSIColors.#getInstance().#blame.join("\n\n");
    }

    // Color methods (camelCase)
    static red(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.Red + m + ANSIColors.Reset;
    }
    static green(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.Green + m + ANSIColors.Reset;
    }
    static yellow(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.Yellow + m + ANSIColors.Reset;
    }
    static blue(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.Blue + m + ANSIColors.Reset;
    }
    static magenta(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.Magenta + m + ANSIColors.Reset;
    }
    static cyan(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.Cyan + m + ANSIColors.Reset;
    }
    static white(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.White + m + ANSIColors.Reset;
    }
    static black(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.Black + m + ANSIColors.Reset;
    }
    // Backgrounds
    static bgBlack(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.BgBlack + m + ANSIColors.Reset;
    }
    static bgRed(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.BgRed + m + ANSIColors.Reset;
    }
    static bgGreen(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.BgGreen + m + ANSIColors.Reset;
    }
    static bgYellow(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.BgYellow + m + ANSIColors.Reset;
    }
    static bgBlue(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.BgBlue + m + ANSIColors.Reset;
    }
    static bgMagenta(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.BgMagenta + m + ANSIColors.Reset;
    }
    static bgCyan(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.BgCyan + m + ANSIColors.Reset;
    }
    static bgWhite(m) {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? m : ANSIColors.BgWhite + m + ANSIColors.Reset;
    }
    // Decorations: open/close and message-wrapping
    static bold(message) {
        const inst = ANSIColors.#getInstance();
        if (typeof message === 'undefined') {
            return inst.#nocolor ? '' : ANSIColors.Bold;
        }
        return inst.#nocolor ? message : ANSIColors.Bold + message + ANSIColors.Reset;
    }
    static dim(message) {
        const inst = ANSIColors.#getInstance();
        if (typeof message === 'undefined') {
            return inst.#nocolor ? '' : ANSIColors.Dim;
        }
        return inst.#nocolor ? message : ANSIColors.Dim + message + ANSIColors.Reset;
    }
    static underline(message) {
        const inst = ANSIColors.#getInstance();
        if (typeof message === 'undefined') {
            return inst.#nocolor ? '' : ANSIColors.Underline;
        }
        return inst.#nocolor ? message : ANSIColors.Underline + message + ANSIColors.Reset;
    }
    static inverse(message) {
        const inst = ANSIColors.#getInstance();
        if (typeof message === 'undefined') {
            return inst.#nocolor ? '' : ANSIColors.Inverse;
        }
        return inst.#nocolor ? message : ANSIColors.Inverse + message + ANSIColors.Reset;
    }
    static reset() {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? '' : ANSIColors.Reset;
    }
    // Special quote accessors
    static bq() {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? ANSIColors.BQ_NOCOLOR : ANSIColors.BQ;
    }
    static eq() {
        const inst = ANSIColors.#getInstance();
        return inst.#nocolor ? ANSIColors.EQ_NOCOLOR : ANSIColors.EQ;
    }
    // For testing
    static testColors(dumpToConsole = false) {
        const names = [
            'Black','Red','Green','Yellow','Blue','Magenta','Cyan','White',
            'BgBlack','BgRed','BgGreen','BgYellow','BgBlue','BgMagenta','BgCyan','BgWhite',
            'Bold','Underline','Dim','Inverse'
        ];
        const fgnames = ['Black','Red','Green','Yellow','Blue','Magenta','Cyan','White'];
        let accum = [];
        let count = 0;

        names.forEach(name => {
            if (ANSIColors[name]) {
                count++;
                accum.push(ANSIColors[name] + name + ANSIColors.Reset);
            }
        });

        fgnames.forEach(name => {
            if (ANSIColors[name]) {
                accum.push(ANSIColors.Bold + ANSIColors[name] + "Bold + " + name + ANSIColors.Reset);
            }
        });

        if (dumpToConsole){
            console.log(accum.join('\n'));
        }


        return count;
    }
}


export { ANSIColors };

