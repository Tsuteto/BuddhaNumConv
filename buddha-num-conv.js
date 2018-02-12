/*
 * BuddhaNumConv
 *
 * Converts an exponent number by Buddhist large numeral system
 *
 * Author: Tsuteto
 * Licensed under MIT
 */

BuddhaNumConv.DEFAULT_OPTIONS = {
    ruby: true,
    allInKanji: false,
    rakushaToComma: false,
    spacing: true
};

function BuddhaNumConv(coef, exp) {
    this.input = {
        // coefficient
        coef: coef + "",
        // exponent
        exp: exp + ""
    };

    this.options = BuddhaNumConv.DEFAULT_OPTIONS;

    this.coef = null;
    this.exp = null;
    this.expLow = null;
    this.negative = false;
    this.result = [];
}

BuddhaNumConv.prototype = {

    setOptions: function(opts) {
        $.extend(this.options, opts);
        return this;
    },

    validate: function() {
        if (!isNumber(this.input.coef) || !isNumber(this.input.exp)) {
            throw new Error("数を入力しないと変換できません。。");
        }
        if (this.input.exp.indexOf(".") > -1) {
            throw new Error("右の方に入れられるのは整数だけです");
        }
    },

    convert: function() {
        this.validate();

        this.coef = new BigNumber(this.input.coef);
        this.exp = new BigNumber(this.input.exp);

        // Sign
        if (this.coef.lt(0)) {
            this.negative = true;
            this.coef = this.coef.abs();
        }

        // Normalize
        if (this.coef.gte(10)) {
            var extra = this.coef.e;
            this.coef = this.coef.shiftedBy(-extra);
            this.exp = this.exp.plus(extra);
        }

        // Obtain lowest exp.
        var coefLen = Math.max(this.coef.toString().length - 2, 0);
        this.expLow = this.exp.minus(coefLen);
        if (this.expLow.isNegative()) {
            this.expLow = new BigNumber(0);
        }

        var loop = 0;
        var mod = this.exp.mod(7).toNumber();

        // Obtain scales order
        var scales = this.getScale(this.exp, 0);

        // Give numbers between the scales
        scales.forEach(function(entry) {
            var head = this.coef.shiftedBy(mod).decimalPlaces(0, BigNumber.ROUND_DOWN);

            this.result.push({
                scale: entry.scale,
                pos: entry.pos,
                num: head
            });

            this.coef = this.coef.shiftedBy(mod).minus(head);
            mod = 7;
        }.bind(this));

        // Add a number at the last if the coef is still remaining
        if (!this.coef.eq(0)) {
            var head = this.coef.shiftedBy(mod).decimalPlaces(0, BigNumber.ROUND_DOWN);
            this.result.push({
                scale: null,
                num: head
            });
        }

        return this;
    },

    // Get a scale list ordering higher to lower
    getScale: function(exp, pos) {
        var currExp = new BigNumber(exp);
        var currPos = new BigNumber(pos);
        var scales = [];

        while (true) {
            if (currExp.lt(7)) break;

            var ord = currExp.div(7).log2Int();
            var scale = BuddhaNumConv.scaleTable[ord];

            if (!scale) {
                // Overflow! Call lovely Bonono-chan
                throw new Error("むーりぃー…");
            }

            if (ord > 0) {
                // Continue recursion within a range needed
                var nextExp = scale.zeros.minus(1);
                if (nextExp.plus(currPos).gte(this.expLow)) {
                    scales = this.getScale(nextExp, currPos).concat(scales);
                }
            }

            currExp = currExp.minus(scale.zeros);
            currPos = currPos.plus(scale.zeros);
            scales.unshift({scale: scale, pos: currPos});
        }

        return scales;
    },

    getBasicScalesByKanji: function(num) {
        var digits = num.split("").reverse();
        var bScales = BuddhaNumConv.basicScales;
        var scales = [];

        digits.forEach(function(d, idx) {
            if (idx < 4) {
                scales.unshift({scale: bScales[idx][d], num: null});
            } else if (idx == 4) {
                if (d != 0) {
                    scales.unshift({scale: BuddhaNumConv.scaleMan, num: null});
                }
                scales.unshift({scale: bScales[0][d], num: null})
            } else if (idx == 5) {
                scales.unshift({scale: BuddhaNumConv.scaleRakusha, num: null});
                scales.unshift({scale: bScales[0][d], num: null})
            } else if (idx == 6) {
                scales.unshift({scale: bScales[1][d], num: null})
            }
        }.bind(this));
        return scales;
    },

    getBasicScales: function(num) {
        var beforeRakusha = num.slice(-5);
        var afterRakusha = num.length > 5 ? num.slice(0, -5).replace(/^0+/, "") : 0;

        if (afterRakusha != 0) {
            var rakusha = this.options.rakushaToComma ? BuddhaNumConv.scaleComma : BuddhaNumConv.scaleRakusha;
            if (!this.options.rakushaToComma) {
                beforeRakusha = beforeRakusha.replace(/^0+/, "");
            }
            return [{num: afterRakusha, scale: rakusha}, {num: beforeRakusha, scale: null}];
        } else {
            return [{num: beforeRakusha.replace(/^0+/, ""), scale: null}];
        }
    },

    output: function($result) {
        $result.empty();

        var $buf = [];

        if (this.negative) {
            if (this.options.allInKanji) {
                $buf.push(this.getTextNode("負", "ふ"));
            } else {
                $buf.push(this.getTextNode("-", null))
            }
        }

        this.result.forEach(function(entry) {
            var scale = entry.scale;

            if (!entry.num.eq(0)) {
                var basicScales;
                if (this.options.allInKanji) {
                    basicScales = this.getBasicScalesByKanji(entry.num.toString());
                } else {
                    basicScales = this.getBasicScales(entry.num.toString());
                }
                basicScales.forEach(function(entry) {
                    $buf.push(entry.num);
                    if (entry.scale) {
                        $buf.push(this.outputBasicScale(entry.scale));
                    }
                }.bind(this));
            }

            if (scale != null) {
                if (entry.num.eq(0) && entry.pos.gte(this.expLow)) {
                    return;
                }

                $buf.push(this.outputScale(scale));
                if (this.options.spacing) {
                    $buf.push(" ");
                }
            }
        }.bind(this));

        if (this.result.length == 0) {
            // Just zero
            if (this.options.allInKanji) {
                $buf.push(this.outputBasicScale(BuddhaNumConv.zero));
            } else {
                $buf.push(0);
            }
        }
        $result[0].innerHTML = $buf.join("");
    },

    outputScale: function(scale) {
        if (scale.name != null) {
            return this.getTextNode(scale.name, scale.ruby);
        } else {
            return null;
        }
    },
    outputBasicScale: function(scale) {
        if (scale.name != null) {
            return this.getTextNode(scale.name, scale.ruby);
        } else {
            return null;
        }
    },

    getTextNode: function(text, yomi) {
        if (this.options.ruby && yomi) {
            /*
            var ruby = $("<ruby>").text(text);
            ruby.append($("<rt>").text(yomi));
            */
            var ruby = "<ruby>" + text + "<rt>" + yomi + "</rt></ruby>"
            return ruby;
        } else {
            return text;
        }
    }

};

// Calculate log_2(x) as an integer
BigNumber.prototype.log2Int = function() {
    return this.decimalPlaces(0, BigNumber.ROUND_DOWN).toString(2).length - 1;
}

function isNumber(val) {
    return val.match(/^[-+]?([0-9]+\.?|\.[0-9]+|[0-9]+\.[0-9]+)$/)
}

BuddhaNumConv.zero = {name: "〇", ruby: "れい"};

BuddhaNumConv.basicScales = {
    0: [
        {name: null, ruby: null},
        {name: "一", ruby: "いち"},
        {name: "二", ruby: "に"},
        {name: "三", ruby: "さん"},
        {name: "四", ruby: "よん"},
        {name: "五", ruby: "ご"},
        {name: "六", ruby: "ろく"},
        {name: "七", ruby: "なな"},
        {name: "八", ruby: "はち"},
        {name: "九", ruby: "きゅう"}
    ],
    1: [
        {name: null, ruby: null},
        {name: "十", ruby: "じゅう"},
        {name: "二十", ruby: "にじゅう"},
        {name: "三十", ruby: "さんじゅう"},
        {name: "四十", ruby: "よんじゅう"},
        {name: "五十", ruby: "ごじゅう"},
        {name: "六十", ruby: "ろくじゅう"},
        {name: "七十", ruby: "ななじゅう"},
        {name: "八十", ruby: "はちじゅう"},
        {name: "九十", ruby: "きゅうじゅう"}
    ],
    2: [
        {name: null, ruby: null},
        {name: "百", ruby: "ひゃく"},
        {name: "二百", ruby: "にひゃく"},
        {name: "三百", ruby: "さんびゃく"},
        {name: "四百", ruby: "よんひゃく"},
        {name: "五百", ruby: "ごひゃく"},
        {name: "六百", ruby: "ろっぴゃく"},
        {name: "七百", ruby: "ななひゃく"},
        {name: "八百", ruby: "はっぴゃく"},
        {name: "九百", ruby: "きゅうひゃく"}
    ],
    3: [
        {name: null, ruby: null},
        {name: "千", ruby: "せん"},
        {name: "二千", ruby: "にせん"},
        {name: "三千", ruby: "さんぜん"},
        {name: "四千", ruby: "よんせん"},
        {name: "五千", ruby: "ごせん"},
        {name: "六千", ruby: "ろくせん"},
        {name: "七千", ruby: "ななせん"},
        {name: "八千", ruby: "はっせん"},
        {name: "九千", ruby: "きゅうせん"}],
};

BuddhaNumConv.scaleMan = {
    name: "万", ruby: "まん"
};

BuddhaNumConv.scaleRakusha = {
    name: "洛叉", ruby: "らくしゃ"
};
BuddhaNumConv.scaleComma = {
    name: ",", ruby: null
};

BuddhaNumConv.scaleTable = [
    {name: "倶胝", ruby: "くてい", zeros: new BigNumber("7"), ordinal: 0},
    {name: "阿庾多", ruby: "あゆた", zeros: new BigNumber("14"), ordinal: 1},
    {name: "那由他", ruby: "なゆた", zeros: new BigNumber("28"), ordinal: 2},
    {name: "頻波羅", ruby: "びんばら", zeros: new BigNumber("56"), ordinal: 3},
    {name: "矜羯羅", ruby: "こんがら", zeros: new BigNumber("112"), ordinal: 4},
    {name: "阿伽羅", ruby: "あから", zeros: new BigNumber("224"), ordinal: 5},
    {name: "最勝", ruby: "さいしょう", zeros: new BigNumber("448"), ordinal: 6},
    {name: "摩婆羅", ruby: "まばら", zeros: new BigNumber("896"), ordinal: 7},
    {name: "阿婆羅", ruby: "あばら", zeros: new BigNumber("1792"), ordinal: 8},
    {name: "多婆羅", ruby: "たばら", zeros: new BigNumber("3584"), ordinal: 9},
    {name: "界分", ruby: "かいぶん", zeros: new BigNumber("7168"), ordinal: 10},
    {name: "普摩", ruby: "ふま", zeros: new BigNumber("14336"), ordinal: 11},
    {name: "禰摩", ruby: "ねま", zeros: new BigNumber("28672"), ordinal: 12},
    {name: "阿婆鈐", ruby: "あばけん", zeros: new BigNumber("57344"), ordinal: 13},
    {name: "弥伽婆", ruby: "みかば", zeros: new BigNumber("114688"), ordinal: 14},
    {name: "毘攞伽", ruby: "びらか", zeros: new BigNumber("229376"), ordinal: 15},
    {name: "毘伽婆", ruby: "びかば", zeros: new BigNumber("458752"), ordinal: 16},
    {name: "僧羯邏摩", ruby: "そうがらま", zeros: new BigNumber("917504"), ordinal: 17},
    {name: "毘薩羅", ruby: "びさら", zeros: new BigNumber("1835008"), ordinal: 18},
    {name: "毘贍婆", ruby: "びせんば", zeros: new BigNumber("3670016"), ordinal: 19},
    {name: "毘盛伽", ruby: "びじょうが", zeros: new BigNumber("7340032"), ordinal: 20},
    {name: "毘素陀", ruby: "びすだ", zeros: new BigNumber("14680064"), ordinal: 21},
    {name: "毘婆訶", ruby: "びばか", zeros: new BigNumber("29360128"), ordinal: 22},
    {name: "毘薄底", ruby: "びばてい", zeros: new BigNumber("58720256"), ordinal: 23},
    {name: "毘佉擔", ruby: "びきゃたん", zeros: new BigNumber("117440512"), ordinal: 24},
    {name: "称量", ruby: "しょうりょう", zeros: new BigNumber("234881024"), ordinal: 25},
    {name: "一持", ruby: "いちじ", zeros: new BigNumber("469762048"), ordinal: 26},
    {name: "異路", ruby: "いろ", zeros: new BigNumber("939524096"), ordinal: 27},
    {name: "顛倒", ruby: "てんどう", zeros: new BigNumber("1879048192"), ordinal: 28},
    {name: "三末耶", ruby: "さんまや", zeros: new BigNumber("3758096384"), ordinal: 29},
    {name: "毘睹羅", ruby: "びとら", zeros: new BigNumber("7516192768"), ordinal: 30},
    {name: "奚婆羅", ruby: "けいばら", zeros: new BigNumber("15032385536"), ordinal: 31},
    {name: "伺察", ruby: "しさつ", zeros: new BigNumber("30064771072"), ordinal: 32},
    {name: "周広", ruby: "しゅうこう", zeros: new BigNumber("60129542144"), ordinal: 33},
    {name: "高出", ruby: "こうしゅつ", zeros: new BigNumber("120259084288"), ordinal: 34},
    {name: "最妙", ruby: "さいみょう", zeros: new BigNumber("240518168576"), ordinal: 35},
    {name: "泥羅婆", ruby: "ないらば", zeros: new BigNumber("481036337152"), ordinal: 36},
    {name: "訶理婆", ruby: "かりば", zeros: new BigNumber("962072674304"), ordinal: 37},
    {name: "一動", ruby: "いちどう", zeros: new BigNumber("1924145348608"), ordinal: 38},
    {name: "訶理蒲", ruby: "かりぼ", zeros: new BigNumber("3848290697216"), ordinal: 39},
    {name: "訶理三", ruby: "かりさん", zeros: new BigNumber("7696581394432"), ordinal: 40},
    {name: "奚魯伽", ruby: "けいろか", zeros: new BigNumber("15393162788864"), ordinal: 41},
    {name: "達攞歩陀", ruby: "たつらほだ", zeros: new BigNumber("30786325577728"), ordinal: 42},
    {name: "訶魯那", ruby: "かろな", zeros: new BigNumber("61572651155456"), ordinal: 43},
    {name: "摩魯陀", ruby: "まろだ", zeros: new BigNumber("123145302310912"), ordinal: 44},
    {name: "懺慕陀", ruby: "ざんぼだ", zeros: new BigNumber("246290604621824"), ordinal: 45},
    {name: "瑿攞陀", ruby: "えいらだ", zeros: new BigNumber("492581209243648"), ordinal: 46},
    {name: "摩魯摩", ruby: "まろま", zeros: new BigNumber("985162418487296"), ordinal: 47},
    {name: "調伏", ruby: "ちょうぶく", zeros: new BigNumber("1970324836974592"), ordinal: 48},
    {name: "離憍慢", ruby: "りきょうまん", zeros: new BigNumber("3940649673949184"), ordinal: 49},
    {name: "不動", ruby: "ふどう", zeros: new BigNumber("7881299347898368"), ordinal: 50},
    {name: "極量", ruby: "ごくりょう", zeros: new BigNumber("15762598695796736"), ordinal: 51},
    {name: "阿麼怛羅", ruby: "あまたら", zeros: new BigNumber("31525197391593472"), ordinal: 52},
    {name: "勃麼怛羅", ruby: "ぼまたら", zeros: new BigNumber("63050394783186944"), ordinal: 53},
    {name: "伽麼怛羅", ruby: "がまたら", zeros: new BigNumber("126100789566373888"), ordinal: 54},
    {name: "那麼怛羅", ruby: "なまたら", zeros: new BigNumber("252201579132747776"), ordinal: 55},
    {name: "奚麼怛羅", ruby: "けいまたら", zeros: new BigNumber("504403158265495552"), ordinal: 56},
    {name: "鞞麼怛羅", ruby: "べいまたら", zeros: new BigNumber("1008806316530991104"), ordinal: 57},
    {name: "鉢羅麼怛羅", ruby: "はらまたら", zeros: new BigNumber("2017612633061982208"), ordinal: 58},
    {name: "尸婆麼怛羅", ruby: "しばまたら", zeros: new BigNumber("4035225266123964416"), ordinal: 59},
    {name: "翳羅", ruby: "えいら", zeros: new BigNumber("8070450532247928832"), ordinal: 60},
    {name: "薜羅", ruby: "べいら", zeros: new BigNumber("16140901064495857664"), ordinal: 61},
    {name: "諦羅", ruby: "たいら", zeros: new BigNumber("32281802128991715328"), ordinal: 62},
    {name: "偈羅", ruby: "げら", zeros: new BigNumber("64563604257983430656"), ordinal: 63},
    {name: "窣歩羅", ruby: "そほら", zeros: new BigNumber("129127208515966861312"), ordinal: 64},
    {name: "泥羅", ruby: "ないら", zeros: new BigNumber("258254417031933722624"), ordinal: 65},
    {name: "計羅", ruby: "けいら", zeros: new BigNumber("516508834063867445248"), ordinal: 66},
    {name: "細羅", ruby: "さいら", zeros: new BigNumber("1033017668127734890496"), ordinal: 67},
    {name: "睥羅", ruby: "へいら", zeros: new BigNumber("2066035336255469780992"), ordinal: 68},
    {name: "謎羅", ruby: "めいら", zeros: new BigNumber("4132070672510939561984"), ordinal: 69},
    {name: "娑攞荼", ruby: "しゃらだ", zeros: new BigNumber("8264141345021879123968"), ordinal: 70},
    {name: "謎魯陀", ruby: "めいろだ", zeros: new BigNumber("16528282690043758247936"), ordinal: 71},
    {name: "契魯陀", ruby: "けいろだ", zeros: new BigNumber("33056565380087516495872"), ordinal: 72},
    {name: "摩睹羅", ruby: "まとら", zeros: new BigNumber("66113130760175032991744"), ordinal: 73},
    {name: "娑母羅", ruby: "しゃもら", zeros: new BigNumber("132226261520350065983488"), ordinal: 74},
    {name: "阿野娑", ruby: "あやしゃ", zeros: new BigNumber("264452523040700131966976"), ordinal: 75},
    {name: "迦麼羅", ruby: "かまら", zeros: new BigNumber("528905046081400263933952"), ordinal: 76},
    {name: "摩伽婆", ruby: "まかば", zeros: new BigNumber("1057810092162800527867904"), ordinal: 77},
    {name: "阿怛羅", ruby: "あたら", zeros: new BigNumber("2115620184325601055735808"), ordinal: 78},
    {name: "醯魯耶", ruby: "けいろや", zeros: new BigNumber("4231240368651202111471616"), ordinal: 79},
    {name: "薜魯婆", ruby: "べいろば", zeros: new BigNumber("8462480737302404222943232"), ordinal: 80},
    {name: "羯羅波", ruby: "からは", zeros: new BigNumber("16924961474604808445886464"), ordinal: 81},
    {name: "訶婆婆", ruby: "かばば", zeros: new BigNumber("33849922949209616891772928"), ordinal: 82},
    {name: "毘婆羅", ruby: "びばら", zeros: new BigNumber("67699845898419233783545856"), ordinal: 83},
    {name: "那婆羅", ruby: "なばら", zeros: new BigNumber("135399691796838467567091712"), ordinal: 84},
    {name: "摩攞羅", ruby: "まらら", zeros: new BigNumber("270799383593676935134183424"), ordinal: 85},
    {name: "娑婆羅", ruby: "しゃばら", zeros: new BigNumber("541598767187353870268366848"), ordinal: 86},
    {name: "迷攞普", ruby: "めいらふ", zeros: new BigNumber("1083197534374707740536733696"), ordinal: 87},
    {name: "者麼羅", ruby: "しゃまら", zeros: new BigNumber("2166395068749415481073467392"), ordinal: 88},
    {name: "駄麼羅", ruby: "だまら", zeros: new BigNumber("4332790137498830962146934784"), ordinal: 89},
    {name: "鉢攞麼陀", ruby: "はらまだ", zeros: new BigNumber("8665580274997661924293869568"), ordinal: 90},
    {name: "毘迦摩", ruby: "びかま", zeros: new BigNumber("17331160549995323848587739136"), ordinal: 91},
    {name: "烏波跋多", ruby: "うはばた", zeros: new BigNumber("34662321099990647697175478272"), ordinal: 92},
    {name: "演説", ruby: "えんぜつ", zeros: new BigNumber("69324642199981295394350956544"), ordinal: 93},
    {name: "無尽", ruby: "むじん", zeros: new BigNumber("138649284399962590788701913088"), ordinal: 94},
    {name: "出生", ruby: "しゅっしょう", zeros: new BigNumber("277298568799925181577403826176"), ordinal: 95},
    {name: "無我", ruby: "むが", zeros: new BigNumber("554597137599850363154807652352"), ordinal: 96},
    {name: "阿畔多", ruby: "あばんた", zeros: new BigNumber("1109194275199700726309615304704"), ordinal: 97},
    {name: "青蓮華", ruby: "しょうれんげ", zeros: new BigNumber("2218388550399401452619230609408"), ordinal: 98},
    {name: "鉢頭摩", ruby: "はどま", zeros: new BigNumber("4436777100798802905238461218816"), ordinal: 99},
    {name: "僧祇", ruby: "そうぎ", zeros: new BigNumber("8873554201597605810476922437632"), ordinal: 100},
    {name: "趣", ruby: "しゅ", zeros: new BigNumber("17747108403195211620953844875264"), ordinal: 101},
    {name: "至", ruby: "し", zeros: new BigNumber("35494216806390423241907689750528"), ordinal: 102},
    {name: "阿僧祇", ruby: "あそうぎ", zeros: new BigNumber("70988433612780846483815379501056"), ordinal: 103},
    {name: "阿僧祇転", ruby: "あそうぎてん", zeros: new BigNumber("141976867225561692967630759002112"), ordinal: 104},
    {name: "無量", ruby: "むりょう", zeros: new BigNumber("283953734451123385935261518004224"), ordinal: 105},
    {name: "無量転", ruby: "むりょうてん", zeros: new BigNumber("567907468902246771870523036008448"), ordinal: 106},
    {name: "無辺", ruby: "むへん", zeros: new BigNumber("1135814937804493543741046072016896"), ordinal: 107},
    {name: "無辺転", ruby: "むへんてん", zeros: new BigNumber("2271629875608987087482092144033792"), ordinal: 108},
    {name: "無等", ruby: "むとう", zeros: new BigNumber("4543259751217974174964184288067584"), ordinal: 109},
    {name: "無等転", ruby: "むとうてん", zeros: new BigNumber("9086519502435948349928368576135168"), ordinal: 110},
    {name: "不可数", ruby: "ふかすう", zeros: new BigNumber("18173039004871896699856737152270336"), ordinal: 111},
    {name: "不可数転", ruby: "ふかすうてん", zeros: new BigNumber("36346078009743793399713474304540672"), ordinal: 112},
    {name: "不可称", ruby: "ふかしょう", zeros: new BigNumber("72692156019487586799426948609081344"), ordinal: 113},
    {name: "不可称転", ruby: "ふかしょうてん", zeros: new BigNumber("145384312038975173598853897218162688"), ordinal: 114},
    {name: "不可思", ruby: "ふかし", zeros: new BigNumber("290768624077950347197707794436325376"), ordinal: 115},
    {name: "不可思転", ruby: "ふかしてん", zeros: new BigNumber("581537248155900694395415588872650752"), ordinal: 116},
    {name: "不可量", ruby: "ふかりょう", zeros: new BigNumber("1163074496311801388790831177745301504"), ordinal: 117},
    {name: "不可量転", ruby: "ふかりょうてん", zeros: new BigNumber("2326148992623602777581662355490603008"), ordinal: 118},
    {name: "不可説", ruby: "ふかせつ", zeros: new BigNumber("4652297985247205555163324710981206016"), ordinal: 119},
    {name: "不可説転", ruby: "ふかせつてん", zeros: new BigNumber("9304595970494411110326649421962412032"), ordinal: 120},
    {name: "不可説不可説", ruby: "ふかせつふかせつ", zeros: new BigNumber("18609191940988822220653298843924824064"), ordinal: 121},
    {name: "不可説不可説転", ruby: "ふかせつふかせつてん", zeros: new BigNumber("37218383881977644441306597687849648128"), ordinal: 122}
];

