/**
 * CryptoJS core components.
 */
var CryptoJS = CryptoJS || (function (Math, undefined) {
    var C = {};
    var C_lib = C.lib = {};
    var Base = C_lib.Base = (function () {
        function F() {};
        return {
            extend: function (overrides) {
                F.prototype = this;
                var subtype = new F();
                if (overrides) {
                    subtype.mixIn(overrides);
                }
                if (!subtype.hasOwnProperty('init')) {
                    subtype.init = function () {
                        subtype.$super.init.apply(this, arguments);
                    };
                }
                subtype.init.prototype = subtype;
                subtype.$super = this;
                return subtype;
            },
            create: function () {
                var instance = this.extend();
                instance.init.apply(instance, arguments);
                return instance;
            },
            init: function () {},
            mixIn: function (properties) {
                for (var propertyName in properties) {
                    if (properties.hasOwnProperty(propertyName)) {
                        this[propertyName] = properties[propertyName];
                    }
                }
                if (properties.hasOwnProperty('toString')) {
                    this.toString = properties.toString;
                }
            },
            clone: function () {
                return this.init.prototype.extend(this);
            }
        };
    }());

    var WordArray = C_lib.WordArray = Base.extend({
        init: function (words, sigBytes) {
            words = this.words = words || [];
            if (sigBytes != undefined) {
                this.sigBytes = sigBytes;
            } else {
                this.sigBytes = words.length * 4;
            }
        },
        toString: function (encoder) {
            return (encoder || Hex).stringify(this);
        },
        concat: function (wordArray) {
            var thisWords = this.words;
            var thatWords = wordArray.words;
            var thisSigBytes = this.sigBytes;
            var thatSigBytes = wordArray.sigBytes;
            this.clamp();
            if (thisSigBytes % 4) {
                for (var i = 0; i < thatSigBytes; i++) {
                    var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                    thisWords[(thisSigBytes + i) >>> 2] |= thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
                }
            } else {
                for (var i = 0; i < thatSigBytes; i += 4) {
                    thisWords[(thisSigBytes + i) >>> 2] = thatWords[i >>> 2];
                }
            }
            this.sigBytes += thatSigBytes;
            return this;
        },
        clamp: function () {
            var words = this.words;
            var sigBytes = this.sigBytes;
            words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
            words.length = Math.ceil(sigBytes / 4);
        },
        clone: function () {
            var clone = Base.clone.call(this);
            clone.words = this.words.slice(0);
            return clone;
        },
        random: function (nBytes) {
            var words = [];
            var r = (function (m_w) {
                var m_w = m_w;
                var m_z = 0x3ade68b1;
                var mask = 0xffffffff;
                return function () {
                    m_z = (0x9069 * (m_z & 0xFFFF) + (m_z >> 16)) & mask;
                    m_w = (0x4650 * (m_w & 0xFFFF) + (m_w >> 16)) & mask;
                    var result = ((m_z << 16) + (m_w & 0xFFFF)) & mask;
                    result /= 0x100000000;
                    result += 0.5;
                    return result * (Math.random() > .5 ? 1 : -1);
                }
            });
            for (var i = 0, rcache; i < nBytes; i += 4) {
                var _r = r((rcache || Math.random()) * 0x100000000);
                rcache = _r() * 0x3ade67b7;
                words.push((_r() * 0x100000000) | 0);
            }
            return new WordArray.init(words, nBytes);
        }
    });

    var C_enc = C.enc = {};
    var Hex = C_enc.Hex = {
        stringify: function (wordArray) {
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var hexChars = [];
            for (var i = 0; i < sigBytes; i++) {
                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                hexChars.push((bite >>> 4).toString(16));
                hexChars.push((bite & 0x0f).toString(16));
            }
            return hexChars.join('');
        },
        parse: function (hexStr) {
            var hexStrLength = hexStr.length;
            var words = [];
            for (var i = 0; i < hexStrLength; i += 2) {
                words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
            }
            return new WordArray.init(words, hexStrLength / 2);
        }
    };

    var Latin1 = C_enc.Latin1 = {
        stringify: function (wordArray) {
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var latin1Chars = [];
            for (var i = 0; i < sigBytes; i++) {
                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                latin1Chars.push(String.fromCharCode(bite));
            }
            return latin1Chars.join('');
        },
        parse: function (latin1Str) {
            var latin1StrLength = latin1Str.length;
            var words = [];
            for (var i = 0; i < latin1StrLength; i++) {
                words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
            }
            return new WordArray.init(words, latin1StrLength);
        }
    };

    var Utf8 = C_enc.Utf8 = {
        stringify: function (wordArray) {
            try {
                return decodeURIComponent(escape(Latin1.stringify(wordArray)));
            } catch (e) {
                throw new Error('Malformed UTF-8 data');
            }
        },
        parse: function (utf8Str) {
            return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
        }
    };

    var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
        reset: function () {
            this._data = new WordArray.init();
            this._nDataBytes = 0;
        },
        _append: function (data) {
            if (typeof data == 'string') {
                data = Utf8.parse(data);
            }
            this._data.concat(data);
            this._nDataBytes += data.sigBytes;
        },
        _process: function (doFlush) {
            var data = this._data;
            var words = data.words;
            var dataSigBytes = data.sigBytes;
            var blockSize = this.blockSize;
            var blockSizeBytes = blockSize * 4;
            var nBlocksReady = dataSigBytes / blockSizeBytes;
            if (doFlush) {
                nBlocksReady = Math.ceil(nBlocksReady);
            } else {
                nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
            }
            var nWordsReady = nBlocksReady * blockSize;
            var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);
            if (nWordsReady) {
                for (var offset = 0; offset < nWordsReady; offset += blockSize) {
                    this._doProcessBlock(words, offset);
                }
                var processedWords = words.splice(0, nWordsReady);
                data.sigBytes -= nBytesReady;
            }
            return new WordArray.init(processedWords, nBytesReady);
        },
        clone: function () {
            var clone = Base.clone.call(this);
            clone._data = this._data.clone();
            return clone;
        },
        _minBufferSize: 0
    });

    C.algo = C.algo || {};

    return C;
}(Math));

(function (undefined) {
    if (typeof CryptoJS == 'undefined') {
        var CryptoJS = CryptoJS || (function (Math, undefined) {
            var C = {};
            var C_lib = C.lib = {};
            var Base = C_lib.Base = function () {
                function F() {};
                return {
                    extend: function (overrides) {
                        F.prototype = this;
                        var subtype = new F();
                        if (overrides) {
                            subtype.mixIn(overrides);
                        }
                        if (!subtype.hasOwnProperty('init')) {
                            subtype.init = function () {
                                subtype.$super.init.apply(this, arguments);
                            };
                        }
                        subtype.init.prototype = subtype;
                        subtype.$super = this;
                        return subtype;
                    },
                    create: function () {
                        var instance = this.extend();
                        instance.init.apply(instance, arguments);
                        return instance;
                    },
                    init: function () {},
                    mixIn: function (properties) {
                        for (var propertyName in properties) {
                            if (properties.hasOwnProperty(propertyName)) {
                                this[propertyName] = properties[propertyName];
                            }
                        }
                        if (properties.hasOwnProperty('toString')) {
                            this.toString = properties.toString;
                        }
                    },
                    clone: function () {
                        return this.init.prototype.extend(this);
                    }
                };
            }();
            var WordArray = C_lib.WordArray = Base.extend({
                init: function (words, sigBytes) {
                    words = this.words = words || [];
                    if (sigBytes != undefined) {
                        this.sigBytes = sigBytes;
                    } else {
                        this.sigBytes = words.length * 4;
                    }
                },
                toString: function (encoder) {
                    return (encoder || Hex).stringify(this);
                },
                concat: function (wordArray) {
                    var thisWords = this.words;
                    var thatWords = wordArray.words;
                    var thisSigBytes = this.sigBytes;
                    var thatSigBytes = wordArray.sigBytes;
                    this.clamp();
                    if (thisSigBytes % 4) {
                        for (var i = 0; i < thatSigBytes; i++) {
                            var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                            thisWords[(thisSigBytes + i) >>> 2] |= thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
                        }
                    } else {
                        for (var i = 0; i < thatSigBytes; i += 4) {
                            thisWords[(thisSigBytes + i) >>> 2] = thatWords[i >>> 2];
                        }
                    }
                    this.sigBytes += thatSigBytes;
                    return this;
                },
                clamp: function () {
                    var words = this.words;
                    var sigBytes = this.sigBytes;
                    words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
                    words.length = Math.ceil(sigBytes / 4);
                },
                clone: function () {
                    var clone = Base.clone.call(this);
                    clone.words = this.words.slice(0);
                    return clone;
                },
                random: function (nBytes) {
                    var words = [];
                    var r = (function (m_w) {
                        var m_w = m_w;
                        var m_z = 0x3ade68b1;
                        var mask = 0xffffffff;
                        return function () {
                            m_z = (0x9069 * (m_z & 0xFFFF) + (m_z >> 16)) & mask;
                            m_w = (0x4650 * (m_w & 0xFFFF) + (m_w >> 16)) & mask;
                            var result = ((m_z << 16) + (m_w & 0xFFFF)) & mask;
                            result /= 0x100000000;
                            result += 0.5;
                            return result * (Math.random() > .5 ? 1 : -1);
                        }
                    });
                    for (var i = 0, rcache; i < nBytes; i += 4) {
                        var _r = r((rcache || Math.random()) * 0x100000000);
                        rcache = _r() * 0x3ade67b7;
                        words.push((_r() * 0x100000000) | 0);
                    }
                    return new WordArray.init(words, nBytes);
                }
            });
            var C_enc = C.enc = {};
            var Hex = C_enc.Hex = {
                stringify: function (wordArray) {
                    var words = wordArray.words;
                    var sigBytes = wordArray.sigBytes;
                    var hexChars = [];
                    for (var i = 0; i < sigBytes; i++) {
                        var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                        hexChars.push((bite >>> 4).toString(16));
                        hexChars.push((bite & 0x0f).toString(16));
                    }
                    return hexChars.join('');
                },
                parse: function (hexStr) {
                    var hexStrLength = hexStr.length;
                    var words = [];
                    for (var i = 0; i < hexStrLength; i += 2) {
                        words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
                    }
                    return new WordArray.init(words, hexStrLength / 2);
                }
            };
            var Latin1 = C_enc.Latin1 = {
                stringify: function (wordArray) {
                    var words = wordArray.words;
                    var sigBytes = wordArray.sigBytes;
                    var latin1Chars = [];
                    for (var i = 0; i < sigBytes; i++) {
                        var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                        latin1Chars.push(String.fromCharCode(bite));
                    }
                    return latin1Chars.join('');
                },
                parse: function (latin1Str) {
                    var latin1StrLength = latin1Str.length;
                    var words = [];
                    for (var i = 0; i < latin1StrLength; i++) {
                        words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
                    }
                    return new WordArray.init(words, latin1StrLength);
                }
            };
            var Utf8 = C_enc.Utf8 = {
                stringify: function (wordArray) {
                    try {
                        return decodeURIComponent(escape(Latin1.stringify(wordArray)));
                    } catch (e) {
                        throw new Error('Malformed UTF-8 data');
                    }
                },
                parse: function (utf8Str) {
                    return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
                }
            };
            var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
                reset: function () {
                    this._data = new WordArray.init();
                    this._nDataBytes = 0;
                },
                _append: function (data) {
                    if (typeof data == 'string') {
                        data = Utf8.parse(data);
                    }
                    this._data.concat(data);
                    this._nDataBytes += data.sigBytes;
                },
                _process: function (doFlush) {
                    var data = this._data;
                    var words = data.words;
                    var dataSigBytes = data.sigBytes;
                    var blockSize = this.blockSize;
                    var blockSizeBytes = blockSize * 4;
                    var nBlocksReady = dataSigBytes / blockSizeBytes;
                    if (doFlush) {
                        nBlocksReady = Math.ceil(nBlocksReady);
                    } else {
                        nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
                    }
                    var nWordsReady = nBlocksReady * blockSize;
                    var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);
                    if (nWordsReady) {
                        for (var offset = 0; offset < nWordsReady; offset += blockSize) {
                            this._doProcessBlock(words, offset);
                        }
                        var processedWords = words.splice(0, nWordsReady);
                        data.sigBytes -= nBytesReady;
                    }
                    return new WordArray.init(processedWords, nBytesReady);
                },
                clone: function () {
                    var clone = Base.clone.call(this);
                    clone._data = this._data.clone();
                    return clone;
                },
                _minBufferSize: 0
            });
            C.algo = C.algo || {};
            return C;
        }(Math));
        var C = CryptoJS;
    }

    function F() {};
    C.lib.Base = function () {
        return {
            extend: function (overrides) {
                F.prototype = this;
                var subtype = new F();
                if (overrides) {
                    subtype.mixIn(overrides);
                }
                if (!subtype.hasOwnProperty('init')) {
                    subtype.init = function () {
                        subtype.$super.init.apply(this, arguments);
                    };
                }
                subtype.init.prototype = subtype;
                subtype.$super = this;
                return subtype;
            },
            create: function () {
                var instance = this.extend();
                instance.init.apply(instance, arguments);
                return instance;
            },
            init: function () {},
            mixIn: function (properties) {
                for (var propertyName in properties) {
                    if (properties.hasOwnProperty(propertyName)) {
                        this[propertyName] = properties[propertyName];
                    }
                }
                if (properties.hasOwnProperty('toString')) {
                    this.toString = properties.toString;
                }
            },
            clone: function () {
                return this.init.prototype.extend(this);
            }
        };
    }();
    C.lib.WordArray = Base.extend({
        init: function (words, sigBytes) {
            words = this.words = words || [];
            if (sigBytes != undefined) {
                this.sigBytes = sigBytes;
            } else {
                this.sigBytes = words.length * 4;
            }
        },
        toString: function (encoder) {
            return (encoder || Hex).stringify(this);
        },
        concat: function (wordArray) {
            var thisWords = this.words;
            var thatWords = wordArray.words;
            var thisSigBytes = this.sigBytes;
            var thatSigBytes = wordArray.sigBytes;
            this.clamp();
            if (thisSigBytes % 4) {
                for (var i = 0; i < thatSigBytes; i++) {
                    var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                    thisWords[(thisSigBytes + i) >>> 2] |= thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
                }
            } else {
                for (var i = 0; i < thatSigBytes; i += 4) {
                    thisWords[(thisSigBytes + i) >>> 2] = thatWords[i >>> 2];
                }
            }
            this.sigBytes += thatSigBytes;
            return this;
        },
        clamp: function () {
            var words = this.words;
            var sigBytes = this.sigBytes;
            words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
            words.length = Math.ceil(sigBytes / 4);
        },
        clone: function () {
            var clone = Base.clone.call(this);
            clone.words = this.words.slice(0);
            return clone;
        },
        random: function (nBytes) {
            var words = [];
            var r = (function (m_w) {
                var m_w = m_w;
                var m_z = 0x3ade68b1;
                var mask = 0xffffffff;
                return function () {
                    m_z = (0x9069 * (m_z & 0xFFFF) + (m_z >> 16)) & mask;
                    m_w = (0x4650 * (m_w & 0xFFFF) + (m_w >> 16)) & mask;
                    var result = ((m_z << 16) + (m_w & 0xFFFF)) & mask;
                    result /= 0x100000000;
                    result += 0.5;
                    return result * (Math.random() > .5 ? 1 : -1);
                }
            });
            for (var i = 0, rcache; i < nBytes; i += 4) {
                var _r = r((rcache || Math.random()) * 0x100000000);
                rcache = _r() * 0x3ade67b7;
                words.push((_r() * 0x100000000) | 0);
            }
            return new WordArray.init(words, nBytes);
        }
    });
}());
