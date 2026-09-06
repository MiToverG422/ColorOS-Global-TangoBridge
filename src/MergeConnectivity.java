// SPDX-License-Identifier: GPL-3.0-only
import java.io.*;
import java.util.*;
import java.util.zip.*;
import com.android.tools.smali.dexlib2.*;
import com.android.tools.smali.dexlib2.iface.*;
import com.android.tools.smali.dexlib2.immutable.ImmutableDexFile;
import com.android.tools.smali.dexlib2.writer.pool.DexPool;
public class MergeConnectivity {
 static boolean replaced(String type) {
  return type.startsWith("Landroid/net/http/") || type.startsWith("Landroid/net/connectivity/org/chromium/");
 }
 static void checkJar(File file) throws IOException {
  if(file.length()>32*1024*1024L)throw new IOException("Input JAR exceeds size limit");
  Set<String> names=new HashSet<>();boolean dex=false;long total=0;
  try(ZipFile zip=new ZipFile(file)) {
   Enumeration<? extends ZipEntry> entries=zip.entries();
   while(entries.hasMoreElements()) {
    ZipEntry entry=entries.nextElement();String name=entry.getName();
    if(!names.add(name)||entry.getSize()<0||entry.getSize()>32*1024*1024L)throw new IOException("Invalid or duplicate JAR entry");
    total+=entry.getSize();if(names.size()>128||total>64*1024*1024L)throw new IOException("Expanded JAR exceeds size limit");
    if(name.endsWith(".dex")){if(!name.equals("classes.dex"))throw new IOException("Multidex network framework is not supported");dex=true;}
   }
  }
  if(!dex)throw new IOException("Network framework contains no classes.dex");
 }
 public static void main(String[] args) throws Exception {
  if(args.length!=3)throw new IllegalArgumentException("Usage: MergeConnectivity current.jar donor.jar output.dex|output.jar");
  checkJar(new File(args[0]));checkJar(new File(args[1]));
  if(new File(args[2]).exists())throw new IOException("Output already exists");
  DexFile global=DexFileFactory.loadDexFile(new File(args[0]),Opcodes.getDefault());
  DexFile donor=DexFileFactory.loadDexFile(new File(args[1]),Opcodes.getDefault());
  Map<String,ClassDef> classes=new TreeMap<>();int replaced=0;
  for(ClassDef c:global.getClasses())if(!replaced(c.getType()))classes.put(c.getType(),c);
  for(ClassDef c:donor.getClasses())if(replaced(c.getType()) || !classes.containsKey(c.getType())){classes.put(c.getType(),c);replaced++;}
  if(replaced==0||!classes.containsKey("Landroid/net/http/HttpEngine;"))throw new IOException("Expected donor HTTP classes missing");
  boolean jar=args[2].endsWith(".jar");
  File dex=jar?File.createTempFile("network-", ".dex",new File(args[2]).getAbsoluteFile().getParentFile()):new File(args[2]);
  try {
   DexPool.writeTo(dex.getPath(),new ImmutableDexFile(global.getOpcodes(),classes.values()));
   if(DexFileFactory.loadDexFile(dex,Opcodes.getDefault()).getClasses().size()!=classes.size())throw new IOException("Generated DEX failed validation");
   if(jar)try(ZipFile input=new ZipFile(args[0]);ZipOutputStream output=new ZipOutputStream(new FileOutputStream(args[2]))) {
    Enumeration<? extends ZipEntry> entries=input.entries();byte[] buffer=new byte[65536];
    while(entries.hasMoreElements()) {
     ZipEntry entry=entries.nextElement();String name=entry.getName();
     if(name.startsWith("META-INF/")&&!name.equals("META-INF/MANIFEST.MF"))continue;
     ZipEntry next=new ZipEntry(name);next.setTime(0);output.putNextEntry(next);
     try(InputStream in=name.equals("classes.dex")?new FileInputStream(dex):input.getInputStream(entry)) {
      int n;while((n=in.read(buffer))!=-1)output.write(buffer,0,n);
     }
     output.closeEntry();
    }
   }
  }finally{if(jar&&!dex.delete())dex.deleteOnExit();}
  System.out.println("classes="+classes.size()+" matching donor HTTP classes="+replaced);
  System.out.println("STRUCTURE_OK (not a general JNI or application compatibility guarantee)");
 }
}
