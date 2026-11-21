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

    def _infer(self, source, prefix=()):
        tokens = list(prefix) + self.source.encode(source, out_type=str) + ['</s>']
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
                output.append(' '.join((self._infer(chunk) if HAN.search(chunk) else chunk) for chunk in self._chunks(line)) if HAN.search(line) else line)
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


class EnglishToChinese(OfflineTranslator):
    def __init__(self):
        super().__init__(Path(__file__).resolve().parent / 'models' / 'opus-mt-en-zh-int8')

    def translate_items(self, items, kind):
        if kind not in ('tags', 'prose') or not isinstance(items, list) or not items:
            raise ValueError('请提供英文词条或描述。')
        if not all(isinstance(item, str) and item.strip() for item in items):
            raise ValueError('英文内容不能为空。')
        if sum(map(len, items)) > 12000:
            raise ValueError('每次最多翻译 12000 个字符，请分段处理。')
        with self.lock:
            self._load()
            return [self._translate_item(item, kind) for item in items]

    def _translate_item(self, text, kind):
        key = (kind, text)
        if key in self.cache:
            self.cache.move_to_end(key)
            return self.cache[key]
        if kind == 'tags' and re.fullmatch(r'<[^>]+>|embedding:\S+', text, re.I):
            return text
        normalized = text.replace('_', ' ') if kind == 'tags' else text
        # Use numeric stand-ins since the model transliterates English names.
        markers = {}
        number = 7311
        for alias in dict.fromkeys(PLACEHOLDER.findall(normalized)):
            while str(number) in normalized:
                number += 1
            markers[alias] = str(number)
            number += 1
        prepared = PLACEHOLDER.sub(lambda m: ' ' + markers[m.group()] + ' ', normalized)
        lines = []
        for line in prepared.split('\n'):
            sentences = re.split(r'(?<=[.!?。！？])\s+', line)
            translated = []
            for sentence in sentences:
                if not re.search(r'[a-z]', sentence, re.I):
                    translated.append(sentence.strip())
                    continue
                for chunk in self._chunks(sentence):
                    translated.append(self._infer(chunk, ('>>cmn_Hans<<',)))
            lines.append(''.join(translated))
        result = '\n'.join(lines).strip()
        for alias, marker in markers.items():
            result = result.replace(marker, alias)
        if Counter(PLACEHOLDER.findall(text)) != Counter(PLACEHOLDER.findall(result)):
            raise ValueError('本地模型改写了角色代号，请将长句拆开后重试。')
        if kind == 'tags':
            result = result.rstrip('。') or result
        self.cache[key] = result
        if len(self.cache) > 128:
            self.cache.popitem(last=False)
        return result
