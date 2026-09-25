// Беларуская практычная транскрыпцыя кітайскай мовы (НАН Беларусі 2026)
// Кліенцкі рухавік транскрыпцыі і інтэрактыўнай працы з іерогліфамі

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
        pinyin_to_chars,
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
    if (extra_words) {
        extra_words.forEach(w => compoundWords.push(w));
    }
    if (toponyms) {
        toponyms.forEach(t => {
            compoundWords.push({
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

    // Detect if character is Hanzi (CJK Unified Ideographs)
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

        // Check if text has Hanzi
        let hasHanzi = false;
        for (let i = 0; i < text.length; i++) {
            if (isHanzi(text[i])) {
                hasHanzi = true;
                break;
            }
        }

        const items = []; // interlinear breakdown items
        let fullBe = '';
        let fullPinyin = '';
        let fullRu = '';

        if (hasHanzi) {
            // First check compound dictionary matches
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
                    const pyClean = cleanPinyin(matchedCompound.pinyin);
                    const syls = segmentPinyinWord(pyClean);
                    const beWord = syllablesToBelarusian(syls);
                    const ruWord = syls.map(s => pinyin_to_ru[s] || s).join('');
                    
                    fullBe += beWord;
                    fullPinyin += (fullPinyin && !fullPinyin.endsWith(' ') ? ' ' : '') + matchedCompound.pinyin;
                    fullRu += (fullRu && !fullRu.endsWith(' ') ? ' ' : '') + ruWord;

                    items.push({
                        hanzi: matchedCompound.hanzi,
                        pinyin: matchedCompound.pinyin,
                        be: beWord,
                        ru: ruWord,
                        desc: matchedCompound.desc || ''
                    });

                    pos += matchedCompound.hanzi.length;
                    continue;
                }

                // Single character lookup
                const rawPy = char_to_pinyin[ch] || '';
                const cleanPy = cleanPinyin(rawPy);
                const beChar = pinyin_to_be[cleanPy] || cleanPy || ch;
                const ruChar = pinyin_to_ru[cleanPy] || cleanPy || ch;

                fullBe += beChar;
                fullPinyin += (fullPinyin && !fullPinyin.endsWith(' ') ? ' ' : '') + (rawPy || ch);
                fullRu += ruChar;

                items.push({
                    hanzi: ch,
                    pinyin: rawPy || cleanPy,
                    be: beChar,
                    ru: ruChar
                });
                pos++;
            }
        } else {
            // Text is likely Pinyin!
            // Tokenize by spaces and punctuation
            const tokens = text.split(/([^\w'’]+)/);
            for (const tok of tokens) {
                if (!tok || /^[^\w'’]+$/.test(tok)) {
                    fullBe += tok;
                    fullPinyin += tok;
                    fullRu += tok;
                    continue;
                }

                const isCap = tok[0] === tok[0].toUpperCase() && tok[0].toLowerCase() !== tok[0].toUpperCase();
                const syls = segmentPinyinWord(tok);
                let beWord = syllablesToBelarusian(syls);
                const ruWord = syls.map(s => pinyin_to_ru[s] || s).join('');

                if (isCap && beWord.length > 0) {
                    beWord = beWord[0].toUpperCase() + beWord.slice(1);
                }

                fullBe += beWord;
                fullPinyin += tok;
                fullRu += isCap && ruWord.length > 0 ? ruWord[0].toUpperCase() + ruWord.slice(1) : ruWord;

                syls.forEach(s => {
                    const cands = pinyin_to_chars[s] || [];
                    items.push({
                        pinyin: s,
                        be: pinyin_to_be[s] || s,
                        ru: pinyin_to_ru[s] || s,
                        candidates: cands.slice(0, 10)
                    });
                });
            }
        }

        return {
            input: text,
            be: fullBe,
            pinyin: fullPinyin,
            ru: fullRu,
            items: items
        };
    }

    // Convert Russian Palladius to Belarusian + Reconstructed Chinese
    function transcribeRussian(text) {
        if (!text || !text.trim()) return null;

        // Check traditional direct matches (like "Пекин", "Конфуций", etc.)
        let processedText = text;
        const tradReplacements = [
            { ru: 'пекин', normRu: 'бэйцзин', hanzi: '北京', pinyin: 'Běijīng', be: 'Бэйдзін' },
            { ru: 'канфуцый', normRu: 'кунцзы', hanzi: '孔子', pinyin: 'Kǒngzǐ', be: 'Кун-дзы' },
            { ru: 'гонконг', normRu: 'сянган', hanzi: '香港', pinyin: 'Xiānggǎng', be: 'Сьянган' },
            { ru: 'макао', normRu: 'аомынь', hanzi: '澳门', pinyin: 'Àomén', be: 'Аомэнь' },
            { ru: 'кунг-фу', normRu: 'гунфу', hanzi: '功夫', pinyin: 'Gōngfu', be: 'Гунфу' }
        ];

        // Tokenize by words, hyphens, and whitespace
        const tokens = text.split(/([^\p{L}]+)/u);
        const sylsDetails = [];
        let fullBe = '';
        let fullPinyin = '';
        let fullRu = '';

        for (const tok of tokens) {
            if (!tok || !/\p{L}/u.test(tok)) {
                fullBe += tok;
                fullPinyin += tok;
                fullRu += tok;
                continue;
            }

            const lower = tok.toLowerCase();
            const isCap = tok[0] === tok[0].toUpperCase() && tok[0].toLowerCase() !== tok[0].toUpperCase();

            // Check if special traditional word
            const special = tradReplacements.find(r => r.ru === lower);
            if (special) {
                fullBe += isCap ? special.be[0].toUpperCase() + special.be.slice(1) : special.be;
                fullPinyin += (fullPinyin && !fullPinyin.endsWith(' ') ? ' ' : '') + special.pinyin;
                fullRu += tok;

                sylsDetails.push({
                    ruSyl: tok,
                    pySyl: cleanPinyin(special.pinyin),
                    beSyl: special.be,
                    reconstructedHanzi: special.hanzi,
                    candidates: pinyin_to_chars[cleanPinyin(special.pinyin)] || []
                });
                continue;
            }

            // Segment Russian word into Palladius syllables
            const ruSyls = segmentRuWord(tok);
            const pySyls = ruSyls.map(r => ru_to_pinyin[r] || r);
            let beWord = syllablesToBelarusian(pySyls);

            if (isCap && beWord.length > 0) {
                beWord = beWord[0].toUpperCase() + beWord.slice(1);
            }

            fullBe += beWord;
            fullPinyin += (fullPinyin && !fullPinyin.endsWith(' ') ? ' ' : '') + pySyls.join(' ');
            fullRu += tok;

            // Reconstruct candidates for each syllable
            ruSyls.forEach((r, idx) => {
                const py = pySyls[idx];
                const cands = pinyin_to_chars[py] || [];
                sylsDetails.push({
                    ruSyl: r,
                    pySyl: py,
                    beSyl: pinyin_to_be[py] || r,
                    candidates: cands.slice(0, 12)
                });
            });
        }

        // Reconstruct whole Chinese word match
        // Search if clean pinyin sequence matches any known compound
        const cleanPySeq = sylsDetails.map(s => s.pySyl).join('');
        let bestCompound = null;
        for (const comp of compoundWords) {
            const compPyClean = cleanPinyin(comp.pinyin).replace(/[^a-z]/g, '');
            if (cleanPySeq === compPyClean || text.toLowerCase().replace(/[^а-яё]/g, '') === (comp.ru || '').toLowerCase().replace(/[^а-яё]/g, '')) {
                bestCompound = comp;
                break;
            }
        }

        return {
            input: text,
            be: fullBe,
            pinyin: fullPinyin,
            ru: fullRu,
            compound: bestCompound,
            sylsDetails: sylsDetails
        };
    }

    // Expose functions globally
    window.TranscriptionEngine = {
        cleanPinyin,
        transcribeChinese,
        transcribeRussian,
        pinyin_to_be,
        pinyin_to_ru,
        ru_to_pinyin,
        toponyms,
        extra_words,
        pinyin_to_chars
    };

    // UI Wire-up on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        setupTabs();
        setupChineseTranscriber();
        setupRussianTranscriber();
        setupTable();
        setupPresets();
        setupCopyButtons();
    });

    // Tab switcher
    function setupTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabPanes = document.querySelectorAll('.tab-pane');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-tab');
                tabBtns.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.classList.remove('active'));

                btn.classList.add('active');
                const targetPane = document.getElementById(targetId);
                if (targetPane) targetPane.classList.add('active');
            });
        });
    }

    // Chinese -> Belarusian Transcriber
    function setupChineseTranscriber() {
        const input = document.getElementById('zh-input');
        const outBe = document.getElementById('zh-out-be');
        const outPy = document.getElementById('zh-out-py');
        const outRu = document.getElementById('zh-out-ru');
        const outBreakdown = document.getElementById('zh-out-breakdown');
        const resultCard = document.getElementById('zh-result-card');

        function update() {
            const val = input.value.trim();
            if (!val) {
                if (resultCard) resultCard.style.display = 'none';
                return;
            }

            const res = transcribeChinese(val);
            if (!res) return;

            if (resultCard) resultCard.style.display = 'block';
            if (outBe) outBe.textContent = res.be;
            if (outPy) outPy.textContent = res.pinyin;
            if (outRu) outRu.textContent = res.ru;

            if (outBreakdown) {
                outBreakdown.innerHTML = '';
                res.items.forEach(item => {
                    const chip = document.createElement('div');
                    chip.className = 'syl-chip';
                    chip.innerHTML = `
                        <div class="chip-main">${item.hanzi || item.pinyin}</div>
                        <div class="chip-sub be">${item.be}</div>
                        <div class="chip-sub py">${item.pinyin || ''}</div>
                        ${item.desc ? `<div class="chip-desc">${item.desc}</div>` : ''}
                    `;
                    outBreakdown.appendChild(chip);
                });
            }
        }

        if (input) {
            input.addEventListener('input', update);
            // Initial call if not empty
            if (input.value) update();
        }
    }

    // Russian Palladius -> Belarusian + Reconstructed Chinese
    function setupRussianTranscriber() {
        const input = document.getElementById('ru-input');
        const outBe = document.getElementById('ru-out-be');
        const outPy = document.getElementById('ru-out-py');
        const outZhCompound = document.getElementById('ru-out-zh-compound');
        const outZhCompoundDesc = document.getElementById('ru-out-zh-desc');
        const outBuilder = document.getElementById('ru-out-builder');
        const customHanziDisplay = document.getElementById('custom-hanzi-display');
        const resultCard = document.getElementById('ru-result-card');

        function update() {
            const val = input.value.trim();
            if (!val) {
                if (resultCard) resultCard.style.display = 'none';
                return;
            }

            const res = transcribeRussian(val);
            if (!res) return;

            if (resultCard) resultCard.style.display = 'block';
            if (outBe) outBe.textContent = res.be;
            if (outPy) outPy.textContent = res.pinyin;

            // Compound match
            if (res.compound) {
                if (outZhCompound) {
                    outZhCompound.innerHTML = `<span class="big-hanzi">${res.compound.hanzi}</span> <span class="badge-match">Дакладнае супадзенне</span>`;
                }
                if (outZhCompoundDesc) {
                    outZhCompoundDesc.textContent = `${res.compound.desc || ''} (${res.compound.pinyin})`;
                }
            } else {
                // Compose first candidates
                const composed = res.sylsDetails.map(s => s.candidates && s.candidates.length > 0 ? s.candidates[0].char : '').join('');
                if (outZhCompound) {
                    outZhCompound.innerHTML = `<span class="big-hanzi">${composed}</span> <span class="badge-cand">Адноўлена па складах</span>`;
                }
                if (outZhCompoundDesc) {
                    outZhCompoundDesc.textContent = 'Збярыце патрэбныя іерогліфы ніжэй, калі патрабуецца іншы амафон:';
                }
            }

            // Interactive character candidates builder
            if (outBuilder) {
                outBuilder.innerHTML = '';
                const selectedChars = [];

                res.sylsDetails.forEach((sylInfo, sylIndex) => {
                    const group = document.createElement('div');
                    group.className = 'builder-column';

                    const header = document.createElement('div');
                    header.className = 'builder-col-header';
                    header.innerHTML = `<strong>${sylInfo.ruSyl}</strong> <span>${sylInfo.beSyl}</span> <small>(${sylInfo.pySyl})</small>`;
                    group.appendChild(header);

                    const candList = document.createElement('div');
                    candList.className = 'builder-cand-list';

                    const candidates = sylInfo.candidates || [];
                    if (candidates.length === 0) {
                        candList.innerHTML = '<span class="text-muted">—</span>';
                    } else {
                        // Default selection
                        selectedChars[sylIndex] = candidates[0].char;

                        candidates.forEach((cand, candIndex) => {
                            const btn = document.createElement('button');
                            btn.className = 'cand-btn' + (candIndex === 0 ? ' selected' : '');
                            btn.innerHTML = `<span class="cand-char">${cand.char}</span> <span class="cand-py">${cand.pinyin}</span>`;
                            btn.title = `Іерогліф ${cand.char} (${cand.pinyin})`;

                            btn.addEventListener('click', () => {
                                group.querySelectorAll('.cand-btn').forEach(b => b.classList.remove('selected'));
                                btn.classList.add('selected');
                                selectedChars[sylIndex] = cand.char;
                                if (customHanziDisplay) {
                                    customHanziDisplay.textContent = selectedChars.join('');
                                }
                            });

                            candList.appendChild(btn);
                        });
                    }

                    group.appendChild(candList);
                    outBuilder.appendChild(group);
                });

                if (customHanziDisplay) {
                    customHanziDisplay.textContent = selectedChars.join('');
                }
            }
        }

        if (input) {
            input.addEventListener('input', update);
            if (input.value) update();
        }
    }

    // Presets & Examples
    function setupPresets() {
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-text');
                const target = btn.getAttribute('data-target');

                if (target === 'zh') {
                    const zhInput = document.getElementById('zh-input');
                    const tabBtn = document.querySelector('[data-tab="tab-zh"]');
                    if (tabBtn) tabBtn.click();
                    if (zhInput) {
                        zhInput.value = text;
                        zhInput.dispatchEvent(new Event('input'));
                        zhInput.focus();
                    }
                } else if (target === 'ru') {
                    const ruInput = document.getElementById('ru-input');
                    const tabBtn = document.querySelector('[data-tab="tab-ru"]');
                    if (tabBtn) tabBtn.click();
                    if (ruInput) {
                        ruInput.value = text;
                        ruInput.dispatchEvent(new Event('input'));
                        ruInput.focus();
                    }
                }
            });
        });
    }

    // Copy to clipboard
    function setupCopyButtons() {
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-copy-target');
                const targetElem = document.getElementById(targetId);
                if (!targetElem) return;

                const textToCopy = targetElem.textContent.trim();
                navigator.clipboard.writeText(textToCopy).then(() => {
                    const origHtml = btn.innerHTML;
                    btn.innerHTML = '✓ Скапіявана!';
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.innerHTML = origHtml;
                        btn.classList.remove('copied');
                    }, 1800);
                }).catch(err => {
                    console.error('Памылка капіявання:', err);
                });
            });
        });
    }

    // Syllables Reference Table
    function setupTable() {
        const tableBody = document.getElementById('table-body');
        const searchInput = document.getElementById('table-search');
        const countSpan = document.getElementById('table-count');
        const filterBtns = document.querySelectorAll('.filter-pill');

        if (!tableBody) return;

        // Build list of all syllables
        const allSyllables = [];
        const pinyinKeys = Object.keys(pinyin_to_be).sort();

        pinyinKeys.forEach(py => {
            const be = pinyin_to_be[py];
            const ru = pinyin_to_ru[py] || '—';
            const chars = (pinyin_to_chars[py] || []).slice(0, 5).map(c => c.char).join(' ');
            allSyllables.push({ py, be, ru, chars });
        });

        let currentFilter = 'all';
        let searchQuery = '';

        function renderRows() {
            tableBody.innerHTML = '';
            let count = 0;

            allSyllables.forEach(s => {
                // Filter check
                if (currentFilter !== 'all') {
                    if (currentFilter === 'vowel') {
                        if (!/^[aeiouü]/.test(s.py)) return;
                    } else if (!s.py.startsWith(currentFilter)) {
                        return;
                    }
                }

                // Search query check
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    const match = s.py.includes(q) || s.be.includes(q) || s.ru.includes(q) || s.chars.includes(q);
                    if (!match) return;
                }

                count++;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${s.py}</strong></td>
                    <td class="be-highlight"><strong>${s.be}</strong></td>
                    <td class="ru-cell">${s.ru}</td>
                    <td class="chars-cell">${s.chars || '—'}</td>
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
