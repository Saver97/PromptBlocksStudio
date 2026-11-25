import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from translation import Translator
from request_control import RequestCancelled


class HunyuanCancelTests(unittest.TestCase):
    def test_cancel_hunyuan_interrupts_socket_and_allows_immediate_retry(self):
        arrived, release = threading.Event(), threading.Event()
        mode = {'block': True}

        class FakeLlamaHandler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def do_POST(self):
                self.rfile.read(int(self.headers.get('Content-Length', 0)))
                arrived.set()
                if mode['block']:
                    release.wait(5)
                payload = json.dumps({
                    'choices': [{'finish_reason': 'stop', 'message': {'content': 'Alice waves.'}}]
                }).encode('utf-8')
                try:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                except (BrokenPipeError, ConnectionResetError, OSError):
                    pass

        server = ThreadingHTTPServer(('127.0.0.1', 0), FakeLlamaHandler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                t = Translator(directory)
                # Point HunyuanTranslator at our fake local llama-server without spawning an exe.
                t.hunyuan.port = server.server_port
                t.hunyuan._alive = lambda: True
                t.hunyuan._start = lambda check: None

                errors = []

                def run_slow():
                    try:
                        t.requests.run('hy-slow', t.translate, '{{A}} 挥手。', 'local-hunyuan')
                    except Exception as exc:
                        errors.append(exc)

                worker = threading.Thread(target=run_slow)
                worker.start()
                self.assertTrue(arrived.wait(3), 'request never reached mock llama-server')
                start = time.monotonic()
                t.requests.cancel('hy-slow')
                worker.join(2)
                self.assertFalse(worker.is_alive(), 'cancel must interrupt blocked Hunyuan I/O')
                self.assertLess(time.monotonic() - start, 2)
                self.assertEqual(len(errors), 1)
                self.assertIsInstance(errors[0], RequestCancelled)

                # Immediately retry without releasing the old server handler: lock must be free.
                mode['block'] = False
                release.set()
                result = t.requests.run('hy-next', t.translate, '{{A}} 挥手。', 'local-hunyuan')
                self.assertEqual(result['text'], '{{A}} waves.')
                self.assertEqual(t.requests.active, {})
        finally:
            release.set()
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    unittest.main()
