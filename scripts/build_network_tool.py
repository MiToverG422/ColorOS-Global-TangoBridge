#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Build an offline Android DEX merge tool from pinned Maven dependencies."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEPS = [
    ('https://dl.google.com/dl/android/maven2/com/android/tools/smali/smali-dexlib2/3.0.9/smali-dexlib2-3.0.9.jar', '8b547506f62f91d74b70f4beb4989b99e1ff61fc50b2525e9796ca35f0a351dc'),
    ('https://repo.maven.apache.org/maven2/com/google/guava/guava/31.1-android/guava-31.1-android.jar', '32ac2ed709d96d278b5d2e3e5cea178fa4939939c525fb647532f013308db309'),
    ('https://repo.maven.apache.org/maven2/com/google/guava/failureaccess/1.0.1/failureaccess-1.0.1.jar', 'a171ee4c734dd2da837e4b16be9df4661afab72a41adaf31eb84dfdaf936ca26'),
    ('https://repo.maven.apache.org/maven2/com/google/code/findbugs/jsr305/3.0.2/jsr305-3.0.2.jar', '766ad2a0783f2687962c8ad74ceecc38a28b9f72a2d085ee438b7813e928d0c7'),
]
DONOR = ('https://github.com/MiToverG422/ColorOS-Global-TangoBridge/releases/download/runtime-network-donor-v1/framework-connectivity.jar',
         '6cc81b920a739449aafa70ad392e32337c1eb4b5d6e20cdc523982d9be918e8c')


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def download(url, expected, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or digest(path) != expected:
        urllib.request.urlretrieve(url, path)
    if digest(path) != expected:
        raise ValueError('Dependency checksum mismatch: ' + path.name)
    return path


def build_tool(sdk, out, cache, java_home=None):
    sdk, out, cache = Path(sdk), Path(out), Path(cache)
    out.mkdir(parents=True, exist_ok=True)
    java_home = java_home or os.environ.get('JAVA_HOME')
    def java(name):
        return str(Path(java_home) / 'bin' / (name + ('.exe' if os.name == 'nt' else ''))) if java_home else name
    def run(command):
        subprocess.run([str(x) for x in command], check=True)
    deps = [download(url, sha, cache / url.rsplit('/', 1)[1]) for url, sha in DEPS]
    with tempfile.TemporaryDirectory(prefix='network-tool-', dir=cache) as tmp:
        tmp = Path(tmp)
        classes, dex = tmp / 'classes', tmp / 'dex'
        classes.mkdir(); dex.mkdir()
        run([java('javac'), '--release', '8', '-encoding', 'UTF-8', '-cp', os.pathsep.join(map(str, deps)),
             '-d', classes, ROOT / 'src/MergeConnectivity.java', ROOT / 'src/NetworkNativeProbe.java'])
        program = tmp / 'program.jar'
        test_classes = tmp / 'test-classes'
        test_classes.mkdir()
        test_cp = os.pathsep.join(map(str, [classes, *deps]))
        run([java('javac'), '--release', '8', '-cp', test_cp, '-d', test_classes,
             ROOT / 'tests/NetworkMergeTest.java'])
        run([java('java'), '-cp', os.pathsep.join([str(test_classes), test_cp]),
             'NetworkMergeTest', tmp / 'fixtures'])
        with zipfile.ZipFile(program, 'w') as z:
            for path in sorted(classes.rglob('*.class')):
                z.writestr(zipfile.ZipInfo(path.relative_to(classes).as_posix(), (2026, 1, 1, 0, 0, 0)), path.read_bytes())
        # jsr305 is compile-time metadata, not bundled runtime code.
        run([java('java'), '-cp', sdk / 'build-tools/36.0.0/lib/d8.jar', 'com.android.tools.r8.D8',
             '--min-api', '26', '--lib', sdk / 'platforms/android-36/android.jar', '--lib', deps[-1],
             '--output', dex, program, *deps[:-1]])
        if list(dex.glob('classes*.dex')) != [dex / 'classes.dex']:
            raise ValueError('Unexpected merger multidex output')
        with zipfile.ZipFile(out / 'network-merger.jar', 'w', compression=zipfile.ZIP_DEFLATED) as z:
            info = zipfile.ZipInfo('classes.dex', (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, (dex / 'classes.dex').read_bytes())
    download(*DONOR, out / 'donor.jar')
    for path in (ROOT / 'src/third-party').glob('*'):
        if path.is_file(): shutil.copyfile(path, out / path.name)
    (out / 'SHA256SUMS').write_text(''.join(digest(p) + '  ' + p.name + '\n'
        for p in sorted(out.iterdir()) if p.is_file() and p.name != 'SHA256SUMS'), encoding='ascii')
    print('Built offline network merger and pinned donor')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--sdk', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--cache', type=Path, required=True)
    p.add_argument('--java-home')
    args = p.parse_args()
    build_tool(args.sdk, args.out, args.cache, args.java_home)
