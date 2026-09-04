#define _GNU_SOURCE
/* SPDX-License-Identifier: GPL-3.0-only */
#include <assert.h>
#include <dlfcn.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <errno.h>

static int scans, stale, normal_path, reused_fd, missing;
static const char *short_path = "/core.jar";
static const char *resolved = "/apex/com.android.art/javalib/core.jar";
static ssize_t fake_readlink(const char *path, char *buf, size_t n) {
    if (!strcmp(path, "/not-a-link")) { errno = EINVAL; return -1; }
    size_t len = strlen(short_path);
    if (len > n) len = n;
    memcpy(buf, short_path, len);
    return (ssize_t)len;
}
static int fake_stat(const char *path, struct stat *out) {
    memset(out, 0, sizeof(*out)); out->st_dev = 7; out->st_ino = 42;
    if (!strcmp(path, "/proc/self/fd/9")) { if (reused_fd) out->st_ino = 99; return 0; }
    if (!strcmp(path, short_path) && normal_path) return 0;
    if (!strcmp(path, resolved)) {
        if (missing) { errno = ENOENT; return -1; }
        if (stale) out->st_dev = 8;
        return 0;
    }
    errno = ENOENT; return -1;
}
static FILE *fake_fopen(const char *path, const char *mode) {
    (void)mode; assert(!strcmp(path, "/proc/self/mountinfo")); ++scans;
    FILE *file = tmpfile(); assert(file);
    fputs("1 0 0:7 / /apex/com.android.art/javalib rw - ext4 test rw\n", file);
    rewind(file); return file;
}
#define readlink test_readlink
#define __readlink_chk test_readlink_chk
#define dlsym(handle, name) ((void *)fake_readlink)
#define stat(path, output) fake_stat(path, output)
#define fopen(path, mode) fake_fopen(path, mode)
#include "../src/fd_compat.c"
#undef readlink
#undef __readlink_chk
#undef dlsym
#undef stat
#undef fopen

static void expect(const char *wanted) {
    char buffer[4096];
    ssize_t count = test_readlink("/proc/self/fd/9", buffer, sizeof(buffer));
    assert(count == (ssize_t)strlen(wanted));
    assert(!memcmp(buffer, wanted, (size_t)count));
}
int main(void) {
    expect(resolved); assert(scans == 1);
    for (int i = 0; i < 1000; ++i) expect(resolved);
    assert(scans == 1); /* Previously this repeated workload scanned 1001 times. */
    stale = 1; expect(short_path); assert(scans == 2); /* Same inode, different device. */
    stale = 0; expect(resolved); assert(scans == 3);
    reused_fd = 1; expect(short_path); assert(scans == 4);
    reused_fd = 0; expect(resolved); assert(scans == 5);
    missing = 1; expect(short_path); assert(scans == 6);
    missing = 0; normal_path = 1; expect(short_path); assert(scans == 6);
    normal_path = 0;
    char buffer[4] = {0, 0, 0, 'X'};
    assert(test_readlink("/proc/self/fd/9", buffer, 3) == 3);
    assert(!memcmp(buffer, "/co", 3) && buffer[3] == 'X');
    assert(test_readlink("/not-a-link", buffer, 3) == -1 && errno == EINVAL);
    puts("PASS: cache hit, changed device, reused fd, removed file, normal path, truncation, errno");
    return 0;
}
