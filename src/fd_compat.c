#define _GNU_SOURCE
#include <dlfcn.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <android/log.h>
#include <sys/stat.h>
static ssize_t (*real_readlink)(const char*,char*,size_t);
__attribute__((constructor)) static void init(void) { real_readlink=dlsym(RTLD_NEXT,"readlink"); unsetenv("LD_PRELOAD"); }
ssize_t readlink(const char *path, char *buf, size_t n) {
    if(!real_readlink) real_readlink=dlsym(RTLD_NEXT,"readlink");
    ssize_t r=real_readlink(path,buf,n);
    if(r>0 && !strncmp(path,"/proc/self/fd/",14)) {
        char alt[128], temp[4096];
        snprintf(alt,sizeof(alt),"/proc/thread-self/fd/%s",path+14);
        ssize_t q=real_readlink(alt,temp,sizeof(temp));
        if(q==r && !memcmp(temp,buf,(size_t)r) && r<1024 && buf[0]=='/') {
            char line[8192],point[2048],root[2048],candidate[4096]; int id,parent; unsigned ma,mi;
            struct stat original,raw;
            memcpy(candidate,buf,(size_t)r);candidate[r]=0;
            if(stat(path,&original)!=0)return r;
            if(stat(candidate,&raw)==0 && original.st_dev==raw.st_dev && original.st_ino==raw.st_ino)return r;
            /* Recover detached-mount paths only when inode and device both match.
             * The stock Zygote allowlist remains intact. */
            FILE *f=fopen("/proc/self/mountinfo","re");
            if(f){while(fgets(line,sizeof(line),f)) {
                if(sscanf(line,"%d %d %u:%u %2047s %2047s",&id,&parent,&ma,&mi,root,point)!=6)continue;
                if(strncmp(point,"/apex/",6) && strncmp(point,"/system/",8) && strncmp(point,"/system_ext/",12) && strncmp(point,"/product/",9) && strncmp(point,"/vendor/",8) && strcmp(point,"/sys/kernel/tracing") && strcmp(point,"/system") && strcmp(point,"/system_ext") && strcmp(point,"/product") && strcmp(point,"/vendor") && strcmp(point,"/dev"))continue;
                snprintf(candidate,sizeof(candidate),"%s%.*s",point,r==1?0:(int)r,buf);
                struct stat b;
                if(stat(candidate,&b)==0 && original.st_dev==b.st_dev && original.st_ino==b.st_ino) {
                    q=(ssize_t)strlen(candidate);memcpy(temp,candidate,(size_t)q);
                    break;
                }
            }fclose(f);}
        }
        if(q>0 && (q!=r || memcmp(temp,buf,(size_t)r))) {
            size_t len=(size_t)q<n?(size_t)q:n; memcpy(buf,temp,len); return (ssize_t)len;
        }
    }
    return r;
}
ssize_t __readlink_chk(const char *p,char *b,size_t n,size_t cap) { if(n>cap) abort(); return readlink(p,b,n); }
