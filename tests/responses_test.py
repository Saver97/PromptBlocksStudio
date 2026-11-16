import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import URLError
import ssl
import truststore

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from translation import Translator, protect


class ResponsesTests(unittest.TestCase):
    def test_certificate_verification_is_required_and_reported(self):
        context = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        self.assertTrue(context.check_hostname)
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        with tempfile.TemporaryDirectory() as directory:
            t = Translator(directory)
            t.save({'engine': 'api', 'endpoint': 'https://example.invalid', 'model': 'test'})
            with patch('translation.request.build_opener') as opener:
                opener.return_value.open.side_effect = URLError(ssl.SSLCertVerificationError(1, 'expired'))
                with self.assertRaisesRegex(ValueError, '证书验证失败'):
                    t.list_models({'endpoint': 'https://example.invalid'})
                with self.assertRaisesRegex(ValueError, '证书验证失败'):
                    t.translate('普通场景')

    def test_model_list_with_unsaved_settings(self):
        seen = []
        reply = {'data': [{'id': 'model-b'}, {'id': 'model-a'}, {'id': 'model-a'}, {'name': 'invalid'}]}

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def do_GET(self):
                seen.append((self.path, self.headers.get('Authorization')))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps(reply).encode())

        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                t = Translator(directory)
                t.path.write_text(json.dumps({'key_encrypted': protect('saved-test-key')}), encoding='utf-8')
                original = t.path.read_bytes()
                root = f'http://127.0.0.1:{server.server_port}'
                for suffix, expected in [('', '/models'), ('/responses', '/models'), ('/v1/responses/', '/v1/models')]:
                    self.assertEqual(t.list_models({'endpoint': root + suffix})['models'], ['model-a', 'model-b'])
                    self.assertEqual(seen[-1], (expected, 'Bearer saved-test-key'))
                t.list_models({'endpoint': root, 'key': 'draft-test-key'})
                self.assertEqual(seen[-1][1], 'Bearer draft-test-key')
                t.list_models({'endpoint': root, 'clear_key': True})
                self.assertIsNone(seen[-1][1])
                self.assertEqual(t.path.read_bytes(), original)
                reply['data'] = []
                self.assertEqual(t.list_models({'endpoint': root}), {'models': []})
                reply['data'] = 'bad'
                with self.assertRaises(ValueError):
                    t.list_models({'endpoint': root})
                for bad in ['', 'file:///temp', 'https://example.test?key=secret']:
                    with self.assertRaises(ValueError):
                        t.list_models({'endpoint': bad})
        finally:
            server.shutdown()
            server.server_close()

    def test_paths_payload_output_and_errors(self):
        seen = []
        good = {'status': 'completed', 'output': [
            {'type': 'reasoning', 'summary': [{'type': 'summary_text', 'text': 'not final'}]},
            {'type': 'message', 'status': 'completed', 'role': 'assistant', 'content': [
                {'type': 'output_text', 'text': '{{A}} stands '},
                {'type': 'output_text', 'text': 'on the left.'}]}]}
        response = {'value': good, 'status': 200}

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def do_POST(self):
                seen.append((self.path, json.loads(self.rfile.read(int(self.headers['Content-Length'])))))
                self.send_response(response['status'])
                self.end_headers()
                self.wfile.write(json.dumps(response['value']).encode())

        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                t = Translator(directory)
                root = f'http://127.0.0.1:{server.server_port}'
                for suffix, expected in [('', '/responses'), ('/', '/responses'),
                                         ('/responses', '/responses'), ('/responses/', '/responses'),
                                         ('/v1', '/v1/responses'), ('/v1/responses', '/v1/responses'),
                                         ('/custom/api', '/custom/api/responses'),
                                         ('/v1/chat/completions', '/v1/responses')]:
                    t.save({'engine': 'api', 'endpoint': root + suffix, 'model': 'test'})
                    self.assertEqual(t.translate('{{A}} 站左边。')['text'], '{{A}} stands on the left.')
                    self.assertEqual(seen[-1][0], expected)
                    body = seen[-1][1]
                    self.assertEqual(body['input'], '{{A}} 站左边。')
                    self.assertTrue(body['instructions'])
                    self.assertNotIn('messages', body)
                    self.assertFalse(body['stream'])
                    self.assertFalse(body['store'])
                    self.assertEqual(body['reasoning'], {'effort': 'low'})
                for bad in [
                    {'status': 'incomplete', 'output': good['output']},
                    {'status': 'failed', 'error': {'message': 'sensitive detail'}},
                    {'output': [{'type': 'message', 'content': [{'type': 'refusal', 'refusal': 'no'}]}]},
                    {'output': []}, {'output': None}, {'output': ['invalid']},
                    {'choices': [{'message': {'content': 'old protocol'}}]},
                    {'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': 123}]}]},
                ]:
                    response['value'] = bad
                    with self.assertRaises(ValueError):
                        t.translate('{{A}} 站左边。')
                response['status'] = 401
                with self.assertRaisesRegex(ValueError, 'HTTP 401'):
                    t.translate('{{A}} 站左边。')
        finally:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    unittest.main()
