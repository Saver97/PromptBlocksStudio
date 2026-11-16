"""Local desktop prompt editor; no image service or account required."""
import json
import logging
import mimetypes
import os
from pathlib import Path
import shutil
import socket
import sys
import threading

import pyperclip
import webview
from pythonnet import load as load_dotnet
from translation import Translator, ReturnedContentError
from request_control import RequestCancelled
from window_chrome import apply_colors

ASSETS = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
APP_DIR = Path(sys.executable).parent if getattr(sys, 'frozen', False) else Path(__file__).resolve().parent
DATA_DIR = APP_DIR / 'data'
if '--smoke-test' in sys.argv:
    DATA_DIR = APP_DIR / 'smoke-data'
DATA_DIR.mkdir(exist_ok=True)
logging.basicConfig(filename=DATA_DIR / 'desktop.log', level=logging.INFO, encoding='utf-8')


class Api:
    def __init__(self):
        self.lock = threading.Lock()
        self._translator = Translator(DATA_DIR)

    def set_window_colors(self, background, foreground, dark):
        try:
            handle = webview.windows[0].native.Handle.ToInt64()
            return apply_colors(handle, background, foreground, dark)
        except (ValueError, OSError, AttributeError):
            return {'applied': False}

    def translation_settings(self):
        try:
            return self._translator.settings()
        except ValueError as exc:
            return {'error': str(exc)}

    def save_translation_settings(self, value):
        try:
            return self._translator.save(value)
        except (ValueError, OSError) as exc:
            return {'error': str(exc) if isinstance(exc, ValueError) else '本机翻译设置保存失败。'}

    def list_models(self, value):
        try:
            return self._translator.list_models(value)
        except ValueError as exc:
            return {'error': str(exc)}
        except Exception:
            return {'error': '获取模型列表失败，请检查接口设置。'}

    def cancel_request(self, request_id):
        return self._translator.requests.cancel(request_id)

    def translate(self, text, request_id=None):
        try:
            return self._translator.requests.run(request_id, self._translator.translate, text)
        except RequestCancelled:
            return {'cancelled': True}
        except ReturnedContentError as exc:
            return {'text': exc.content, 'raw': exc.content, 'valid': False, 'warnings': [str(exc)]}
        except ValueError as exc:
            return {'error': str(exc)}
        except Exception:
            return {'error': '翻译失败，请检查接口设置。'}

    def polish(self, text, side='positive', characters=None, request_id=None):
        try:
            return self._translator.requests.run(request_id, self._translator.polish, text, side, characters)
        except RequestCancelled:
            return {'cancelled': True}
        except ReturnedContentError as exc:
            return {'text': exc.content, 'raw': exc.content, 'valid': False, 'warnings': [str(exc)]}
        except ValueError as exc:
            return {'error': str(exc)}
        except Exception:
            return {'error': '中文润色失败，请检查接口设置。原文未修改。'}

    def load(self):
        state = None
        state_file = DATA_DIR / 'workspace.json'
        if state_file.exists():
            try:
                state = json.loads(state_file.read_text(encoding='utf-8'))
            except (OSError, ValueError):
                logging.exception('Could not read workspace; preserving original')
                raise RuntimeError('工作区读取失败，原文件已保留。请检查 data/workspace.json。')
        if state is None:
            state = json.loads((ASSETS / 'ui/starter-workspace.json').read_text(encoding='utf-8'))
        return {'library': json.loads((ASSETS / 'ui/library.json').read_text(encoding='utf-8')),
                'bundles': json.loads((ASSETS / 'ui/bundles.json').read_text(encoding='utf-8')),
                'state': state}

    def save(self, state):
        if not isinstance(state, dict) or state.get('version') != 2:
            raise ValueError('工作区格式不正确')
        payload = json.dumps(state, ensure_ascii=False, indent=2)
        with self.lock:
            target = DATA_DIR / 'workspace.json'
            pending = DATA_DIR / 'workspace.tmp'
            pending.write_text(payload, encoding='utf-8')
            if target.exists():
                shutil.copy2(target, DATA_DIR / 'workspace.previous.json')
            os.replace(pending, target)
        return True

    def copy(self, text):
        pyperclip.copy(str(text))
        return True

    def export_file(self, state):
        result = webview.windows[0].create_file_dialog(webview.FileDialog.SAVE, save_filename='提示词积木工作区.json', file_types=('JSON (*.json)',))
        if result:
            target = result if isinstance(result, str) else result[0]
            Path(target).write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
            return True
        return False

    def import_file(self):
        result = webview.windows[0].create_file_dialog(webview.FileDialog.OPEN, allow_multiple=False, file_types=('JSON (*.json)',))
        if not result:
            return None
        return json.loads(Path(result[0]).read_text(encoding='utf-8-sig'))


def main():
    import ctypes
    from ctypes import wintypes
    mutex = None
    if '--smoke-test' not in sys.argv:
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        kernel.CreateMutexW.argtypes = [ctypes.c_void_p, wintypes.BOOL, wintypes.LPCWSTR]
        kernel.CreateMutexW.restype = wintypes.HANDLE
        mutex = kernel.CreateMutexW(None, False, 'Local\\PromptBlocksStudio')
        if ctypes.get_last_error() == 183:
            user = ctypes.windll.user32
            user.FindWindowW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR]
            user.FindWindowW.restype = wintypes.HWND
            handle = user.FindWindowW(None, '提示词积木 · 分块组装版')
            if handle:
                user.ShowWindow(handle, 9)
                user.SetForegroundWindow(handle)
            return
    load_dotnet('coreclr', runtime_config=str(ASSETS / 'desktop.runtimeconfig.json'))
    import clr
    clr.AddReference('Microsoft.Win32.SystemEvents')
    mimetypes.init()
    mimetypes.add_type('application/javascript', '.js')
    mimetypes.add_type('text/css', '.css')
    api = Api()
    window = webview.create_window('提示词积木 · 分块组装版', str(ASSETS / 'ui/index.html'), js_api=api,
                                   width=1560, height=960, min_size=(1100, 720), background_color='#111519')

    allow_close = False
    saving_on_close = False

    def flush_and_close():
        nonlocal allow_close
        try:
            state = window.evaluate_js('window.exportState ? window.exportState() : null')
            if state:
                api.save(state)
        except Exception:
            logging.exception('Could not save workspace on close')
        allow_close = True
        window.destroy()

    def closing():
        nonlocal saving_on_close
        if allow_close:
            return True
        if not saving_on_close:
            saving_on_close = True
            threading.Thread(target=flush_and_close, daemon=True).start()
        return False
    window.events.closing += closing

    def smoke():
        import time
        for _ in range(60):
            time.sleep(0.5)
            ready = window.evaluate_js('Boolean(window.appReady)')
            if ready:
                result = window.evaluate_js('({ready:window.appReady, languageReady:Boolean(document.querySelector("#addProse") && window.pywebview?.api?.translate), polishReady:Boolean(window.pywebview?.api?.polish), count:document.querySelector("#libraryCount").textContent, bundleCount:bundleLibrary.length, title:document.title, version:window.exportState().version, schemes:window.exportState().schemes.length, url:location.href})')
                if '--polish-smoke-test' in sys.argv:
                    window.evaluate_js('window.pywebview.api.polish("{{A}}站左边，{{B}}站右边，两人看书。", "positive", [], "packaged-polish-smoke").then(r => window.polishSmokeResult = r)')
                    for _ in range(100):
                        time.sleep(0.1)
                        polished = window.evaluate_js('window.polishSmokeResult || null')
                        if polished:
                            result['polish'] = polished
                            break
                    window.evaluate_js('window.pywebview.api.cancel_request("packaged-cancel-smoke").then(() => window.pywebview.api.translate("测试取消。", "packaged-cancel-smoke")).then(r => window.cancelSmokeResult = r)')
                    for _ in range(50):
                        time.sleep(0.1)
                        cancelled = window.evaluate_js('window.cancelSmokeResult || null')
                        if cancelled:
                            result['cancelledRequest'] = cancelled
                            break
                if '--offline-smoke-test' in sys.argv:
                    result['offline'] = api._translator.offline.translate('{{B}} 用右手握住 {{A}} 的左手。')
                    result['offlineDevice'] = api._translator.offline.translator.device
                if '--models-smoke-test' in sys.argv:
                    window.evaluate_js('window.pywebview.api.translation_settings().then(s => window.pywebview.api.list_models({endpoint:s.endpoint})).then(r => window.modelsSmokeResult = r)')
                    for _ in range(100):
                        time.sleep(0.1)
                        models = window.evaluate_js('window.modelsSmokeResult || null')
                        if models:
                            result['models'] = models
                            break
                if '--chrome-smoke-test' in sys.argv:
                    result['chrome'] = []
                    for theme in ('forest', 'midnight', 'violet', 'ember', 'paper', 'mist'):
                        window.evaluate_js('window.chromeThemeResult = null; chromeTheme = ""; document.querySelector("#themeSelect").value = '+json.dumps(theme)+'; document.querySelector("#themeSelect").dispatchEvent(new Event("change"))')
                        for _ in range(50):
                            time.sleep(0.1)
                            chrome = window.evaluate_js('window.chromeThemeResult || null')
                            if chrome:
                                result['chrome'].append({'theme': theme, **chrome})
                                break
                        if theme in ('forest', 'paper'):
                            from System.Drawing import Bitmap, Graphics
                            from System.Drawing.Imaging import ImageFormat
                            bitmap = Bitmap(window.native.Width, window.native.Height)
                            graphics = Graphics.FromImage(bitmap)
                            dc = graphics.GetHdc()
                            user = ctypes.WinDLL('user32')
                            user.PrintWindow.argtypes = [wintypes.HWND, wintypes.HDC, wintypes.UINT]
                            user.PrintWindow(window.native.Handle.ToInt64(), dc.ToInt64(), 2)
                            graphics.ReleaseHdc(dc)
                            bitmap.Save(str(APP_DIR / ('titlebar-'+theme+'.png')), ImageFormat.Png)
                            graphics.Dispose()
                            bitmap.Dispose()
                (APP_DIR / 'native-validation.json').write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
                window.destroy()
                return
        result = window.evaluate_js('({ready:false, title:document.title, url:location.href, body:document.body.innerText.slice(0,1600)})')
        (APP_DIR / 'native-validation.json').write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
        window.destroy()
    # pywebview otherwise uses port 42001 with private_mode=False, shared by the old app.
    # Persist data through the native API, so a fresh loopback origin is safe here.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(('127.0.0.1', 0))
        app_port = listener.getsockname()[1]
    logging.info('Starting PromptBlocksStudio on loopback port %s', app_port)
    webview.start(smoke if '--smoke-test' in sys.argv else None, gui='edgechromium', private_mode=False,
                  storage_path=str(DATA_DIR / 'webview'), http_port=app_port)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        logging.exception('Desktop startup failed')
        if '--smoke-test' not in sys.argv:
            import ctypes
            ctypes.windll.user32.MessageBoxW(0, f'启动失败，请查看日志：\n{DATA_DIR / "desktop.log"}', '提示词工作台', 16)
        raise
