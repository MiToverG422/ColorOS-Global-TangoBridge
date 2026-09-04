#!/usr/bin/env python3
"""Compile project-owned native components and assemble a pinned runtime image."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import stat
import struct
import subprocess
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PROFILE = ROOT / 'profiles/cph2841-ex01-500.json'


def sha256(path):
    with Path(path).open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def verify_hash(path, expected):
    actual = sha256(path)
    if actual != expected:
        raise ValueError(f'SHA-256 mismatch for {Path(path).name}: {actual}')


def check_elf(path, elf_class, machine):
    with Path(path).open('rb') as f:
        header = f.read(20)
    if (len(header) < 20 or header[:4] != b'\x7fELF'
            or header[4] != elf_class or header[5] != 1
            or struct.unpack_from('<H', header, 18)[0] != machine):
        raise ValueError(f'Wrong ELF architecture: {path}')


def run(*args):
    subprocess.run([str(a) for a in args], check=True)


def compile_native(ndk, output, profile):
    output.mkdir(parents=True, exist_ok=True)
    host = 'windows-x86_64' if os.name == 'nt' else 'linux-x86_64'
    clang = ndk / 'toolchains/llvm/prebuilt' / host / 'bin' / ('clang.exe' if os.name == 'nt' else 'clang')
    api = profile['api']
    options = ['-O2', '-Wall', '-Wextra', '-Werror', f'-ffile-prefix-map={ROOT}=/src']
    for src, name in [('launcher.c', 'app_process32'), ('zygote_probe.c', 'zygote_probe')]:
        run(clang, f'--target=aarch64-linux-android{api}', '-static', *options,
            ROOT / 'src' / src, '-o', output / name)
        check_elf(output / name, 2, 183)
    run(clang, f'--target=armv7a-linux-androideabi{api}', '-shared', '-fPIC', *options,
        ROOT / 'src/fd_compat.c', '-ldl', '-o', output / 'libtango_fd_compat.so')
    check_elf(output / 'libtango_fd_compat.so', 1, 40)


def extract_payload(seed, destination, profile):
    verify_hash(seed, profile['seed_sha256'])
    with zipfile.ZipFile(seed) as z:
        # Read only this exact regular file; never extract archive paths/symlinks.
        matches = [i for i in z.infolist() if i.filename == 'payload.img']
        if len(matches) != 1 or matches[0].file_size != profile['payload_bytes']:
            raise ValueError('Unexpected seed payload size or duplicate entry')
        with z.open(matches[0]) as src, destination.open('wb') as dst:
            shutil.copyfileobj(src, dst)
    verify_hash(destination, profile['payload_sha256'])


def patch_image(image, native, mountpoint):
    if platform.system() != 'Linux':
        raise RuntimeError('Image assembly requires Linux and sudo; --native-only works on Windows')
    run('e2fsck', '-fn', image)
    mountpoint.mkdir(parents=True, exist_ok=True)
    run('sudo', '-n', 'mount', '-t', 'ext4', '-o', 'loop,rw', image, mountpoint)
    try:
        for name, relative in [
            ('app_process32', 'root/system/bin/app_process32'),
            ('libtango_fd_compat.so', 'root/system/lib/libtango_fd_compat.so'),
        ]:
            dst = mountpoint / relative
            if dst.is_symlink() or not dst.is_file() or not dst.resolve().is_relative_to(mountpoint.resolve()):
                raise ValueError(f'Unexpected payload target: {relative}')
            # In-place copy preserves SELinux xattrs. Device startup relabels as well.
            run('sudo', '-n', 'cp', native / name, dst)
            run('sudo', '-n', 'chown', '0:0', dst)
            run('sudo', '-n', 'chmod', '755' if name == 'app_process32' else '644', dst)
        run('sync')
    finally:
        run('sudo', '-n', 'umount', mountpoint)
    run('e2fsck', '-fn', image)


def write_zip(stage, destination):
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for path in sorted(stage.rglob('*')):
            if not path.is_file():
                continue
            info = zipfile.ZipInfo(path.relative_to(stage).as_posix(), (2026, 1, 1, 0, 0, 0))
            executable = path.suffix == '.sh' or path.name == 'zygote_probe'
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | (0o755 if executable else 0o644)) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            with path.open('rb') as src, z.open(info, 'w', force_zip64=True) as dst:
                shutil.copyfileobj(src, dst)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ndk', type=Path, default=os.environ.get('ANDROID_NDK_HOME'))
    parser.add_argument('--seed', type=Path, help='Optional locally downloaded, hash-verified seed ZIP')
    parser.add_argument('--native-only', action='store_true')
    args = parser.parse_args()
    if not args.ndk:
        parser.error('Set ANDROID_NDK_HOME or pass --ndk')
    profile = json.loads(PROFILE.read_text())
    ndk = args.ndk.resolve()
    if f'Pkg.Revision = {profile["ndk"]}' not in (ndk / 'source.properties').read_text():
        raise ValueError('NDK revision does not match profile')
    build = ROOT / 'build'
    native = build / 'native'
    compile_native(ndk, native, profile)
    if args.native_only:
        return
    seed = args.seed or build / 'runtime-seed.zip'
    if not args.seed:
        if seed.exists() and sha256(seed) != profile['seed_sha256']:
            seed.unlink()
        if not seed.exists():
            print('Downloading pinned runtime seed', flush=True)
            urllib.request.urlretrieve(profile['seed_url'], seed)
    stage = build / 'module'
    if stage.exists():
        shutil.rmtree(stage)  # Fixed generated directory inside this checkout only.
    shutil.copytree(ROOT / 'module', stage)
    shutil.copytree(ROOT / 'src', stage / 'src')
    shutil.copyfile(ROOT / 'README.md', stage / 'README.md')
    image = stage / 'payload.img'
    extract_payload(seed, image, profile)
    patch_image(image, native, build / 'mount')
    shutil.copyfile(native / 'zygote_probe', stage / 'zygote_probe')
    (stage / 'payload.sha256').write_text(f'{sha256(image)}  payload.img\n')
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    metadata = {'profile': profile, 'source_commit': commit, 'payload_sha256': sha256(image),
                'native_sha256': {p.name: sha256(p) for p in sorted(native.iterdir()) if p.is_file()},
                'validation': 'CI build is not a device compatibility test'}
    (stage / 'build-info.json').write_text(json.dumps(metadata, indent=2) + '\n')
    dist = ROOT / 'dist'
    dist.mkdir(exist_ok=True)
    filename = f'ColorOS-Global-TangoBridge-cph2841-ex01-500-{commit[:8]}.zip'
    destination = dist / filename
    write_zip(stage, destination)
    with zipfile.ZipFile(destination) as z:
        if z.testzip() is not None:
            raise ValueError('Final ZIP integrity check failed')
    (dist / 'SHA256SUMS').write_text(f'{sha256(destination)}  {filename}\n')
    (dist / 'build-info.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(f'Built {destination.name} ({destination.stat().st_size} bytes)', flush=True)


if __name__ == '__main__':
    main()
