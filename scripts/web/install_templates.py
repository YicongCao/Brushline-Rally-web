#!/usr/bin/env python3
"""Install only matching official Web templates using HTTP ranges (no full TPZ download)."""
import io
import os
from pathlib import Path
import ssl
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
VERSION = (ROOT / '.godot-version').read_text().strip()
URL = f'https://github.com/godotengine/godot-builds/releases/download/{VERSION}-stable/Godot_v{VERSION}-stable_export_templates.tpz'
CONTEXT = ssl.create_default_context()
if sys.platform == 'darwin' and Path('/etc/ssl/cert.pem').exists():
    CONTEXT = ssl.create_default_context(cafile='/etc/ssl/cert.pem')


class RemoteZip(io.RawIOBase):
    def __init__(self, url):
        self.url, self.offset = url, 0
        with self.request(0, 0) as response:
            self.size = int(response.headers['Content-Range'].split('/')[-1])
            self.url = response.url

    def request(self, start, end):
        request = urllib.request.Request(self.url, headers={'Range': f'bytes={start}-{end}'})
        response = urllib.request.urlopen(request, context=CONTEXT, timeout=60)
        expected = f'bytes {start}-{end}/'
        if response.status != 206 or not response.headers.get('Content-Range', '').startswith(expected):
            response.close()
            raise RuntimeError('Server did not honor HTTP range; refusing a full template archive download')
        return response

    def seekable(self):
        return True

    def tell(self):
        return self.offset

    def seek(self, offset, whence=0):
        self.offset = offset if whence == 0 else (self.offset if whence == 1 else self.size) + offset
        return self.offset

    def read(self, size=-1):
        end = self.size if size < 0 else min(self.size, self.offset + size)
        if end <= self.offset:
            return b''
        with self.request(self.offset, end - 1) as response:
            data = response.read()
        if len(data) != end - self.offset:
            raise RuntimeError('Truncated template range')
        self.offset = end
        return data


if sys.platform == 'darwin':
    base = Path.home() / 'Library/Application Support/Godot/export_templates'
elif sys.platform == 'win32':
    base = Path(os.environ['APPDATA']) / 'Godot/export_templates'
else:
    base = Path(os.environ.get('XDG_DATA_HOME', str(Path.home() / '.local/share'))) / 'godot/export_templates'
destination = Path(os.environ.get('GODOT_TEMPLATE_DIR', str(base / f'{VERSION}.stable')))
destination.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(RemoteZip(URL)) as archive:
    selected = [n for n in archive.namelist() if Path(n).name in ('web_nothreads_release.zip', 'web_nothreads_debug.zip')]
    if len(selected) != 2:
        raise RuntimeError('Matching single-thread Web templates missing in official archive')
    for member in selected:
        target = destination / Path(member).name
        if target.exists():
            print('Already installed:', target.name, flush=True)
            continue
        print('Downloading:', target.name, flush=True)
        data = archive.read(member)  # ZipFile verifies the official TPZ member CRC.
        with zipfile.ZipFile(io.BytesIO(data)) as template:
            if template.testzip() is not None:
                raise RuntimeError('Corrupt Web template')
        temporary = target.with_suffix('.zip.part')
        temporary.write_bytes(data)
        temporary.replace(target)
        print('Installed:', target.name, len(data), 'bytes', flush=True)
