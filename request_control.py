"""Per-request cancellation without affecting other editor requests."""
import http.client
import socket
import threading
import time
from urllib import request


class RequestCancelled(ValueError):
    pass


class Control:
    def __init__(self):
        self.event = threading.Event()
        self.lock = threading.Lock()
        self.socket = None

    def check(self):
        if self.event.is_set():
            raise RequestCancelled('已停止请求。')

    def bind(self, sock):
        with self.lock:
            self.socket = sock
            stopped = self.event.is_set()
        if stopped:
            self.cancel()
            self.check()

    def cancel(self):
        self.event.set()
        with self.lock:
            sock = self.socket
        if sock:
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            try:
                sock.close()
            except OSError:
                pass


class Requests:
    def __init__(self):
        self.lock = threading.Lock()
        self.active = {}
        self.early_stops = {}
        self.local = threading.local()
        self.slots = threading.BoundedSemaphore(8)

    def cancel(self, key):
        if not isinstance(key, str) or not 1 <= len(key) <= 100:
            return {'cancelled': False}
        with self.lock:
            control = self.active.get(key)
            self.early_stops = {k: t for k, t in self.early_stops.items() if time.monotonic() - t < 120}
            if not control:
                if len(self.early_stops) >= 256:
                    self.early_stops.pop(next(iter(self.early_stops)))
                self.early_stops[key] = time.monotonic()
        if control:
            control.cancel()
        return {'cancelled': True}

    def run(self, key, fn, *args):
        if key is None:
            return fn(*args)
        if not isinstance(key, str) or not 1 <= len(key) <= 100:
            raise ValueError('请求编号无效。')
        control = Control()
        with self.lock:
            if key in self.active:
                raise ValueError('请求编号重复。')
            if key in self.early_stops:
                self.early_stops.pop(key)
                control.cancel()
            self.active[key] = control
        done = threading.Event()
        outcome = {}
        def execute():
            self.local.control = control
            try:
                control.check()
                outcome['value'] = fn(*args)
            except Exception as exc:
                outcome['error'] = exc
            finally:
                self.local.control = None
                self.slots.release()
                done.set()
        try:
            control.check()
            if not self.slots.acquire(blocking=False):
                raise ValueError('先前连接正在结束，请稍后重试。')
            threading.Thread(target=execute, daemon=True).start()
            # Windows socket close may not wake an in-flight timeout/DNS wait.
            # Release the UI immediately; the daemon cannot publish a late result.
            while not done.wait(.05):
                control.check()
            control.check()
            if 'error' in outcome:
                raise outcome['error']
            return outcome['value']
        except Exception:
            control.check()
            raise
        finally:
            with self.lock:
                self.active.pop(key, None)

    def handlers(self, context):
        control = getattr(self.local, 'control', None)
        if not control:
            return [request.HTTPSHandler(context=context)]

        class ConnectionMixin:
            def connect(self):
                control.check()
                super().connect()
                control.bind(self.sock)

        class HTTPConnection(ConnectionMixin, http.client.HTTPConnection):
            pass

        class HTTPSConnection(ConnectionMixin, http.client.HTTPSConnection):
            pass

        class HTTPHandler(request.HTTPHandler):
            def http_open(self, req):
                return self.do_open(HTTPConnection, req)

        class HTTPSHandler(request.HTTPSHandler):
            def https_open(self, req):
                return self.do_open(HTTPSConnection, req, context=context)

        return [HTTPHandler(), HTTPSHandler(context=context)]
