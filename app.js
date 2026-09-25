// Беларуская практычная транскрыпцыя кітайскай мовы (НАН Беларусі 2026)
// Кліенцкі рухавік транскрыпцыі

(function() {
    'use strict';

    if (typeof PINYIN_DATA === 'undefined') {
        console.error("PINYIN_DATA не загружаны!");
        return;
    }

    const {
        pinyin_to_be,
        pinyin_to_ru,
        ru_to_pinyin,
        toponyms,
        extra_words,
        char_to_pinyin
    } = PINYIN_DATA;

    const BE_VOWELS = new Set('аеёіоуыэюяАЕЁІОУЫЭЮЯ');

    // Remove diacritics from pinyin
    function cleanPinyin(py) {
        if (!py) return '';
        const fromChars = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü';
        const toChars   = 'aaaaeeeeiiiioooouuuuuuuuu';
        let res = '';
        for (let i = 0; i < py.length; i++) {
            const ch = py[i].toLowerCase();
            const idx = fromChars.indexOf(ch);
            res += (idx !== -1) ? toChars[idx] : ch;
        }
        return res;
    }

    // Sort syllables by length descending for greedy/DP matching
    const sortedPinyin = Object.keys(pinyin_to_be).sort((a, b) => b.length - a.length);
    const sortedRu = Object.keys(ru_to_pinyin).sort((a, b) => b.length - a.length);

    // Build compound word index from extra_words and toponyms
    const compoundWords = [];
    const compoundByPinyin = {};
    const compoundByRu = {};

    function registerCompound(c) {
        compoundWords.push(c);
        if (c.pinyin) {
            const cleanPy = cleanPinyin(c.pinyin).toLowerCase().replace(/[^a-z]/g, '');
            if (cleanPy && !compoundByPinyin[cleanPy]) {
                compoundByPinyin[cleanPy] = c;
            }
        }
        if (c.ru) {
            const cleanRu = c.ru.toLowerCase().replace(/[^а-яёіў]/g, '');
            if (cleanRu && !compoundByRu[cleanRu]) {
                compoundByRu[cleanRu] = c;
            }
        }
    }

    if (extra_words) {
        extra_words.forEach(w => registerCompound(w));
    }
    if (toponyms) {
        toponyms.forEach(t => {
            registerCompound({
                hanzi: t.hanzi,
                pinyin: t.pinyin,
                be: t.be_clean || t.be,
                ru: t.ru,
                desc: 'Геаграфічная назва / тапонім'
            });
        });
    }

    // Sort compounds by hanzi length descending
    compoundWords.sort((a, b) => (b.hanzi ? b.hanzi.length : 0) - (a.hanzi ? a.hanzi.length : 0));

    // Syllables to Belarusian with junction rules
    function syllablesToBelarusian(syls) {
        const beParts = [];
        for (let i = 0; i < syls.length; i++) {
            const syl = syls[i];
            const be = pinyin_to_be[syl] || syl;
            if (i > 0) {
                const prev = beParts[beParts.length - 1];
                // Junction rule: ends with 'н' and next starts with vowel
                if (prev.endsWith('н') && be.length > 0 && BE_VOWELS.has(be[0])) {
                    beParts.push('’');
                }
            }
            beParts.push(be);
        }
        return beParts.join('');
    }

    // Segment pinyin word into syllables
    function segmentPinyinWord(word) {
        const parts = word.split(/['’]/);
        const allSyls = [];
        for (const part of parts) {
            const clean = cleanPinyin(part);
            if (!clean) continue;
            const n = clean.length;
            const dp = { 0: [] };
            for (let i = 0; i < n; i++) {
                if (!dp[i]) continue;
                for (const syl of sortedPinyin) {
                    if (clean.startsWith(syl, i)) {
                        const nxt = i + syl.length;
                        if (!dp[nxt] || dp[i].length + 1 < dp[nxt].length) {
                            dp[nxt] = dp[i].concat([syl]);
                        }
                    }
                }
            }
            if (dp[n]) {
                allSyls.push(...dp[n]);
            } else {
                let pos = 0;
                while (pos < n) {
                    let matched = false;
                    for (const syl of sortedPinyin) {
                        if (clean.startsWith(syl, pos)) {
                            allSyls.push(syl);
                            pos += syl.length;
                            matched = true;
                            break;
                        }
                    }
                    if (!matched) {
                        allSyls.push(clean[pos]);
                        pos += 1;
                    }
                }
            }
        }
        return allSyls;
    }

    // Segment Russian Palladius word into syllables
    function segmentRuWord(word) {
        const subparts = word.toLowerCase().split(/[ъ’']/);
        const resSyls = [];
        for (const part of subparts) {
            if (!part) continue;
            const n = part.length;
            const dp = { 0: [] };
            for (let i = 0; i < n; i++) {
                if (!dp[i]) continue;
                for (const syl of sortedRu) {
                    if (part.startsWith(syl, i)) {
                        const nxt = i + syl.length;
                        if (!dp[nxt] || dp[i].length + 1 < dp[nxt].length) {
                            dp[nxt] = dp[i].concat([syl]);
                        }
                    }
                }
            }
            if (dp[n]) {
                resSyls.push(...dp[n]);
            } else {
                let pos = 0;
                while (pos < n) {
                    let matched = false;
                    for (const syl of sortedRu) {
                        if (part.startsWith(syl, pos)) {
                            resSyls.push(syl);
                            pos += syl.length;
                            matched = true;
                            break;
                        }
                    }
                    if (!matched) {
                        resSyls.push(part[pos]);
                        pos += 1;
                    }
                }
            }
        }
        return resSyls;
    }

    function isHanzi(ch) {
        const code = ch.charCodeAt(0);
        return (code >= 0x4E00 && code <= 0x9FFF) ||
               (code >= 0x3400 && code <= 0x4DBF) ||
               (code >= 0x20000 && code <= 0x2A6DF) ||
               ch === '〇';
    }

    // Convert Chinese characters / text to pinyin and Belarusian
    function transcribeChinese(text) {
        if (!text || !text.trim()) return null;

        let hasHanzi = false;
        for (let i = 0; i < text.length; i++) {
            if (isHanzi(text[i])) {
                hasHanzi = true;
                break;
            }
        }

        let fullBe = '';
        let fullPinyin = '';
        let fullRu = '';

        if (hasHanzi) {
            let pos = 0;
            while (pos < text.length) {
                const ch = text[pos];
                if (!isHanzi(ch)) {
                    fullBe += ch;
                    fullPinyin += ch;
                    fullRu += ch;
                    pos++;
                    continue;
                }

                // Check compound match
                let matchedCompound = null;
                for (const comp of compoundWords) {
                    if (text.startsWith(comp.hanzi, pos)) {
                        matchedCompound = comp;
                        break;
                    }
                }

                if (matchedCompound) {
                    const beWord = matchedCompound.be;
                    const ruWord = matchedCompound.ru || '';

                    if (fullBe && !/[\s\n\.,!?;:—\-\/]$/.test(fullBe) && !beWord.startsWith(' ')) {
                        fullBe += ' ';
                        fullRu += ' ';
                    }

                    fullBe += beWord;
                    fullPinyin += (fullPinyin && !fullPinyin.endsWith(' ') ? ' ' : '') + matchedCompound.pinyin;
                    fullRu += ruWord;

                    pos += matchedCompound.hanzi.length;
                    continue;
                }

                // Single character lookup
                const rawPy = char_to_pinyin[ch] || '';
                const cleanPy = cleanPinyin(rawPy);
                let beChar = pinyin_to_be[cleanPy] || cleanPy || ch;
                let ruChar = pinyin_to_ru[cleanPy] || cleanPy || ch;

                const isWordStart = (pos === 0) || boolMatchPunct(fullBe);
                if (isWordStart) {
                    if (beChar.length > 0) beChar = beChar[0].toUpperCase() + beChar.slice(1);
                    if (ruChar.length > 0) ruChar = ruChar[0].toUpperCase() + ruChar.slice(1);
                }

                fullBe += beChar;
                fullPinyin += (fullPinyin && !fullPinyin.endsWith(' ') ? ' ' : '') + (rawPy || ch);
                fullRu += ruChar;

                pos++;
            }
        } else {
            // Text is Pinyin
            const tokens = text.split(/([^\w'’]+)/);
            for (const tok of tokens) {
                if (!tok || /^[^\w'’]+$/.test(tok)) {
                    fullBe += tok;
                    fullPinyin += tok;
                    fullRu += tok;
                    continue;
                }

                const isCap = tok[0] === tok[0].toUpperCase() && tok[0].toLowerCase() !== tok[0].toUpperCase();
                const cleanTok = cleanPinyin(tok).toLowerCase().replace(/[^a-z]/g, '');

                // Check compound match by pinyin (e.g. zhuangzi, beijing, kongzi, etc.)
                const compMatch = compoundByPinyin[cleanTok];
                if (compMatch) {
                    let beWord = compMatch.be;
                    let ruWord = compMatch.ru || '';
                    if (!isCap) {
                        beWord = beWord.toLowerCase();
                        ruWord = ruWord.toLowerCase();
                    }
                    fullBe += beWord;
                    fullPinyin += tok;
                    fullRu += ruWord;
                    continue;
                }

                const syls = segmentPinyinWord(tok);
                let beWord = syllablesToBelarusian(syls);
                let ruWord = syls.map(s => pinyin_to_ru[s] || s).join('');

                // Check philosopher suffix -zi / -zǐ
                if (syls.length === 2 && (syls[1] === 'zi' || syls[1] === 'zǐ')) {
                    const s0Be = pinyin_to_be[syls[0]] || syls[0];
                    const s0Ru = pinyin_to_ru[syls[0]] || syls[0];
                    beWord = `${s0Be}-дзы`;
                    ruWord = `${s0Ru}-цзы`;
                }

                if (isCap && beWord.length > 0) {
                    beWord = beWord[0].toUpperCase() + beWord.slice(1);
                    ruWord = ruWord[0].toUpperCase() + ruWord.slice(1);
                }

                fullBe += beWord;
                fullPinyin += tok;
                fullRu += ruWord;
            }
        }

        return {
            input: text,
            be: fullBe,
            pinyin: fullPinyin,
            ru: fullRu
        };
    }

    function boolMatchPunct(str) {
        return Boolean(str && /[\s\n\.,!?;:—\-\/]$/.test(str));
    }

    // Convert Russian Palladius to Belarusian + Reconstructed Pinyin (NO character guessing!)
    function transcribeRussian(text) {
        if (!text || !text.trim()) return null;

        const tradReplacements = {
            'пекин': { be: 'Пекін (Бэйдзін)', pinyin: 'Běijīng' },
            'бэйцзин': { be: 'Пекін (Бэйдзін)', pinyin: 'Běijīng' },
            'конфуций': { be: 'Канфуцый (Кун-дзы)', pinyin: 'Kǒngzǐ' },
            'канфуцый': { be: 'Канфуцый (Кун-дзы)', pinyin: 'Kǒngzǐ' },
            'кун-цзы': { be: 'Канфуцый (Кун-дзы)', pinyin: 'Kǒngzǐ' },
            'кунцзы': { be: 'Канфуцый (Кун-дзы)', pinyin: 'Kǒngzǐ' },
            'гонконг': { be: 'Ганконг (Сьянган)', pinyin: 'Xiānggǎng' },
            'сянган': { be: 'Ганконг (Сьянган)', pinyin: 'Xiānggǎng' },
            'макао': { be: 'Макао (Аомэнь)', pinyin: 'Àomén' },
            'макаа': { be: 'Макао (Аомэнь)', pinyin: 'Àomén' },
            'аомынь': { be: 'Макао (Аомэнь)', pinyin: 'Àomén' },
            'нанкин': { be: 'Нанкін (Наньдзін)', pinyin: 'Nánjīng' },
            'наньцзин': { be: 'Нанкін (Наньдзін)', pinyin: 'Nánjīng' },
            'янцзы': { be: 'рака Яндзы (Янцзы)', pinyin: 'Chángjiāng' },
            'кунг-фу': { be: 'Гунфу', pinyin: 'Gōngfu' },
            'чжуан-цзы': { be: 'Джуан-дзы', pinyin: 'Zhuāngzi' },
            'чжуанцзы': { be: 'Джуан-дзы', pinyin: 'Zhuāngzi' },
            'лао-цзы': { be: 'Лао-дзы', pinyin: 'Lǎozǐ' },
            'лаоцзы': { be: 'Лао-дзы', pinyin: 'Lǎozǐ' },
            'мэн-цзы': { be: 'Мэн-дзы', pinyin: 'Mèngzǐ' },
            'мэнцзы': { be: 'Мэн-дзы', pinyin: 'Mèngzǐ' },
            'сунь-цзы': { be: 'Сунь-дзы', pinyin: 'Sūnzǐ' },
            'суньцзы': { be: 'Сунь-дзы', pinyin: 'Sūnzǐ' }
        };

        const tokens = text.split(/([^\p{L}\-]+)/u);
        let fullBe = '';
        let fullPinyin = '';

        for (const tok of tokens) {
            if (!tok || !/\p{L}/u.test(tok)) {
                fullBe += tok;
                fullPinyin += tok;
                continue;
            }

            const lower = tok.toLowerCase();
            const isCap = tok[0] === tok[0].toUpperCase() && tok[0].toLowerCase() !== tok[0].toUpperCase();

            // Check traditional word
            if (tradReplacements[lower]) {
                const special = tradReplacements[lower];
                let beW = special.be;
                if (!isCap) beW = beW.toLowerCase();
                fullBe += beW;
                fullPinyin += (fullPinyin && !fullPinyin.endsWith(' ') ? ' ' : '') + special.pinyin;
                continue;
            }

            // Check compound by Russian name
            const cleanRu = lower.replace(/[^а-яёіў]/g, '');
            if (compoundByRu[cleanRu]) {
                const comp = compoundByRu[cleanRu];
                let beW = comp.be;
                if (!isCap) beW = beW.toLowerCase();
                fullBe += beW;
                fullPinyin += (fullPinyin && !fullPinyin.endsWith(' ') ? ' ' : '') + comp.pinyin;
                continue;
            }

            // Handle hyphenated subwords (e.g. Чжуан-цзы)
            const subtokens = tok.split('-');
            const beSub = [];
            const pySub = [];
            for (const sub of subtokens) {
                if (!sub) continue;
                const subCap = sub[0] === sub[0].toUpperCase() && sub[0].toLowerCase() !== sub[0].toUpperCase();
                const ruSyls = segmentRuWord(sub);
                const pySyls = ruSyls.map(r => ru_to_pinyin[r] || r);
                let beW = syllablesToBelarusian(pySyls);

                // Philosopher ending in цзы
                if (ruSyls.length >= 2 && ruSyls[ruSyls.length - 1] === 'цзы') {
                    const stemRu = ruSyls.slice(0, -1);
                    const stemPy = stemRu.map(r => ru_to_pinyin[r] || r);
                    const stemBe = syllablesToBelarusian(stemPy);
                    beW = `${stemBe}-дзы`;
                }

                if (subCap && beW.length > 0) {
                    beW = beW[0].toUpperCase() + beW.slice(1);
                }
                beSub.push(beW);
                pySub.push(pySyls.join(' '));
            }
            fullBe += beSub.join('-');
            fullPinyin += (fullPinyin && !fullPinyin.endsWith(' ') ? ' ' : '') + pySub.join('-');
        }

        return {
            input: text,
            be: fullBe,
            pinyin: fullPinyin
        };
    }

    // Expose engine
    window.TranscriptionEngine = {
        cleanPinyin,
        transcribeChinese,
        transcribeRussian,
        pinyin_to_be,
        pinyin_to_ru,
        ru_to_pinyin,
        toponyms,
        extra_words
    };

    // UI Configuration & State
    let currentMode = 'zh'; // 'zh' or 'ru'

    const PRESETS = {
        zh: [
            { label: '北京 (Пекін / Бэйдзін)', text: '北京' },
            { label: '庄子 (Джуан-дзы)', text: '庄子' },
            { label: '长安 (Чан’ань)', text: '长安' },
            { label: '四川 (Сычуань)', text: '四川' },
            { label: '重庆 (Чунцін)', text: '重庆' },
            { label: '黄河 (Хуанхэ)', text: '黄河' },
            { label: '毛泽东 (Мао Дзэдун)', text: '毛泽东' },
            { label: '你好，世界！', text: '你好，世界！' }
        ],
        ru: [
            { label: 'Пекин (Пекін / Бэйдзін)', text: 'Пекин' },
            { label: 'Бэйцзин', text: 'Бэйцзин' },
            { label: 'Чжуан-цзы', text: 'Чжуан-цзы' },
            { label: 'Чанъань', text: 'Чанъань' },
            { label: 'Сычуань', text: 'Сычуань' },
            { label: 'Тяньцзинь', text: 'Тяньцзинь' },
            { label: 'Си Цзиньпин', text: 'Си Цзиньпин' },
            { label: 'Тяньаньмэнь', text: 'Тяньаньмэнь' }
        ]
    };

    document.addEventListener('DOMContentLoaded', () => {
        setupModeSwitcher();
        setupInputHandler();
        setupCopyButtons();
        setupTable();
        renderPresets();
    });

    // Setup Mode Switcher (Seamless transition in the same card)
    function setupModeSwitcher() {
        const btnZh = document.getElementById('btn-mode-zh');
        const btnRu = document.getElementById('btn-mode-ru');
        const card = document.getElementById('converter-card');
        const title = document.getElementById('card-title');
        const desc = document.getElementById('card-desc');
        const input = document.getElementById('main-input');
        const cardPaladius = document.getElementById('card-paladius');
        const labelPinyin = document.getElementById('label-pinyin');

        function switchMode(newMode) {
            if (currentMode === newMode) return;
            currentMode = newMode;

            if (newMode === 'zh') {
                btnZh.classList.add('active');
                btnZh.setAttribute('aria-selected', 'true');
                btnRu.classList.remove('active');
                btnRu.setAttribute('aria-selected', 'false');

                card.classList.remove('mode-ru');
                card.classList.add('mode-zh');

                title.textContent = 'Транскрыпцыя з кітайскай мовы';
                desc.textContent = 'Устаўце кітайскія іерогліфы або піньінь.';
                input.placeholder = 'Устаўце кітайскі тэкст або піньінь, напрыклад: 北京, Cháng\'ān, 庄子...';

                labelPinyin.textContent = 'Піньінь (Pinyin)';
                if (cardPaladius) cardPaladius.style.display = 'block';
            } else {
                btnRu.classList.add('active');
                btnRu.setAttribute('aria-selected', 'true');
                btnZh.classList.remove('active');
                btnZh.setAttribute('aria-selected', 'false');

                card.classList.remove('mode-zh');
                card.classList.add('mode-ru');

                title.textContent = 'Транскрыпцыя з сістэмы Паладыя';
                desc.textContent = 'Устаўце словы ў рускай сістэме Паладыя.';
                input.placeholder = 'Устаўце словы ў сістэме Паладыя, напрыклад: Чжуан-цзы, Бэйцзин, Чанъань...';

                labelPinyin.textContent = 'Адноўлены піньінь (Pinyin)';
                if (cardPaladius) cardPaladius.style.display = 'none';
            }

            renderPresets();
            triggerUpdate();
        }

        if (btnZh) btnZh.addEventListener('click', () => switchMode('zh'));
        if (btnRu) btnRu.addEventListener('click', () => switchMode('ru'));
    }

    // Render presets dynamically without moving elements
    function renderPresets() {
        const container = document.getElementById('presets-buttons');
        if (!container) return;

        container.innerHTML = '';
        const list = PRESETS[currentMode] || [];

        list.forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'preset-btn';
            btn.textContent = p.label;
            btn.addEventListener('click', () => {
                const input = document.getElementById('main-input');
                if (input) {
                    input.value = p.text;
                    triggerUpdate();
                    input.focus();
                }
            });
            container.appendChild(btn);
        });
    }

    // Input & Transcription Update Handler
    function setupInputHandler() {
        const input = document.getElementById('main-input');
        if (input) {
            input.addEventListener('input', triggerUpdate);
        }
    }

    function triggerUpdate() {
        const input = document.getElementById('main-input');
        const resultSection = document.getElementById('result-section');
        const outBe = document.getElementById('out-be');
        const outPy = document.getElementById('out-py');
        const outRu = document.getElementById('out-ru');

        if (!input) return;
        const val = input.value.trim();

        if (!val) {
            if (resultSection) resultSection.style.display = 'none';
            return;
        }

        if (currentMode === 'zh') {
            const res = transcribeChinese(val);
            if (!res) return;

            if (resultSection) resultSection.style.display = 'block';
            if (outBe) outBe.textContent = res.be;
            if (outPy) outPy.textContent = res.pinyin;
            if (outRu) outRu.textContent = res.ru;
        } else {
            // Mode: 'ru' (Palladius -> Belarusian + Pinyin ONLY)
            const res = transcribeRussian(val);
            if (!res) return;

            if (resultSection) resultSection.style.display = 'block';
            if (outBe) outBe.textContent = res.be;
            if (outPy) outPy.textContent = res.pinyin;
        }
    }

    // Copy to clipboard
    function setupCopyButtons() {
        const copyBtn = document.getElementById('copy-btn-be');
        if (!copyBtn) return;

        copyBtn.addEventListener('click', () => {
            const outBe = document.getElementById('out-be');
            if (!outBe) return;

            const textToCopy = outBe.textContent.trim();
            navigator.clipboard.writeText(textToCopy).then(() => {
                const origText = copyBtn.textContent;
                copyBtn.textContent = 'Скапіявана!';
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.textContent = origText;
                    copyBtn.classList.remove('copied');
                }, 1600);
            }).catch(err => {
                console.error('Памылка капіявання:', err);
            });
        });
    }

    // Syllables Reference Table (inside <details>)
    function setupTable() {
        const tableBody = document.getElementById('table-body');
        const searchInput = document.getElementById('table-search');
        const countSpan = document.getElementById('table-count');
        const filterBtns = document.querySelectorAll('.filter-pill');

        if (!tableBody) return;

        const allSyllables = [];
        const pinyinKeys = Object.keys(pinyin_to_be).sort();

        pinyinKeys.forEach(py => {
            const be = pinyin_to_be[py];
            const ru = pinyin_to_ru[py] || '—';
            allSyllables.push({ py, be, ru });
        });

        let currentFilter = 'all';
        let searchQuery = '';

        function renderRows() {
            tableBody.innerHTML = '';
            let count = 0;

            allSyllables.forEach(s => {
                if (currentFilter !== 'all') {
                    if (currentFilter === 'vowel') {
                        if (!/^[aeiouü]/.test(s.py)) return;
                    } else if (!s.py.startsWith(currentFilter)) {
                        return;
                    }
                }

                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    const match = s.py.includes(q) || s.be.includes(q) || s.ru.includes(q);
                    if (!match) return;
                }

                count++;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${s.py}</strong></td>
                    <td class="be-highlight"><strong>${s.be}</strong></td>
                    <td class="ru-cell">${s.ru}</td>
                    <td class="chars-cell">—</td>
                `;
                tableBody.appendChild(tr);
            });

            if (countSpan) countSpan.textContent = count;
        }

        renderRows();

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim();
                renderRows();
            });
        }

        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.getAttribute('data-filter');
                renderRows();
            });
        });
    }

})();
