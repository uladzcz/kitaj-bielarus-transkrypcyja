#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Кітайска-беларускі транскрыптар (CLI)
Нарматыўная сістэма практычнай транскрыпцыі НАН Беларусі (2026)
"""

import sys
import os
import json
import re
import argparse

sys.stdout.reconfigure(encoding='utf-8')

# Load data bundle
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(SCRIPT_DIR, "pinyin_data.json")

if not os.path.exists(DATA_FILE):
    print(f"Памылка: файл звестак {DATA_FILE} не знойдзены.", file=sys.stderr)
    sys.exit(1)

with open(DATA_FILE, "r", encoding="utf-8") as f:
    DATA = json.load(f)

pinyin_to_be = DATA["pinyin_to_be"]
pinyin_to_ru = DATA["pinyin_to_ru"]
ru_to_pinyin = DATA["ru_to_pinyin"]
toponyms = DATA["toponyms"]
extra_words = DATA["extra_words"]
char_to_pinyin = DATA["char_to_pinyin"]
pinyin_to_chars = DATA["pinyin_to_chars"]

BE_VOWELS = set('аеёіоуыэюяАЕЁІОУЫЭЮЯ')

import unicodedata

PINYIN_TONE_MAP = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
    'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e', 'ê': 'e', 'ế': 'e', 'ề': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
    'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
    'ǖ': 'ü', 'ǘ': 'ü', 'ǚ': 'ü', 'ǜ': 'ü', 'ü': 'ü', 'v': 'ü',
    'Ā': 'a', 'Á': 'a', 'Ǎ': 'a', 'À': 'a',
    'Ē': 'e', 'É': 'e', 'Ě': 'e', 'È': 'e',
    'Ī': 'i', 'Í': 'i', 'Ǐ': 'i', 'Ì': 'i',
    'Ō': 'o', 'Ó': 'o', 'Ǒ': 'o', 'Ò': 'o',
    'Ū': 'u', 'Ú': 'u', 'Ǔ': 'u', 'Ù': 'u',
    'Ǖ': 'ü', 'Ǘ': 'ü', 'Ǚ': 'ü', 'Ǜ': 'ü', 'Ü': 'ü', 'V': 'ü'
}

def clean_pinyin(py):
    if not py:
        return ""
    res = ''.join(PINYIN_TONE_MAP.get(c, c.lower()) for c in py)
    decomposed = unicodedata.normalize('NFD', res)
    stripped = re.sub(r'[\u0300\u0301\u0304\u030c]', '', decomposed)
    cleaned = unicodedata.normalize('NFC', stripped)
    cleaned = re.sub(r'[1-5]', '', cleaned)
    return cleaned

sorted_pinyin = sorted(pinyin_to_be.keys(), key=lambda s: len(s), reverse=True)
sorted_ru = sorted(ru_to_pinyin.keys(), key=lambda s: len(s), reverse=True)

# Build compound dictionary and fast lookups
compounds = []
compound_by_pinyin = {}
compound_by_ru = {}

def register_compound(c):
    compounds.append(c)
    if 'pinyin' in c and c['pinyin']:
        clean_py = re.sub(r'[^a-zü0-9]', '', clean_pinyin(c['pinyin']))
        if clean_py and clean_py not in compound_by_pinyin:
            compound_by_pinyin[clean_py] = c
    if 'ru' in c and c['ru']:
        clean_ru = re.sub(r'[^а-яёіў]', '', c['ru'].lower())
        if clean_ru and clean_ru not in compound_by_ru:
            compound_by_ru[clean_ru] = c

for w in extra_words:
    register_compound(w)
for t in toponyms:
    register_compound({
        'hanzi': t['hanzi'],
        'pinyin': t['pinyin'],
        'be': t.get('be_clean', t['be']),
        'ru': t['ru'],
        'desc': 'Тапонім'
    })

compounds.sort(key=lambda c: len(c.get('hanzi', '')), reverse=True)

def syllables_to_belarusian(syls):
    be_parts = []
    for i, syl in enumerate(syls):
        be = pinyin_to_be.get(syl, syl)
        if i > 0:
            prev = be_parts[-1]
            if prev.endswith('н') and len(be) > 0 and be[0] in BE_VOWELS:
                be_parts.append('’')
        be_parts.append(be)
    return ''.join(be_parts)

def segment_pinyin_word(word):
    parts = re.split(r"['’]", word)
    all_syls = []
    for part in parts:
        clean = clean_pinyin(part)
        if not clean:
            continue
        n = len(clean)
        dp = {0: []}
        for i in range(n):
            if i not in dp:
                continue
            for syl in sorted_pinyin:
                if clean.startswith(syl, i):
                    nxt = i + len(syl)
                    if nxt not in dp or len(dp[i]) + 1 < len(dp[nxt]):
                        dp[nxt] = dp[i] + [syl]
        if n in dp:
            all_syls.extend(dp[n])
        else:
            pos = 0
            while pos < n:
                matched = False
                for syl in sorted_pinyin:
                    if clean.startswith(syl, pos):
                        all_syls.append(syl)
                        pos += len(syl)
                        matched = True
                        break
                if not matched:
                    all_syls.append(clean[pos])
                    pos += 1
    return all_syls

def segment_ru_word(word):
    subparts = re.split(r"[ъ’']", word.lower())
    res_syls = []
    for part in subparts:
        if not part:
            continue
        n = len(part)
        dp = {0: []}
        for i in range(n):
            if i not in dp:
                continue
            for syl in sorted_ru:
                if part.startswith(syl, i):
                    nxt = i + len(syl)
                    if nxt not in dp or len(dp[i]) + 1 < len(dp[nxt]):
                        dp[nxt] = dp[i] + [syl]
        if n in dp:
            res_syls.extend(dp[n])
        else:
            pos = 0
            while pos < n:
                matched = False
                for syl in sorted_ru:
                    if part.startswith(syl, pos):
                        res_syls.append(syl)
                        pos += len(syl)
                        matched = True
                        break
                if not matched:
                    res_syls.append(part[pos])
                    pos += 1
    return res_syls

def is_hanzi(ch):
    code = ord(ch)
    return (0x4E00 <= code <= 0x9FFF) or (0x3400 <= code <= 0x4DBF) or (code == 12295)

def transcribe_chinese(text):
    has_hanzi = any(is_hanzi(c) for c in text)
    if has_hanzi:
        pos = 0
        full_be = []
        full_py = []
        full_ru = []
        while pos < len(text):
            ch = text[pos]
            if not is_hanzi(ch):
                full_be.append(ch)
                full_py.append(ch)
                full_ru.append(ch)
                pos += 1
                continue
            
            # Check compounds
            matched = None
            for comp in compounds:
                if text.startswith(comp['hanzi'], pos):
                    matched = comp
                    break
            if matched:
                be_w = matched['be']
                ru_w = matched.get('ru', '')
                if full_be and not re.search(r'[\s\n\.,!?;:—\-\/]$', full_be[-1]) and not be_w.startswith(' '):
                    full_be.append(' ')
                    full_ru.append(' ')
                full_be.append(be_w)
                full_py.append(matched['pinyin'])
                full_ru.append(ru_w)
                pos += len(matched['hanzi'])
                continue
            
            # Single character
            raw_py = char_to_pinyin.get(ch, '')
            clean_py = clean_pinyin(raw_py)
            be_c = pinyin_to_be.get(clean_py, ch)
            ru_c = pinyin_to_ru.get(clean_py, ch)
            is_word_start = (pos == 0) or bool(full_be and re.search(r'[\s\n\.,!?;:—\-\/]$', full_be[-1]))
            if is_word_start:
                if be_c: be_c = be_c[0].upper() + be_c[1:]
                if ru_c: ru_c = ru_c[0].upper() + ru_c[1:]
            full_be.append(be_c)
            full_py.append(raw_py or clean_py or ch)
            full_ru.append(ru_c)
            pos += 1
        return {
            'input': text,
            'be': ''.join(full_be),
            'pinyin': ' '.join(full_py),
            'ru': ''.join(full_ru)
        }
    else:
        # Pinyin
        tokens = re.split(r"([^\w'’\-]+)", text)
        full_be = []
        full_ru = []
        for tok in tokens:
            if not tok or re.match(r"^[^\w'’\-]+$", tok):
                full_be.append(tok)
                full_ru.append(tok)
                continue

            # Hyphenated pinyin (e.g. Zhuang-zi, Xi-Jinping)
            if '-' in tok:
                subtoks = tok.split('-')
                be_subs = []
                ru_subs = []
                for sub in subtoks:
                    if not sub:
                        continue
                    sub_cap = sub[0].isupper()
                    sub_syls = segment_pinyin_word(sub)
                    sub_be = syllables_to_belarusian(sub_syls)
                    sub_ru = ''.join([pinyin_to_ru.get(s, s) for s in sub_syls])
                    if sub_cap and sub_be:
                        sub_be = sub_be[0].upper() + sub_be[1:]
                        sub_ru = sub_ru[0].upper() + sub_ru[1:]
                    be_subs.append(sub_be)
                    ru_subs.append(sub_ru)
                full_be.append('-'.join(be_subs))
                full_ru.append('-'.join(ru_subs))
                continue

            is_cap = tok[0].isupper()
            clean_tok = re.sub(r'[^a-zü0-9]', '', clean_pinyin(tok).lower())
            
            if clean_tok in compound_by_pinyin:
                comp = compound_by_pinyin[clean_tok]
                bw = comp['be']
                rw = comp.get('ru', '')
                if not is_cap:
                    bw = bw.lower()
                    rw = rw.lower()
                full_be.append(bw)
                full_ru.append(rw)
                continue

            syls = segment_pinyin_word(tok)
            be_w = syllables_to_belarusian(syls)
            ru_w = ''.join([pinyin_to_ru.get(s, s) for s in syls])

            # Philosopher rule: ending with -zi
            if len(syls) == 2 and syls[1] in ('zi', 'zǐ'):
                s0_be = pinyin_to_be.get(syls[0], syls[0])
                s0_ru = pinyin_to_ru.get(syls[0], syls[0])
                be_w = f"{s0_be}-дзы"
                ru_w = f"{s0_ru}-цзы"

            if is_cap and be_w:
                be_w = be_w[0].upper() + be_w[1:]
                ru_w = ru_w[0].upper() + ru_w[1:]
            full_be.append(be_w)
            full_ru.append(ru_w)
        return {
            'input': text,
            'be': ''.join(full_be),
            'pinyin': text,
            'ru': ''.join(full_ru)
        }

def transcribe_russian(text):
    trad_replacements = {
        'пекин': {'be': 'Пекін (Бэйдзін)', 'pinyin': 'Běijīng'},
        'бэйцзин': {'be': 'Пекін (Бэйдзін)', 'pinyin': 'Běijīng'},
        'конфуций': {'be': 'Канфуцый (Кун-дзы)', 'pinyin': 'Kǒngzǐ'},
        'канфуцый': {'be': 'Канфуцый (Кун-дзы)', 'pinyin': 'Kǒngzǐ'},
        'кун-цзы': {'be': 'Канфуцый (Кун-дзы)', 'pinyin': 'Kǒngzǐ'},
        'кунцзы': {'be': 'Канфуцый (Кун-дзы)', 'pinyin': 'Kǒngzǐ'},
        'гонконг': {'be': 'Ганконг (Сьянган)', 'pinyin': 'Xiānggǎng'},
        'сянган': {'be': 'Ганконг (Сьянган)', 'pinyin': 'Xiānggǎng'},
        'макао': {'be': 'Макао (Аомэнь)', 'pinyin': 'Àomén'},
        'макаа': {'be': 'Макао (Аомэнь)', 'pinyin': 'Àomén'},
        'аомынь': {'be': 'Макао (Аомэнь)', 'pinyin': 'Àomén'},
        'нанкин': {'be': 'Нанкін (Наньдзін)', 'pinyin': 'Nánjīng'},
        'наньцзин': {'be': 'Нанкін (Наньдзін)', 'pinyin': 'Nánjīng'},
        'янцзы': {'be': 'рака Яндзы (Янцзы)', 'pinyin': 'Chángjiāng'},
        'кунг-фу': {'be': 'Гунфу', 'pinyin': 'Gōngfu'},
        'чжуан-цзы': {'be': 'Джуан-дзы', 'pinyin': 'Zhuāngzi'},
        'чжуанцзы': {'be': 'Джуан-дзы', 'pinyin': 'Zhuāngzi'},
        'лао-цзы': {'be': 'Лао-дзы', 'pinyin': 'Lǎozǐ'},
        'лаоцзы': {'be': 'Лао-дзы', 'pinyin': 'Lǎozǐ'},
        'мэн-цзы': {'be': 'Мэн-дзы', 'pinyin': 'Mèngzǐ'},
        'мэнцзы': {'be': 'Мэн-дзы', 'pinyin': 'Mèngzǐ'},
        'сунь-цзы': {'be': 'Сунь-дзы', 'pinyin': 'Sūnzǐ'},
        'суньцзы': {'be': 'Сунь-дзы', 'pinyin': 'Sūnzǐ'}
    }

    tokens = re.split(r'([^\w\-]+)', text)
    full_be = []
    full_py = []
    for tok in tokens:
        if not tok or re.match(r'^[^\w\-]+$', tok):
            full_be.append(tok)
            full_py.append(tok)
            continue

        lower = tok.lower()
        is_cap = tok[0].isupper()

        if lower in trad_replacements:
            sp = trad_replacements[lower]
            bw = sp['be']
            if not is_cap:
                bw = bw.lower()
            full_be.append(bw)
            full_py.append(sp['pinyin'])
            continue

        clean_ru = re.sub(r'[^а-яёіў]', '', lower)
        if clean_ru in compound_by_ru:
            comp = compound_by_ru[clean_ru]
            bw = comp['be']
            if not is_cap:
                bw = bw.lower()
            full_be.append(bw)
            full_py.append(comp['pinyin'])
            continue

        subtokens = tok.split('-')
        be_sub = []
        py_sub = []
        for sub in subtokens:
            if not sub:
                continue
            sub_cap = sub[0].isupper()
            ru_syls = segment_ru_word(sub)
            py_syls = [ru_to_pinyin.get(s, s) for s in ru_syls]
            be_w = syllables_to_belarusian(py_syls)
            if len(ru_syls) >= 2 and ru_syls[-1] == 'цзы':
                stem_ru = ru_syls[:-1]
                stem_py = [ru_to_pinyin.get(s, s) for s in stem_ru]
                stem_be = syllables_to_belarusian(stem_py)
                be_w = f"{stem_be}-дзы"
            if sub_cap and be_w:
                be_w = be_w[0].upper() + be_w[1:]
            be_sub.append(be_w)
            py_sub.append(' '.join(py_syls))
        full_be.append('-'.join(be_sub))
        full_py.append('-'.join(py_sub))

    return {
        'input': text,
        'be': ''.join(full_be),
        'pinyin': ' '.join(full_py)
    }

def main():
    parser = argparse.ArgumentParser(
        description="Кітайска-беларускі транскрыптар (Норма НАН Беларусі 2026)"
    )
    parser.add_argument("text", nargs="?", help="Тэкст для транскрыпцыі")
    parser.add_argument("--ru", action="store_true", help="Рэжым: уваходны тэкст у сістэме Паладыя")
    parser.add_argument("--json", action="store_true", help="Вывад у фармаце JSON")

    args = parser.parse_args()

    if not args.text:
        parser.print_help()
        sys.exit(0)

    if args.ru:
        res = transcribe_russian(args.text)
    else:
        res = transcribe_chinese(args.text)

    if args.json:
        print(json.dumps(res, ensure_ascii=False, indent=2))
    else:
        print(f"Уваход:       {res['input']}")
        print(f"Беларуская:   {res['be']}")
        print(f"Піньінь:      {res['pinyin']}")
        if 'ru' in res:
            print(f"Паладыя (RU): {res['ru']}")

if __name__ == "__main__":
    main()
