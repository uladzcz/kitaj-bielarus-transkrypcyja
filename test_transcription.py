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
            ("Бэйцзин", "Пекін (Бэйдзін)"),
            ("Пекин", "Пекін (Бэйдзін)"),
            ("Чжуан-цзы", "Джуан-дзы"),
            ("Чжуанцзы", "Джуан-дзы"),
            ("Сычуань", "Сычуань"),
            ("Гуанчжоу", "Гуанджоў"),
            ("Тяньцзинь", "Т'еньдзінь"),
            ("Ухань", "Вухань"),
            ("Чжэнчжоу", "Джэнджоў"),
            ("Фуцзянь", "Фудзьень"),
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

    def test_chinese_exceptions_and_philosophers(self):
        """Праверка гістарычных выключэнняў (Пекін) і правапісу філосафаў праз злучок (-дзы)."""
        cases = [
            ("北京", "Пекін (Бэйдзін)"),
            ("Běijīng", "Пекін (Бэйдзін)"),
            ("南京", "Нанкін (Наньдзін)"),
            ("香港", "Ганконг (Сьянган)"),
            ("澳门", "Макао (Аомэнь)"),
            ("孔子", "Канфуцый (Кун-дзы)"),
            ("庄子", "Джуан-дзы"),
            ("Zhuāngzi", "Джуан-дзы"),
            ("老子", "Лао-дзы"),
            ("孟子", "Мэн-дзы"),
            ("孙子", "Сунь-дзы"),
            ("四川", "Сычуань"),
            ("毛泽东", "Мао Дзэдун"),
        ]
        for inp, expected_be in cases:
            res = transcribe_chinese(inp)
            got = res['be'].replace("'", "’")
            exp = expected_be.replace("'", "’")
            self.assertEqual(got, exp, f"Failed for {inp}: got {got}, expected {exp}")

    def test_toponyms_normative_consistency(self):
        """Праверка нарматыўных назваў са Зводнага спіса асноўных тапонімаў."""
        for t in toponyms:
            py = t['pinyin']
            res = transcribe_chinese(py)
            self.assertTrue(len(res['be']) > 0)

    def test_pinyin_with_diacritics_and_tones(self):
        """Праверка піньіня з надрадковымі знакамі (дыякрытыкамі) і лічбамі тонаў."""
        test_cases = [
            ("Dèng Xiǎopíng", "Дэн Сьяопін"),
            ("Xí Jìnpíng", "Сі Дзіньпін"),
            ("Máo Zédōng", "Мао Дзэдун"),
            ("Wǔhàn", "Вухань"),
            ("Zhèngzhōu", "Джэнджоў"),
            ("Cháng'ān", "Чан’ань"),
            ("Tiānjīn", "Т’еньдзінь"),
            ("Tiānshān", "Т’еньшань"),
            ("Lǐ Qiáng", "Лі Цьян"),
            ("deng4 xiao3ping2", "дэн сьяопін"),
            ("Zhuāng-zǐ", "Джуан-дзы"),
            ("lǜe", "люэ"),
            ("nǚ", "ню"),
        ]
        for py_inp, exp_be in test_cases:
            res = transcribe_chinese(py_inp)
            got = res['be'].replace("'", "’")
            exp = exp_be.replace("'", "’")
            self.assertEqual(got, exp, f"Failed for pinyin '{py_inp}': got '{got}', expected '{exp}'")

if __name__ == '__main__':
    unittest.main(verbosity=2)
