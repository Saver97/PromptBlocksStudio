import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from translation import Translator


class TranslationTests(unittest.TestCase):
    def test_translation_and_credentials(self):
        seen = []
        answer = {'text': '{{B}} holds {{A}}\'s left hand.'}
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass
            def do_POST(self):
                seen.append((self.path, self.headers.get('Authorization'),
                             json.loads(self.rfile.read(int(self.headers['Content-Length'])))))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'completed', 'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': answer['text']}]}]}).encode())
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                t = Translator(directory)
                t.offline.model_dir = Path(directory) / 'missing-model'
                with self.assertRaisesRegex(ValueError, '翻译设置'):
                    t.translate('中文')
                endpoint = f'http://127.0.0.1:{server.server_port}/v1'
                t.save({'endpoint': endpoint + '/chat/completions', 'model': 'test-model', 'key': 'unit-test-secret'})
                self.assertEqual(t.settings(), {'endpoint': endpoint, 'model': 'test-model', 'key_set': True, 'engine': 'api', 'local_available': False, 'hunyuan_available': False})
                with self.assertRaisesRegex(ValueError, '混元翻译组件未安装'):
                    t.translate('中文', 'local-hunyuan')
                with self.assertRaisesRegex(ValueError, '未知翻译引擎'):
                    t.translate('中文', 'unknown-engine')
                self.assertNotIn('unit-test-secret', t.path.read_text())
                source = '{{B}} 握住 {{A}} 的左手。'
                self.assertEqual(t.translate(source)['text'], answer['text'])
                self.assertEqual(seen[0][0], '/v1/responses')
                self.assertEqual(seen[0][1], 'Bearer unit-test-secret')
                self.assertEqual(seen[0][2]['input'], source)
                self.assertEqual(seen[0][2]['model'], 'test-model')
                t.save({'endpoint': endpoint, 'model': 'test-model', 'key': ''})
                self.assertTrue(t.settings()['key_set'])
                for bad in ['She holds her hand.', '{{B}} holds {{A}}. {{A}} smiles.', '{{b}} holds {{A}}.']:
                    answer['text'] = bad
                    result = t.translate(source)
                    self.assertFalse(result['valid'])
                    self.assertEqual(result['text'], bad)
                    self.assertEqual(result['raw'], bad)
                for bad in [None, '']:
                    answer['text'] = bad
                    with self.assertRaises(ValueError):
                        t.translate(source)
                t.save({'endpoint': endpoint, 'model': 'test-model', 'clear_key': True})
                self.assertFalse(t.settings()['key_set'])
                with self.assertRaises(ValueError):
                    t.save({'endpoint': 'https://example.test/v1?key=secret', 'model': 'test'})
        finally:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    unittest.main()
