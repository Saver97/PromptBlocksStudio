"""CPU-only, local OPUS-MT translation. No networking or implicit downloads."""
from collections import Counter, OrderedDict
from pathlib import Path
import re
import threading
import time

PLACEHOLDER = re.compile(r'\{\{\s*[A-Za-z][A-Za-z0-9_]{0,15}\s*\}\}')
HAN = re.compile(r'[\u3400-\u9fff]')
NAMES = ('Alice', 'Betty', 'Clara', 'Diana', 'Emily', 'Fiona', 'Grace', 'Helen',
         'Irene', 'Julia', 'Karen', 'Laura', 'Maria', 'Nancy', 'Olivia', 'Paula')


class OfflineTranslator:
    def __init__(self, model_dir=None):
        self.model_dir = Path(model_dir) if model_dir else Path(__file__).resolve().parent / 'models' / 'opus-mt-zh-en-int8'
        self.lock = threading.Lock()
        self.translator = None
        self.cache = OrderedDict()

    def available(self):
        return all((self.model_dir / name).is_file() for name in
                   ('model.bin', 'config.json', 'shared_vocabulary.json', 'source.spm', 'target.spm'))

    def _load(self):
        if self.translator is not None:
            return
        if not self.available():
            raise ValueError('本地翻译模型不完整，请重新安装离线翻译组件。')
        import ctranslate2
        import sentencepiece
        self.source = sentencepiece.SentencePieceProcessor(model_file=str(self.model_dir / 'source.spm'))
        self.target = sentencepiece.SentencePieceProcessor(model_file=str(self.model_dir / 'target.spm'))
        self.translator = ctranslate2.Translator(str(self.model_dir), device='cpu', compute_type='int8',
                                                inter_threads=1, intra_threads=2)

    def _chunks(self, line):
        # Group whole sentences up to the model limit; never silently truncate a sentence.
        parts = re.split(r'(?<=[。！？!?；;])\s*', line)
        chunks, current = [], ''
        for part in parts:
            if not part:
                continue
            if len(self.source.encode(part)) > 480:
                raise ValueError('这段文字中有单句超过本地模型长度，请用句号拆成短句后重试。')
            combined = current + part
            if current and len(self.source.encode(combined)) > 480:
                chunks.append(current)
                current = part
            else:
                current = combined
        if current:
            chunks.append(current)
        return chunks

    def _infer(self, source):
        if not HAN.search(source):
            return source
        tokens = self.source.encode(source, out_type=str) + ['</s>']
        result = self.translator.translate_batch([tokens], beam_size=4, max_decoding_length=512,
                                                 repetition_penalty=1.0)[0]
        sequence = result.hypotheses[0]
        if len(sequence) >= 511:
            raise ValueError('译文可能达到长度上限，请把原文拆成更短的句子。')
        text = self.target.decode(sequence).strip()
        if not text:
            raise ValueError('本地模型返回空译文，请缩短原文后重试。')
        return text

    def translate(self, text):
        if not isinstance(text, str) or not text.strip() or len(text) > 12000:
            raise ValueError('请填写 1～12000 字的中文描述。')
        if re.search(r'<lora:|\([^\n()]+:[-\d.]+\)|[-\d.]+::', text, re.I):
            raise ValueError('权重串或 LoRA 语法请保留在标签块中；本地翻译框用于普通句子。')
        with self.lock:
            if text in self.cache:
                self.cache.move_to_end(text)
                return {**self.cache[text], 'cached': True}
            started = time.perf_counter()
            self._load()
            placeholders = list(dict.fromkeys(PLACEHOLDER.findall(text)))
            available_names = [name for name in NAMES if not re.search(r'\b' + name + r'\b', text, re.I)]
            if len(placeholders) > len(available_names):
                raise ValueError('这一段引用的角色太多，请拆分后翻译。')
            mapping = dict(zip(placeholders, available_names))
            prepared = PLACEHOLDER.sub(lambda m: mapping[m.group()], text)
            output = []
            for line in prepared.split('\n'):
                output.append(' '.join(self._infer(chunk) for chunk in self._chunks(line)) if HAN.search(line) else line)
            result = '\n'.join(output)
            # Restore aliases only after translation. Reject lost, added or ambiguous references.
            for placeholder, name in mapping.items():
                result = re.sub(r'\b' + re.escape(name) + r'\b', lambda _: placeholder, result, flags=re.I)
            if Counter(PLACEHOLDER.findall(text)) != Counter(PLACEHOLDER.findall(result)):
                return {'text': result, 'raw': result, 'engine': 'local-opus', 'valid': False,
                        'warnings': ['本地模型改写了人物引用，返回内容已展示，未自动采用。请核对或修改后采用。']}
            answer = {'text': result, 'engine': 'local-opus', 'cached': False,
                      'seconds': round(time.perf_counter() - started, 2),
                      'notice': '本地机翻完成，请核对人物、左右手和否定关系。'}
            self.cache[text] = answer
            while len(self.cache) > 128:
                self.cache.popitem(last=False)
            return answer
