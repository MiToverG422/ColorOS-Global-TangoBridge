#include <sys/socket.h>
#include <sys/un.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>
#include <stdint.h>
static int exact(int fd,void *b,size_t n){while(n){ssize_t r=read(fd,b,n);if(r<=0)return -1;b=(char*)b+r;n-=(size_t)r;}return 0;}
int main(void){
 if(setgid(1000)||setuid(1000)){perror("probe credentials");return 8;}
 int fd=socket(AF_UNIX,SOCK_STREAM|SOCK_CLOEXEC,0);if(fd<0){perror("probe socket");return 1;}
 struct timeval tv={2,0};setsockopt(fd,SOL_SOCKET,SO_RCVTIMEO,&tv,sizeof(tv));setsockopt(fd,SOL_SOCKET,SO_SNDTIMEO,&tv,sizeof(tv));
 struct sockaddr_un a={.sun_family=AF_UNIX};strcpy(a.sun_path,"/dev/socket/zygote_secondary");
 if(connect(fd,(struct sockaddr*)&a,sizeof(a))!=0){perror("probe connect");return 2;}
 const char msg[]="1\n--query-abi-list\n";if(write(fd,msg,sizeof(msg)-1)!=(ssize_t)sizeof(msg)-1)return 3;
 uint32_t size;if(exact(fd,&size,4)){perror("probe read");return 4;}size=ntohl(size);if(size==0||size>=256){fprintf(stderr,"probe size %u\n",size);return 5;}
 char buf[256];if(exact(fd,buf,size))return 6;buf[size]=0;close(fd);
 if(!strstr(buf,"armeabi-v7a"))return 7;printf("ZYGOTE32_READY %s\n",buf);return 0;
}
