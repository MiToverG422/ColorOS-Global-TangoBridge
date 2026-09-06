import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('build', Path(__file__).parents[1] / 'scripts/build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class BuildTests(unittest.TestCase):
    def test_seed_integrity_and_size(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            seed, output = d / 'seed.zip', d / 'payload.img'
            with zipfile.ZipFile(seed, 'w') as z:
                z.writestr('payload.img', b'fixture')
                z.writestr('../../outside', b'not extracted')
            profile = {'seed_sha256': build.sha256(seed), 'payload_bytes': 7,
                       'payload_sha256': build.hashlib.sha256(b'fixture').hexdigest()}
            build.extract_payload(seed, output, profile)
            self.assertEqual(output.read_bytes(), b'fixture')
            self.assertEqual(sorted(p.name for p in d.iterdir()), ['payload.img', 'seed.zip'])
            for field, bad in [('seed_sha256', '0' * 64), ('payload_sha256', '0' * 64), ('payload_bytes', 8)]:
                with self.subTest(field=field), self.assertRaises(ValueError):
                    build.extract_payload(seed, output, {**profile, field: bad})

    def test_architecture_check(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'elf'
            data = bytearray(20)
            data[:6] = b'\x7fELF\x01\x01'
            struct.pack_into('<H', data, 18, 40)
            p.write_bytes(data)
            build.check_elf(p, 1, 40)
            with self.assertRaises(ValueError):
                build.check_elf(p, 2, 183)

    def test_module_zip_layout_and_modes(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            stage = d / 'module'
            stage.mkdir()
            (stage / 'module.prop').write_text('id=test\n')
            (stage / 'service.sh').write_text('#!/system/bin/sh\n')
            (stage / 'webroot').mkdir()
            (stage / 'webroot/index.html').write_text('<!doctype html>')
            output = d / 'module.zip'
            build.write_zip(stage, output)
            with zipfile.ZipFile(output) as z:
                self.assertEqual(z.namelist(), ['module.prop', 'service.sh', 'webroot/index.html'])
                self.assertEqual((z.getinfo('service.sh').external_attr >> 16) & 0o777, 0o755)
                self.assertEqual((z.getinfo('webroot/index.html').external_attr >> 16) & 0o777, 0o644)
                self.assertIsNone(z.testzip())

    def test_network_bundle_pinned_hash_and_entry_validation(self):
        names = ['framework-connectivity.jar', 'framework-connectivity-b.jar',
                 'framework-connectivity-t.jar', 'framework-tethering.jar',
                 'service-connectivity.jar', 'SHA256SUMS', 'ORIGINAL_SHA256SUMS', 'provenance.json']
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            archive = root / 'network.zip'
            with zipfile.ZipFile(archive, 'w') as z:
                for name in names:
                    z.writestr(name, b'fixture')
            target = root / 'valid'
            build.extract_network_bundle(archive, target, build.sha256(archive))
            self.assertEqual(sorted(p.name for p in target.iterdir()), sorted(names))
            with self.assertRaises(ValueError):
                build.extract_network_bundle(archive, root / 'bad-hash', '0' * 64)
            self.assertFalse((root / 'bad-hash').exists())
            for kind in ['traversal', 'duplicate', 'symlink']:
                with self.subTest(kind=kind):
                    with zipfile.ZipFile(archive, 'w') as z:
                        for name in names:
                            if name == names[0] and kind == 'traversal':
                                z.writestr('../escape.jar', b'bad')
                            elif name == names[0] and kind == 'symlink':
                                info = zipfile.ZipInfo(name)
                                info.create_system = 3
                                info.external_attr = 0o120777 << 16
                                z.writestr(info, '../escape')
                            else:
                                z.writestr(name, b'fixture')
                        if kind == 'duplicate':
                            import warnings
                            with warnings.catch_warnings():
                                warnings.simplefilter('ignore', UserWarning)
                                z.writestr(names[0], b'duplicate')
                    with self.assertRaises(ValueError):
                        build.extract_network_bundle(archive, root / kind, build.sha256(archive))
                    self.assertFalse((root / kind).exists())


if __name__ == '__main__':
    unittest.main()
