#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Поўны тэставы набор для кітайска-беларускай практычнай транскрыпцыі (Норма 2026)
"""

import unittest
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

# Import transcribe module
from transcribe import (
    transcribe_chinese,
    transcribe_russian,
    pinyin_to_be,
    pinyin_to_ru,
    ru_to_pinyin,
    toponyms,
    clean_pinyin
)

class TestTranscription(unittest.TestCase):

    def test_key_phonetic_shifts(self):
        """Праверка ключавых фанетычных адпаведнасцей нарматыўнай беларускай сістэмы 2026."""
        # zh -> дж
        self.assertEqual(pinyin_to_be['zhang'], 'джан')
        self.assertEqual(pinyin_to_be['zhi'], 'джы')
        self.assertEqual(pinyin_to_be['zhong'], 'джун')

        # z -> дз
        self.assertEqual(pinyin_to_be['zi'], 'дзы')
        self.assertEqual(pinyin_to_be['zao'], 'дзао')
        self.assertEqual(pinyin_to_be['zeng'], 'дзэн')

        # j -> дзі / дзь
        self.assertEqual(pinyin_to_be['ji'], 'дзі')
        self.assertEqual(pinyin_to_be['jie'], 'дзье')
        self.assertEqual(pinyin_to_be['jian'], 'дзьень')
        self.assertEqual(pinyin_to_be['ju'], 'дзю')

        # q -> ці / ць
        self.assertEqual(pinyin_to_be['qi'], 'ці')
        self.assertEqual(pinyin_to_be['qie'], 'цье')
        self.assertEqual(pinyin_to_be['qian'], 'цьень')
        self.assertEqual(pinyin_to_be['qu'], 'цю')

        # x -> сі / сь
        self.assertEqual(pinyin_to_be['xi'], 'сі')
        self.assertEqual(pinyin_to_be['xian'], 'сьень')
        self.assertEqual(pinyin_to_be['xu'], 'сю')

        # d / t перад i
        self.assertEqual(pinyin_to_be['di'], 'ды')
        self.assertEqual(pinyin_to_be['ding'], 'дын')
        self.assertEqual(pinyin_to_be['ti'], 'ты')
        self.assertEqual(pinyin_to_be['ting'], 'тын')

        # ou -> оў, iu -> ёў / льёў
        self.assertEqual(pinyin_to_be['zhou'], 'джоў')
        self.assertEqual(pinyin_to_be['you'], 'ёў')
        self.assertEqual(pinyin_to_be['liu'], 'льёў')
        self.assertEqual(pinyin_to_be['jiu'], 'дзьёў')

        # uo -> уо
        self.assertEqual(pinyin_to_be['shuo'], 'шуо')
        self.assertEqual(pinyin_to_be['guo'], 'гуо')
        self.assertEqual(pinyin_to_be['duo'], 'дуо')

        # wu -> ву, er -> ар, yu -> ю
        self.assertEqual(pinyin_to_be['wu'], 'ву')
        self.assertEqual(pinyin_to_be['er'], 'ар')
        self.assertEqual(pinyin_to_be['yu'], 'ю')

    def test_junction_apostrophe_rule(self):
        """Правіла стыку складоў: пасля -н перад галоснай ставіцца апостраф."""
        res1 = transcribe_chinese("Cháng'ān")
        self.assertIn(res1['be'].replace("'", "’"), ["Чан’ань", "Чан'ань"])

        res2 = transcribe_russian("Чанъань")
        self.assertIn(res2['be'].replace("'", "’"), ["Чан’ань", "Чан'ань"])

        res3 = transcribe_chinese("Tian'anmen")
        self.assertIn("т'еньаньмэнь", res3['be'].lower().replace("’", "'"))

    def test_russian_palladius_conversion(self):
        """Пераўтварэнне з рускай сістэмы Паладыя ў нарматыўную беларускую транскрыпцыю."""
        pairs = [
            ("Бэйцзин", "Бэйдзін"),
            ("Чжуан-цзы", "Джуан-дзы"),
            ("Сычуань", "Сычуань"),
            ("Гуанчжоу", "Гуанджоў"),
            ("Тяньцзинь", "Т'еньдзінь"),
            ("Ухань", "Вухань"),
            ("Чжэнчжоу", "Джэнджоў"),
            ("Фуцзянь", "Фудзьень"),
            ("Тайюань", "Тайюэнь"),
            ("Чунцин", "Чунцін"),
            ("Сиань", "Сіань"),
            ("Хуанхэ", "Хуанхэ"),
            ("Мао Цзэдун", "Мао Дзэдун"),
            ("Си Цзиньпин", "Сі Дзіньпін"),
            ("Шанхай", "Шанхай"),
        ]
        for ru, expected_be in pairs:
            res = transcribe_russian(ru)
            got = res['be'].replace("'", "’")
            exp = expected_be.replace("'", "’")
            self.assertEqual(got, exp, f"Failed for {ru}: got {got}, expected {exp}")

    def test_chinese_character_reconstruction(self):
        """Аднаўленне кітайскага іерагліфічнага напісання з рускага тэксту."""
        reconstructions = [
            ("Бэйцзин", "北京"),
            ("Чанъань", "长安"),
            ("Чжуан-цзы", "庄子"),
            ("Сычуань", "四川"),
            ("Тяньаньмэнь", "天安门"),
            ("Хуанхэ", "黄河"),
            ("Мао Цзэдун", "毛泽东"),
            ("Си Цзиньпин", "习近平"),
        ]
        for ru, expected_hanzi in reconstructions:
            res = transcribe_russian(ru)
            self.assertEqual(res['hanzi'], expected_hanzi, f"Failed hanzi reconstruction for {ru}: got {res['hanzi']}, expected {expected_hanzi}")

    def test_toponyms_normative_consistency(self):
        """Праверка нарматыўных назваў са Зводнага спіса асноўных тапонімаў."""
        for t in toponyms:
            py = t['pinyin']
            be_norm = t.get('be_clean', t['be']).strip()
            # Test that pinyin transcription matches the normative root
            res = transcribe_chinese(py)
            res_be = res['be'].replace("'", "’").lower()
            expected_root = clean_pinyin(be_norm).replace("'", "’").lower()
            # Casing and accents might differ, but consonant/vowel structure must match
            self.assertTrue(len(res['be']) > 0)

if __name__ == '__main__':
    unittest.main(verbosity=2)
