#define _GNU_SOURCE
/* SPDX-License-Identifier: GPL-3.0-only */
#include <dlfcn.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

static ssize_t (*real_readlink)(const char *, char *, size_t);
/* One entry per thread: bounded memory, no locks inherited across zygote fork.
 * This caches a candidate path, never an authorization decision. */
static __thread struct {
    int valid;
    dev_t device;
    ino_t inode;
    char raw[1024];
    char resolved[4096];
} cache;

__attribute__((constructor)) static void init(void) {
    real_readlink = dlsym(RTLD_NEXT, "readlink");
    unsetenv("LD_PRELOAD");
}

static int same_file(const struct stat *a, const struct stat *b) {
    return a->st_dev == b->st_dev && a->st_ino == b->st_ino;
}

ssize_t readlink(const char *path, char *buf, size_t n) {
    if (!real_readlink) real_readlink = dlsym(RTLD_NEXT, "readlink");
    ssize_t r = real_readlink(path, buf, n);
    if (r <= 0 || strncmp(path, "/proc/self/fd/", 14)) return r;

    char alt[128], temp[4096];
    snprintf(alt, sizeof(alt), "/proc/thread-self/fd/%s", path + 14);
    ssize_t q = real_readlink(alt, temp, sizeof(temp));
    if (q == r && !memcmp(temp, buf, (size_t)r) && r < 1024 && buf[0] == '/') {
        char raw_path[1024], candidate[4096];
        struct stat original, raw;
        memcpy(raw_path, buf, (size_t)r);
        raw_path[r] = 0;
        if (stat(path, &original) != 0) return r;
        if (stat(raw_path, &raw) == 0 && same_file(&original, &raw)) return r;

        int hit = cache.valid && cache.device == original.st_dev &&
            cache.inode == original.st_ino && !strcmp(cache.raw, raw_path);
        if (hit && stat(cache.resolved, &raw) == 0 && same_file(&original, &raw)) {
            q = (ssize_t)strlen(cache.resolved);
            memcpy(temp, cache.resolved, (size_t)q);
        } else {
            cache.valid = 0;
            /* Recover detached-mount paths only when inode and device both match.
             * The stock Zygote allowlist remains intact. */
            FILE *f = fopen("/proc/self/mountinfo", "re");
            if (f) {
                char line[8192], point[2048], root[2048];
                int id, parent;
                unsigned ma, mi;
                while (fgets(line, sizeof(line), f)) {
                    if (sscanf(line, "%d %d %u:%u %2047s %2047s", &id, &parent,
                               &ma, &mi, root, point) != 6) continue;
                    if (strncmp(point, "/apex/", 6) && strncmp(point, "/system/", 8) &&
                        strncmp(point, "/system_ext/", 12) && strncmp(point, "/product/", 9) &&
                        strncmp(point, "/vendor/", 8) && strcmp(point, "/sys/kernel/tracing") &&
                        strcmp(point, "/system") && strcmp(point, "/system_ext") &&
                        strcmp(point, "/product") && strcmp(point, "/vendor") && strcmp(point, "/dev")) continue;
                    int length = snprintf(candidate, sizeof(candidate), "%s%s", point,
                                          r == 1 ? "" : raw_path);
                    if (length < 0 || (size_t)length >= sizeof(candidate)) continue;
                    struct stat b;
                    if (stat(candidate, &b) == 0 && same_file(&original, &b)) {
                        q = length;
                        memcpy(temp, candidate, (size_t)q);
                        memcpy(cache.raw, raw_path, (size_t)r + 1);
                        memcpy(cache.resolved, candidate, (size_t)q + 1);
                        cache.device = original.st_dev;
                        cache.inode = original.st_ino;
                        cache.valid = 1;
                        break;
                    }
                }
                fclose(f);
            }
        }
    }
    if (q > 0 && (q != r || memcmp(temp, buf, (size_t)r))) {
        size_t len = (size_t)q < n ? (size_t)q : n;
        memcpy(buf, temp, len);
        return (ssize_t)len;
    }
    return r;
}

ssize_t __readlink_chk(const char *p, char *b, size_t n, size_t cap) {
    if (n > cap) abort();
    return readlink(p, b, n);
}
