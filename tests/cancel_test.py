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


class CancelTests(unittest.TestCase):
    def test_cancel_waiting_headers_and_body_then_retry(self):
        arrived, release = threading.Event(), threading.Event()
        mode = {'body': False, 'block': True}
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass
            def do_POST(self):
                self.rfile.read(int(self.headers['Content-Length']))
                data = json.dumps({'output': [{'type': 'message', 'content': [
                    {'type': 'output_text', 'text': '{{A}} waves.'}]}]}).encode()
                try:
                    if mode['body']:
                        self.send_response(200)
                        self.send_header('Content-Length', str(len(data)))
                        self.end_headers()
                        self.wfile.write(data[:5])
                        self.wfile.flush()
                    arrived.set()
                    if mode['block']:
                        release.wait(5)
                    if not mode['body']:
                        self.send_response(200)
                        self.end_headers()
                        self.wfile.write(data)
                    else:
                        self.wfile.write(data[5:])
                except (BrokenPipeError, ConnectionResetError, OSError):
                    pass
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                t = Translator(directory)
                t.save({'engine': 'api', 'endpoint': f'http://127.0.0.1:{server.server_port}', 'model': 'fixture'})
                for body in (False, True):
                    arrived.clear(); release.clear(); mode['body'] = body
                    errors = []
                    def run():
                        try:
                            t.requests.run('slow', t.translate, '{{A}} 挥手。')
                        except Exception as exc:
                            errors.append(exc)
                    worker = threading.Thread(target=run)
                    worker.start()
                    self.assertTrue(arrived.wait(3))
                    start = time.monotonic()
                    t.requests.cancel('slow')
                    worker.join(2)
                    self.assertFalse(worker.is_alive(), 'cancel must interrupt blocked response I/O')
                    self.assertIsInstance(errors[0], RequestCancelled)
                    self.assertLess(time.monotonic() - start, 2)
                    release.set()
                    time.sleep(.1)
                mode.update(body=False, block=False)
                self.assertEqual(t.requests.run('next', t.translate, '{{A}} 挥手。')['text'], '{{A}} waves.')
                t.requests.cancel('early')
                with self.assertRaises(RequestCancelled):
                    t.requests.run('early', lambda: self.fail('cancelled request executed'))
                self.assertEqual(t.requests.active, {})
        finally:
            release.set()
            server.shutdown()
            server.server_close()

if __name__ == '__main__':
    unittest.main()
