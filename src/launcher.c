#define _GNU_SOURCE
#include <errno.h>
#include <sched.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mount.h>
#include <unistd.h>
#include <fcntl.h>

/* Only the ARM32 service and its descendants see the matching donor core jars. */
int main(int argc, char **argv) {
    if (unshare(CLONE_NEWNS) < 0) { perror("tango32: unshare"); return 111; }
    if (mount(NULL, "/", NULL, MS_REC | MS_PRIVATE, NULL) < 0) { perror("tango32: private mounts"); return 112; }
    const char *apexes[] = {"com.android.art", "com.android.conscrypt", "com.android.i18n", "com.android.tethering"};
    for (unsigned i=0; i<sizeof(apexes)/sizeof(apexes[0]); ++i) {
        char src[256], dst[256];
        snprintf(src,sizeof(src),"/system_ext/tango32/apex-javalib/%s",apexes[i]);
        snprintf(dst,sizeof(dst),"/apex/%s/javalib",apexes[i]);
        if (access(src,F_OK)!=0) continue;
        if (mount(src,dst,NULL,MS_BIND|MS_REC,NULL)<0) { perror("tango32: core bind"); return 113; }
    }
    /* Source is already on the module's read-only OverlayFS mount. */
    char **args = calloc((size_t)argc + 2, sizeof(char *));
    if (!args) return 115;
    args[0] = "/system_ext/bin/tango_translator";
    args[1] = "/system_ext/bin/app_process32.real";
    for (int i=1; i<argc; ++i) args[i+1] = argv[i];
    setenv("LD_PRELOAD", "/system/lib/libtango_fd_compat.so", 1);
    execv(args[0], args);
    int saved_errno = errno;
    perror("tango32: exec translator");
    return 160 + saved_errno;
}
