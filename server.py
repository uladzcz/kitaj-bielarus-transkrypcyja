#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Лакальны вэб-сервер для працы з Кітайска-беларускім транскрыптарам
Запуск: py server.py
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Add CORS and UTF-8 encoding
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

def main():
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/index.html"
        print("=======================================================")
        print("  Кітайска-беларускі транскрыптар (НАН Беларусі 2026)  ")
        print("=======================================================")
        print(f"Сервер запушчаны па адрасе: {url}")
        print("Адкрыццё браўзера...")
        print("Для спынення націсніце Ctrl+C\n")
        
        try:
            webbrowser.open(url)
        except Exception:
            pass

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nСервер спынены.")

if __name__ == "__main__":
    main()
