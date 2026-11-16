"""Match the native Windows title bar to the web UI's active palette."""
import ctypes
from ctypes import wintypes
import re


def colorref(value):
    if not isinstance(value, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', value):
        raise ValueError('Invalid window color')
    return int(value[1:3], 16) | (int(value[3:5], 16) << 8) | (int(value[5:7], 16) << 16)


def apply_colors(handle, background, foreground, dark):
    caption, text = colorref(background), colorref(foreground)
    dwm = ctypes.WinDLL('dwmapi')
    dwm.DwmSetWindowAttribute.argtypes = [wintypes.HWND, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD]
    dwm.DwmSetWindowAttribute.restype = ctypes.c_long
    # Keep native window controls and resize behavior; change only DWM colors.
    for attribute, value in ((20, int(bool(dark))), (34, caption), (35, caption), (36, text)):
        data = wintypes.DWORD(value)
        result = dwm.DwmSetWindowAttribute(handle, attribute, ctypes.byref(data), ctypes.sizeof(data))
        if result != 0:
            return {'applied': False, 'attribute': attribute, 'hresult': result}
    # Caption/text colors are documented as Set attributes; Get can return E_INVALIDARG.
    return {'applied': True, 'caption': caption, 'text': text, 'dark': int(bool(dark))}
