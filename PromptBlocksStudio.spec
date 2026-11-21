# -*- mode: python ; coding: utf-8 -*-
from importlib.util import find_spec
from pathlib import Path
from PyInstaller.utils.hooks import collect_all

root = Path(SPECPATH)
datas = [(str(root / 'ui'), 'ui'),
         (str(root / 'desktop.runtimeconfig.json'), '.'),
         (str(root / 'Physton-LICENSE.txt'), '.'),
         (str(root / 'THIRD_PARTY_NOTICES.md'), '.'),
         (str(root / 'README.md'), '.')]
binaries, hiddenimports = [], []
for package in ('webview', 'clr_loader', 'pythonnet', 'truststore'):
    data, binary, imports = collect_all(package)
    datas += data
    binaries += binary
    hiddenimports += imports

# An API-only desktop build does not require translation weights or runtimes.
for package in ('ctranslate2', 'sentencepiece'):
    if find_spec(package):
        data, binary, imports = collect_all(package)
        datas += data
        binaries += binary
        hiddenimports += imports
for model_name in ('opus-mt-zh-en-int8', 'opus-mt-en-zh-int8'):
    model = root / 'models' / model_name
    if model.is_dir():
        required = ('model.bin', 'config.json', 'shared_vocabulary.json', 'source.spm', 'target.spm')
        if not all((model / name).is_file() for name in required):
            raise RuntimeError('Offline model directory exists but is incomplete')
        if not all(find_spec(p) for p in ('ctranslate2', 'sentencepiece')):
            raise RuntimeError('Install requirements-offline.txt before bundling the model')
        datas.append((str(model), 'models/' + model_name))

a = Analysis([str(root / 'desktop.py')], pathex=[str(root)], binaries=binaries,
             datas=datas, hiddenimports=hiddenimports, hookspath=[], hooksconfig={},
             runtime_hooks=[], excludes=[], noarchive=False, optimize=0)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='PromptBlocksStudio',
          debug=False, bootloader_ignore_signals=False, strip=False, upx=False,
          console=False, disable_windowed_traceback=False, argv_emulation=False,
          target_arch=None, codesign_identity=None, entitlements_file=None,
          icon=[str(root / 'app.ico')])
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name='PromptBlocksStudio')
