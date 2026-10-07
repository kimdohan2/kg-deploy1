# 개발용 정적 서버 — 브라우저 캐시를 끄고(no-store) 이 폴더를 그대로 보여줍니다.
# 고친 내용이 새로고침 한 번에 바로 보입니다.
# 안전장치: 내 컴퓨터(localhost)에서만 접속되고, .env 같은 숨김 파일과 scripts/ tmp/ 는 내주지 않습니다.
# 사용: python3 serve.py [포트]   (기본 5180)
import contextlib
import functools
import http.server
import os
import socket
import sys
from urllib.parse import unquote, urlsplit

LOCAL_CLIENTS = {'127.0.0.1', '::1', '::ffff:127.0.0.1'}
PRIVATE_DIRS = {'scripts', 'tmp'}


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def _allowed(self):
        if self.client_address[0] not in LOCAL_CLIENTS:
            return False
        parts = [p for p in unquote(urlsplit(self.path).path).split('/') if p]
        if any(p.startswith('.') for p in parts):  # .env, .gitignore, .claude ...
            return False
        return not (parts and parts[0] in PRIVATE_DIRS)

    def do_GET(self):
        if not self._allowed():
            return self.send_error(404)
        super().do_GET()

    def do_HEAD(self):
        if not self._allowed():
            return self.send_error(404)
        super().do_HEAD()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class DualStackServer(http.server.ThreadingHTTPServer):
    # localhost 가 ::1 / 127.0.0.1 어느 쪽으로 풀려도 접속되도록
    address_family = socket.AF_INET6

    def server_bind(self):
        with contextlib.suppress(Exception):
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
    root = os.path.dirname(os.path.abspath(__file__))
    handler = functools.partial(NoCacheHandler, directory=root)
    with DualStackServer(('::', port), handler) as server:
        print(f'http://localhost:{port} 에서 보는 중 (Ctrl+C 로 종료)', flush=True)
        server.serve_forever()
