"""Exercise the real sampler with a controlled process table, without root or a phone."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(os.name != 'nt' and shutil.which('sh') and shutil.which('awk'),
                     'POSIX shell test (runs in Linux CI)')
class MonitorShellTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.env = dict(os.environ, PATH=str(self.root) + os.pathsep + os.environ['PATH'],
                        SERVICE='running', ZYGOTE_PID='10', TRACE=str(self.root / 'calls'))
        self.tool('id', 'echo 0')
        self.tool('getprop', 'case "$1" in init.svc.zygote_tango) echo "$SERVICE";; *) echo "$ZYGOTE_PID";; esac')
        self.tool('busybox', 'exec "$@"')
        self.tool('ps', '''echo ps >> "$TRACE"
[ "${PS_FAIL:-0}" = 0 ] || exit 1
printf 'PID PPID RSS NAME\n10 1 100 zygote\n11 10 200 app\n12 11 300 child\n99 1 900 other\n'
''')
        sampler = (ROOT / 'module/monitor.sh').read_text()
        self.script = self.root / 'monitor.sh'
        self.script.write_text(sampler.replace('BB=/data/adb/ksu/bin/busybox',
                                              f'BB="{self.root}/busybox"'))

    def tool(self, name, body):
        path = self.root / name
        path.write_text('#!/bin/sh\n' + body + '\n')
        path.chmod(0o755)

    def run_sample(self, **env):
        return subprocess.run(['sh', str(self.script), '--inside'], env={**self.env, **env},
                              capture_output=True, text=True, timeout=5)

    def test_stopped_or_missing_zygote_does_not_scan_processes(self):
        for env in [dict(SERVICE='stopped'), dict(SERVICE=''), dict(ZYGOTE_PID='0'),
                    dict(ZYGOTE_PID=''), dict(ZYGOTE_PID='invalid')]:
            with self.subTest(env=env):
                result = self.run_sample(**env)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('SUMMARY\t0\t0\t0\nEND\t1', result.stdout)
                self.assertFalse((self.root / 'calls').exists())

    def test_running_zygote_scans_once_and_only_counts_descendants(self):
        result = self.run_sample()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('SUMMARY\t1\t3\t600\nEND\t1', result.stdout)
        self.assertNotIn('other', result.stdout)
        self.assertEqual((self.root / 'calls').read_text(), 'ps\n')

    def test_process_exit_race_and_ps_failure(self):
        result = self.run_sample(ZYGOTE_PID='12345')
        self.assertEqual(result.returncode, 0)
        self.assertIn('SUMMARY\t0\t0\t0\nEND\t1', result.stdout)
        result = self.run_sample(PS_FAIL='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('END\t1', result.stdout)

    def test_status_accepts_only_current_boot_versioned_cache(self):
        control = self.root / 'monitor-control.sh'
        control.write_text((ROOT / 'module/monitor-control.sh').read_text())
        data = self.root / 'data'
        data.mkdir()
        (self.root / 'common.sh').write_text(f'BB="{self.root}/busybox"\nDATA="{data}"\n')
        boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
        body = 'SAMPLED\t100\nSAMPLE_UPTIME\t10\nAVAILABLE\t0\n'
        for prefix, accepted in [(boot + '\nCACHE\t2\n', True),
                                 (boot + '\n', False),
                                 ('previous-boot\nCACHE\t2\n', False)]:
            with self.subTest(prefix=prefix):
                (data / 'monitor.sample').write_text(prefix + body)
                result = subprocess.run(['sh', str(control), 'status'], env=self.env,
                                        capture_output=True, text=True, timeout=5)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertTrue(result.stdout.startswith('CONTROL\t2\nENABLED\t0\nNOW\t'))
                self.assertIn('\nUPTIME\t', result.stdout)
                self.assertTrue(result.stdout.endswith(body if accepted else
                    'SAMPLED\t0\nSAMPLE_UPTIME\t0\nAVAILABLE\t0\n'))
        (data / 'monitor.sample').unlink()
        result = subprocess.run(['sh', str(control), 'status'], env=self.env,
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(result.stdout.endswith('SAMPLED\t0\nSAMPLE_UPTIME\t0\nAVAILABLE\t0\n'))


if __name__ == '__main__':
    unittest.main()
