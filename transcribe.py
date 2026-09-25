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

def clean_pinyin(py):
    if not py:
        return ""
    from_chars = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü'
    to_chars   = 'aaaaeeeeiiiioooouuuuuuuuu'
    table = str.maketrans(from_chars, to_chars)
    return py.translate(table).lower()

sorted_pinyin = sorted(pinyin_to_be.keys(), key=lambda s: len(s), reverse=True)
sorted_ru = sorted(ru_to_pinyin.keys(), key=lambda s: len(s), reverse=True)

# Build compound dictionary
compounds = []
for w in extra_words:
    compounds.append(w)
for t in toponyms:
    compounds.append({
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
                clean_py = clean_pinyin(matched['pinyin'])
                syls = segment_pinyin_word(clean_py)
                be_w = syllables_to_belarusian(syls)
                ru_w = ''.join([pinyin_to_ru.get(s, s) for s in syls])
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
        tokens = re.split(r"([^\w'’]+)", text)
        full_be = []
        full_ru = []
        for tok in tokens:
            if not tok or re.match(r"^[^\w'’]+$", tok):
                full_be.append(tok)
                full_ru.append(tok)
                continue
            is_cap = tok[0].isupper()
            syls = segment_pinyin_word(tok)
            be_w = syllables_to_belarusian(syls)
            ru_w = ''.join([pinyin_to_ru.get(s, s) for s in syls])
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
    tokens = re.split(r'([^\w\-]+)', text)
    full_be = []
    full_py = []
    syls_list = []
    for tok in tokens:
        if not tok or re.match(r'^[^\w\-]+$', tok):
            full_be.append(tok)
            full_py.append(tok)
            continue
        subtokens = tok.split('-')
        be_sub = []
        py_sub = []
        for sub in subtokens:
            if not sub:
                continue
            is_cap = sub[0].isupper()
            ru_syls = segment_ru_word(sub)
            py_syls = [ru_to_pinyin.get(s, s) for s in ru_syls]
            be_w = syllables_to_belarusian(py_syls)
            if is_cap and be_w:
                be_w = be_w[0].upper() + be_w[1:]
            be_sub.append(be_w)
            py_sub.append(' '.join(py_syls))
            for py in py_syls:
                syls_list.append(py)
        full_be.append('-'.join(be_sub))
        full_py.append('-'.join(py_sub))

    # Match compound
    clean_py_seq = ''.join(syls_list)
    reconstructed_hanzi = None
    desc = None
    for comp in compounds:
        c_py = clean_pinyin(comp['pinyin']).replace(' ', '').replace("'", "").replace('-', '')
        if clean_py_seq == c_py or text.lower().replace('-', '').replace(' ', '') == comp.get('ru', '').lower().replace('-', '').replace(' ', ''):
            reconstructed_hanzi = comp['hanzi']
            desc = comp.get('desc', '')
            break

    # If no compound, combine first candidates
    if not reconstructed_hanzi:
        cand_chars = []
        for py in syls_list:
            cands = pinyin_to_chars.get(py, [])
            cand_chars.append(cands[0]['char'] if cands else '?')
        reconstructed_hanzi = ''.join(cand_chars)
        desc = "Паскладовае аднаўленне"

    return {
        'input': text,
        'be': ''.join(full_be),
        'pinyin': ' '.join(full_py),
        'hanzi': reconstructed_hanzi,
        'desc': desc
    }

def main():
    parser = argparse.ArgumentParser(description="Кітайска-беларускі транскрыптар (НАН Беларусі 2026)")
    parser.add_argument("text", nargs="?", help="Тэкст для транскрыпцыі")
    parser.add_argument("-r", "--russian", action="store_true", help="Увод у рускай транскрыпцыі (сістэма Паладыя)")
    parser.add_argument("-j", "--json", action="store_true", help="Вывад у фармаце JSON")

    args = parser.parse_args()

    if not args.text:
        # Interactive mode
        print("=== Кітайска-беларускі транскрыптар (НАН Беларусі 2026) ===")
        print("Увядзіце тэкст (кітайскія іерогліфы, піньінь або сістэму Паладыя). Для выхаду націсніце Ctrl+C.\n")
        try:
            while True:
                line = input("Увод > ").strip()
                if not line:
                    continue
                # Auto-detect Russian if it has cyrillic letters
                has_cyrillic = bool(re.search(r'[а-яёА-ЯЁ]', line))
                if has_cyrillic:
                    res = transcribe_russian(line)
                    print(f"  Беларуская: {res['be']}")
                    print(f"  Піньінь:    {res['pinyin']}")
                    print(f"  Іерогліфы:  {res['hanzi']} ({res['desc']})\n")
                else:
                    res = transcribe_chinese(line)
                    print(f"  Беларуская:      {res['be']}")
                    print(f"  Піньінь:         {res['pinyin']}")
                    print(f"  Сістэма Паладыя: {res['ru']}\n")
        except (KeyboardInterrupt, EOFError):
            print("\nБывайце!")
            return

    if args.russian:
        res = transcribe_russian(args.text)
    else:
        # Check if contains Cyrillic
        if re.search(r'[а-яёА-ЯЁ]', args.text):
            res = transcribe_russian(args.text)
        else:
            res = transcribe_chinese(args.text)

    if args.json:
        print(json.dumps(res, ensure_ascii=False, indent=2))
    else:
        print(f"Беларуская:      {res['be']}")
        print(f"Піньінь:         {res['pinyin']}")
        if 'hanzi' in res:
            print(f"Іерогліфы:       {res['hanzi']} ({res.get('desc', '')})")
        if 'ru' in res:
            print(f"Сістэма Паладыя: {res['ru']}")

if __name__ == "__main__":
    main()
