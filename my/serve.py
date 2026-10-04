# 개발용 정적 서버 — 브라우저 캐시를 끄고(no-store) 이 폴더를 그대로 보여줍니다.
# 고친 내용이 새로고침 한 번에 바로 보입니다.
# 사용: python3 serve.py [포트]   (기본 5180)
import contextlib
import functools
import http.server
import os
import socket
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
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
