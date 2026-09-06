"""Run the real cache/locking shell code against controlled network JAR fixtures."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(os.name != 'nt' and shutil.which('flock'), 'Linux shell integration')
class NetworkPrepareTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copyfile(ROOT / 'module/network-state.sh', self.root / 'network-state.sh')
        self.data = self.root / 'data'
        self.source = self.root / 'source'
        self.source.mkdir()
        (self.source / 'framework-connectivity.jar').write_bytes(b'current')
        (self.source / 'other.jar').write_bytes(b'other')
        tools = self.root / 'network-tools'
        tools.mkdir()
        for name in ('donor.jar', 'network-merger.jar'):
            (tools / name).write_bytes(name.encode())
        (tools / 'SHA256SUMS').write_text(''.join(
            hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.name + '\n'
            for p in sorted(tools.iterdir())))
        self.tool('id', 'echo 0')
        self.tool('busybox', 'exec "$@"')
        self.tool('merger', '''echo merge >> "$TRACE"
[ "${FAIL:-0}" = 0 ] || exit 1
cp "$4" "$6"
if [ "${MUTATE:-0}" = 1 ]; then echo changed >> "$SOURCE/other.jar"; fi
''')
        common = (ROOT / 'module/common.sh').read_text()
        common = common.replace('BB=/data/adb/ksu/bin/busybox', f'BB="{self.root}/busybox"')
        common = common.replace('DATA=/data/adb/tango32_findx9u', f'DATA="{self.data}"')
        common = common.replace('NETWORK_SOURCE=/apex/com.android.tethering/javalib', f'NETWORK_SOURCE="{self.source}"')
        (self.root / 'common.sh').write_text(common + '\nguard() { return 0; }\n')
        script = (ROOT / 'module/network-prepare.sh').read_text()
        self.script = self.root / 'network-prepare.sh'
        self.script.write_text(script.replace('/system/bin/app_process64', f'"{self.root}/merger"'))
        self.env = dict(os.environ, PATH=str(self.root) + os.pathsep + os.environ['PATH'],
                        TRACE=str(self.root / 'trace'), SOURCE=str(self.source))

    def tool(self, name, body):
        path = self.root / name
        path.write_text('#!/bin/sh\n' + body + '\n')
        path.chmod(0o755)

    def run_prepare(self, mode='prepare', **env):
        return subprocess.run(['sh', str(self.script), mode], env={**self.env, **env},
                              capture_output=True, text=True, timeout=10)

    def caches(self):
        return list((self.data / 'network-cache').glob('*/ready.sha256'))

    def test_generate_reuse_and_source_change(self):
        first = self.run_prepare()
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertIn('NETWORK_GENERATED', first.stdout)
        second = self.run_prepare()
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertIn('NETWORK_CACHE_HIT', second.stdout)
        self.assertEqual((self.data / 'network-state').read_text().splitlines()[1:3], ['cached', 'none'])
        self.assertEqual((self.root / 'trace').read_text(), 'merge\n')
        (self.source / 'other.jar').write_bytes(b'updated')
        self.assertEqual(self.run_prepare().returncode, 0)
        self.assertEqual(len(self.caches()), 2)

    def test_corrupt_cache_is_retained_and_rejected(self):
        self.assertEqual(self.run_prepare().returncode, 0)
        cache = self.caches()[0].parent
        (cache / 'other.jar').write_bytes(b'corrupt')
        result = self.run_prepare()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('NETWORK_CACHE_CORRUPT', result.stdout)
        self.assertEqual((self.data / 'network-state').read_text().splitlines()[1:3], ['failed', 'cache_corrupt'])
        self.assertTrue(cache.exists())

    def test_merge_failure_and_racing_update_do_not_publish(self):
        for env in (dict(FAIL='1'), dict(MUTATE='1')):
            result = self.run_prepare(**env)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(self.caches(), [])
            self.assertEqual(list((self.data / 'network-cache').iterdir()), [])

    def test_failed_start_needs_explicit_retry(self):
        self.assertEqual(self.run_prepare().returncode, 0)
        marker = self.caches()[0].parent / 'startup-failed'
        marker.touch()
        self.assertNotEqual(self.run_prepare().returncode, 0)
        self.assertTrue(marker.exists())
        self.assertEqual(self.run_prepare('retry').returncode, 0)
        self.assertFalse(marker.exists())

    def test_tool_integrity_and_invalid_command(self):
        self.assertEqual(self.run_prepare('invalid').returncode, 64)
        (self.root / 'network-tools/donor.jar').write_bytes(b'corrupt')
        self.assertNotEqual(self.run_prepare().returncode, 0)
        self.assertFalse((self.root / 'trace').exists())

    def test_concurrent_preparations_only_merge_once(self):
        command = ['sh', str(self.script)]
        with subprocess.Popen(command, env=self.env, stdout=subprocess.PIPE, stderr=subprocess.PIPE) as first:
            second = self.run_prepare()
            _, error = first.communicate(timeout=10)
        self.assertEqual(first.returncode, 0, error)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual((self.root / 'trace').read_text(), 'merge\n')

    def test_progress_reader_rejects_previous_boot_and_truncated_state(self):
        self.assertEqual(self.run_prepare().returncode, 0)
        path = self.data / 'network-state'
        command = ['sh', '-c', '. "$1/network-state.sh"; DATA="$1/data"; network_read_state; echo "$NET_STAGE"', 'sh', str(self.root)]
        self.assertEqual(subprocess.check_output(command, text=True).strip(), 'prepared')
        lines = path.read_text().splitlines()
        path.write_text('old-boot\n' + '\n'.join(lines[1:]) + '\n')
        self.assertEqual(subprocess.check_output(command, text=True).strip(), 'unknown')
        path.write_text('\n'.join(lines[:3]) + '\n')
        self.assertEqual(subprocess.check_output(command, text=True).strip(), 'unknown')
