"""本地混元 HY-MT1.5 中译英：按需启动 llama-server（只用 CPU，不占显存），空闲后自动关闭。

目录约定（程序同级的 hunyuan 文件夹，可选组件，不打进 EXE）：
    hunyuan/llama/llama-server.exe     llama.cpp 的 Windows CPU 版
    hunyuan/HY-MT1.5-1.8B-*.gguf       混元翻译模型
"""
from collections import Counter, OrderedDict
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import threading
import time
from urllib import error, request

from offline_translation import PLACEHOLDER, HAN, NAMES

IDLE_SECONDS = 600
START_TIMEOUT = 180
# 组件不随程序和仓库提供，由用户自行下载；程序内的安装指引只打开这几个固定地址。
DOWNLOADS = {
    'model': 'https://huggingface.co/tencent/HY-MT1.5-1.8B-GGUF/resolve/main/HY-MT1.5-1.8B-Q4_K_M.gguf',
    'model_page': 'https://huggingface.co/tencent/HY-MT1.5-1.8B-GGUF',
    'llama': 'https://github.com/ggml-org/llama.cpp/releases',
}
PROMPT = '将以下文本翻译为英语，注意只需要输出翻译后的结果，不要额外解释：\n\n{text}'


class _KillOnClose:
    """Windows 作业对象：本程序意外退出时，系统会一并结束 llama-server，不留后台进程。"""
    def __init__(self):
        self.handle = None
        try:
            kernel = ctypes.WinDLL('kernel32', use_last_error=True)

            class Basic(ctypes.Structure):
                _fields_ = [('PerProcessUserTimeLimit', ctypes.c_int64), ('PerJobUserTimeLimit', ctypes.c_int64),
                            ('LimitFlags', wintypes.DWORD), ('MinimumWorkingSetSize', ctypes.c_size_t),
                            ('MaximumWorkingSetSize', ctypes.c_size_t), ('ActiveProcessLimit', wintypes.DWORD),
                            ('Affinity', ctypes.c_size_t), ('PriorityClass', wintypes.DWORD),
                            ('SchedulingClass', wintypes.DWORD)]

            class Io(ctypes.Structure):
                _fields_ = [(name, ctypes.c_uint64) for name in
                            ('Read', 'Write', 'Other', 'ReadT', 'WriteT', 'OtherT')]

            class Extended(ctypes.Structure):
                _fields_ = [('Basic', Basic), ('Io', Io), ('ProcessMemoryLimit', ctypes.c_size_t),
                            ('JobMemoryLimit', ctypes.c_size_t), ('PeakProcessMemoryUsed', ctypes.c_size_t),
                            ('PeakJobMemoryUsed', ctypes.c_size_t)]

            kernel.CreateJobObjectW.restype = wintypes.HANDLE
            kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
            kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
            kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
            handle = kernel.CreateJobObjectW(None, None)
            info = Extended()
            info.Basic.LimitFlags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            if handle and kernel.SetInformationJobObject(handle, 9, ctypes.byref(info), ctypes.sizeof(info)):
                self.handle, self.kernel = handle, kernel
        except (OSError, AttributeError):
            self.handle = None

    def add(self, process):
        if self.handle:
            self.kernel.AssignProcessToJobObject(self.handle, wintypes.HANDLE(int(process._handle)))


class HunyuanTranslator:
    def __init__(self, root):
        self.root = Path(root)
        self.lock = threading.Lock()
        self.process = None
        self.port = None
        self.last_used = 0.0
        self.cache = OrderedDict()
        self.job = None
        self.watcher = None

    # ---------- 安装检查 ----------
    def server_path(self):
        return self.root / 'llama' / 'llama-server.exe'

    def model_path(self):
        if not self.root.is_dir():
            return None
        models = sorted(self.root.glob('HY-MT*.gguf'))
        return models[0] if models else None

    def available(self):
        return self.server_path().is_file() and self.model_path() is not None

    def status(self):
        model = self.model_path()
        return {'available': self.available(), 'running': self._alive(), 'model': model.name if model else '',
                'has_model': model is not None, 'has_server': self.server_path().is_file(),
                'folder': str(self.root), 'downloads': DOWNLOADS}

    def open_folder(self):
        (self.root / 'llama').mkdir(parents=True, exist_ok=True)
        os.startfile(str(self.root))
        return {'opened': True, 'folder': str(self.root)}

    # ---------- 后台服务启停 ----------
    def _alive(self):
        return self.process is not None and self.process.poll() is None

    def _free_port(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            return sock.getsockname()[1]

    def _start(self, check):
        if self._alive():
            return
        if not self.available():
            raise ValueError('混元翻译组件未安装：需要 hunyuan\\llama\\llama-server.exe 和 hunyuan\\HY-MT*.gguf。')
        self.port = self._free_port()
        threads = max(2, (os.cpu_count() or 4) - 1)
        log = open(self.root / 'llama-server.log', 'w', encoding='utf-8', errors='replace')
        command = [str(self.server_path()), '-m', str(self.model_path()), '-ngl', '0', '--host', '127.0.0.1',
                   '--port', str(self.port), '-c', '4096', '-t', str(threads)]
        self.process = subprocess.Popen(command, cwd=str(self.server_path().parent), stdout=log, stderr=log,
                                        stdin=subprocess.DEVNULL, creationflags=0x08000000)  # CREATE_NO_WINDOW
        log.close()
        if self.job is None:
            self.job = _KillOnClose()
        self.job.add(self.process)
        deadline = time.monotonic() + START_TIMEOUT
        while time.monotonic() < deadline:
            check()
            if not self._alive():
                raise ValueError('混元翻译服务启动失败，详情见 hunyuan\\llama-server.log。')
            try:
                with request.urlopen(f'http://127.0.0.1:{self.port}/health', timeout=2) as response:
                    if response.status == 200:
                        break
            except (error.URLError, OSError):
                pass
            time.sleep(0.4)
        else:
            self.stop()
            raise ValueError('混元翻译服务启动超时，请稍后重试。')
        if self.watcher is None or not self.watcher.is_alive():
            self.watcher = threading.Thread(target=self._watch_idle, daemon=True)
            self.watcher.start()

    def _watch_idle(self):
        while True:
            time.sleep(30)
            with self.lock:
                if not self._alive():
                    return
                if time.monotonic() - self.last_used > IDLE_SECONDS:
                    self._stop_locked()
                    return

    def _stop_locked(self):
        process, self.process = self.process, None
        if process and process.poll() is None:
            process.terminate()
            try:
                process.wait(5)
            except subprocess.TimeoutExpired:
                process.kill()

    def stop(self):
        with self.lock:
            self._stop_locked()

    # ---------- 翻译 ----------
    def _infer(self, text):
        body = json.dumps({'messages': [{'role': 'user', 'content': PROMPT.format(text=text)}],
                           'temperature': 0.1, 'top_p': 0.6, 'top_k': 20, 'repeat_penalty': 1.05,
                           'max_tokens': 1024, 'seed': 1}).encode()
        req = request.Request(f'http://127.0.0.1:{self.port}/v1/chat/completions', body,
                              {'Content-Type': 'application/json'})
        with request.urlopen(req, timeout=300) as response:
            result = json.load(response)
        choice = result['choices'][0]
        if choice.get('finish_reason') == 'length':
            raise ValueError('译文可能达到长度上限，请把原文拆成更短的段落。')
        text = (choice['message'].get('content') or '').strip()
        if not text:
            raise ValueError('混元返回空译文，请缩短原文后重试。')
        return text

    def translate(self, text, check=lambda: None):
        if not isinstance(text, str) or not text.strip() or len(text) > 12000:
            raise ValueError('请填写 1～12000 字的中文描述。')
        if re.search(r'<lora:|\([^\n()]+:[-\d.]+\)|[-\d.]+::', text, re.I):
            raise ValueError('权重串或 LoRA 语法请保留在标签块中；本地翻译框用于普通句子。')
        with self.lock:
            if text in self.cache:
                self.cache.move_to_end(text)
                self.last_used = time.monotonic()
                return {**self.cache[text], 'cached': True}
            started = time.perf_counter()
            cold = not self._alive()
            self.last_used = time.monotonic()
            self._start(check)
            # 和 OPUS-MT 相同：翻译前把 {{A}} 等代号临时换成英文名，翻完再换回，避免模型改写代号。
            placeholders = list(dict.fromkeys(PLACEHOLDER.findall(text)))
            names = [name for name in NAMES if not re.search(r'\b' + name + r'\b', text, re.I)]
            if len(placeholders) > len(names):
                raise ValueError('这一段引用的角色太多，请拆分后翻译。')
            mapping = dict(zip(placeholders, names))
            prepared = PLACEHOLDER.sub(lambda m: mapping[m.group()], text)
            output = []
            for line in prepared.split('\n'):
                check()
                output.append(self._infer(line) if HAN.search(line) else line)
                self.last_used = time.monotonic()
            result = '\n'.join(output)
            for placeholder, name in mapping.items():
                result = re.sub(r'\b' + re.escape(name) + r'\b', lambda _: placeholder, result, flags=re.I)
            seconds = round(time.perf_counter() - started, 1)
            if Counter(PLACEHOLDER.findall(text)) != Counter(PLACEHOLDER.findall(result)):
                return {'text': result, 'raw': result, 'engine': 'local-hunyuan', 'valid': False,
                        'warnings': ['混元改写了人物引用，返回内容已展示，未自动采用。请核对或修改后采用。']}
            notice = f'混元翻译完成（{seconds} 秒{"，含首次启动" if cold else ""}），请核对人物、左右手和否定关系。'
            answer = {'text': result, 'engine': 'local-hunyuan', 'cached': False, 'seconds': seconds, 'notice': notice}
            self.cache[text] = answer
            while len(self.cache) > 128:
                self.cache.popitem(last=False)
            return answer
