import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from translation import Translator, role_changes


class PolishTests(unittest.TestCase):
    def test_role_highlights(self):
        source = '🌸 {{A}} 向 B 挥手。'
        output = '🌸 {{A}} 向 {{B}} 挥手。'
        ranges = role_changes(source, output)
        self.assertEqual([output[r['start']:r['end']] for r in ranges], ['{{B}}'])
        self.assertEqual(role_changes(output, output), [])

    def test_polish_contract_and_failures(self):
        seen = []
        answer = {'content': json.dumps({'text': '{{B}} 看着 {{A}}。{{B}} 微笑。', 'notes': ['原文没有明确左右位置。']})}

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def do_POST(self):
                seen.append(json.loads(self.rfile.read(int(self.headers['Content-Length']))))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'completed', 'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': answer['content']}]}]}).encode())

        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                t = Translator(directory)
                with self.assertRaisesRegex(ValueError, '润色需要'):
                    t.polish('你好')
                t.save({'engine': 'api', 'endpoint': f'http://127.0.0.1:{server.server_port}/v1', 'model': 'test'})
                # Translation can remain offline; polishing uses the configured LLM.
                data = json.loads(t.path.read_text())
                data['engine'] = 'local-opus'
                t.path.write_text(json.dumps(data), encoding='utf-8')
                source = '{{B}} 看着 {{A}}，微笑。'
                characters = [{'alias': 'A', 'name': 'Alice', 'private': 'never-send'},
                              {'alias': 'B', 'name': 'Beth'}, {'alias': 'C', 'name': 'unreferenced'}]
                result = t.polish(source, 'positive', characters)
                self.assertEqual(result['text'], '{{B}} 看着 {{A}}。{{B}} 微笑。')
                payload = json.loads(seen[-1]['input'])
                self.assertEqual(payload['source'], source)
                self.assertEqual([c['alias'] for c in payload['characters']], ['A', 'B', 'C'])
                self.assertNotIn('private', payload['characters'][0])
                self.assertEqual(json.loads(t.path.read_text())['engine'], 'local-opus')
                t.polish(source, 'negative', characters)
                self.assertEqual(json.loads(seen[-1]['input'])['side'], 'negative')
                answer['content'] = json.dumps({'text': '{{A}} 向 {{B}} 挥手。', 'notes': []})
                result = t.polish('a 向 Beth 挥手。', 'positive', characters)
                self.assertEqual(len(result['roleChanges']), 2)
                self.assertEqual(result['text'], '{{A}} 向 {{B}} 挥手。')
                self.assertIn('不能确定', seen[-1]['instructions'])
                self.assertIn('自动规范角色引用', seen[-1]['instructions'])
                answer['content'] = json.dumps({'text': '{{A}} 向 {{Z}} 挥手。', 'notes': []})
                self.assertFalse(t.polish('A 向陌生人挥手。', 'positive', characters)['valid'])
                answer['content'] = json.dumps({'text': '{{A}} 微笑。', 'notes': []})
                self.assertFalse(t.polish('{{A}} 向 {{B}} 挥手。', 'positive', characters)['valid'])
                answer['content'] = '```json\n' + json.dumps({'text': source, 'notes': []}) + '\n```'
                self.assertEqual(t.polish(source)['text'], source)
                for value in ['nonsense', '[]', '{}', json.dumps({'text': '{{A}} 看着 {{C}}。'}),
                              json.dumps({'text': '{{b}} 看着 {{A}}。'}),
                              json.dumps({'text': '{{B}} smiles at {{A}}.'}),
                              json.dumps({'text': source, 'notes': 'wrong'})]:
                    answer['content'] = value
                    result = t.polish(source)
                    self.assertFalse(result['valid'])
                    self.assertEqual(result['raw'], value)
                answer['content'] = ''
                with self.assertRaises(ValueError):
                    t.polish(source)
                for args in [('',), ('中' * 12001,), ('中文', 'unknown'), ('中文', 'positive', 'bad')]:
                    with self.assertRaises(ValueError):
                        t.polish(*args)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    unittest.main()
