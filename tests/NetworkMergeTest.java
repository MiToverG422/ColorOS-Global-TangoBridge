import java.nio.file.*;
import java.util.*;
import java.util.zip.*;
import com.android.tools.smali.dexlib2.*;
import com.android.tools.smali.dexlib2.iface.*;
import com.android.tools.smali.dexlib2.immutable.*;
import com.android.tools.smali.dexlib2.writer.pool.DexPool;

/** Synthetic fixtures: no firmware or device required. */
public class NetworkMergeTest {
 static ClassDef cls(String type, String source) {
  return new ImmutableClassDef(type, 1, "Ljava/lang/Object;", Collections.emptyList(),
   source, Collections.emptySet(), Collections.emptyList(), Collections.emptyList());
 }
 static Path jar(Path dir, String name, ClassDef... classes) throws Exception {
  Path dex=dir.resolve(name+".dex"), jar=dir.resolve(name+".jar");
  DexPool.writeTo(dex.toString(), new ImmutableDexFile(Opcodes.getDefault(), Arrays.asList(classes)));
  try(ZipOutputStream out=new ZipOutputStream(Files.newOutputStream(jar))) {
   out.putNextEntry(new ZipEntry("classes.dex")); out.write(Files.readAllBytes(dex)); out.closeEntry();
   out.putNextEntry(new ZipEntry("resource.txt")); out.write(new byte[]{42}); out.closeEntry();
  }
  return jar;
 }
 static void require(boolean value) { if(!value)throw new AssertionError(); }
 static void reject(Path host, Path donor, Path output) throws Exception {
  boolean failed=false;
  try { MergeConnectivity.main(new String[]{host.toString(),donor.toString(),output.toString()}); }
  catch(Exception expected) { failed=true; }
  require(failed);
 }
 public static void main(String[] args) throws Exception {
  Path dir=Paths.get(args[0]); Files.createDirectories(dir);
  String http="Landroid/net/http/HttpEngine;", stale="Landroid/net/connectivity/org/chromium/Stale;";
  Path host=jar(dir,"host",cls(http,"host"),cls(stale,"host"),cls("Landroid/net/Keep;","host"));
  Path donor=jar(dir,"donor",cls(http,"donor"),cls("Landroid/net/Keep;","donor"),cls("Lhelper/Missing;","donor"));
  byte[] original=Files.readAllBytes(host);
  Path output=dir.resolve("merged.jar");
  MergeConnectivity.main(new String[]{host.toString(),donor.toString(),output.toString()});
  Map<String,ClassDef> result=new HashMap<>();
  for(ClassDef c:DexFileFactory.loadDexFile(output.toFile(),Opcodes.getDefault()).getClasses())result.put(c.getType(),c);
  require(result.size()==3 && !result.containsKey(stale));
  require("donor".equals(result.get(http).getSourceFile()));
  require("host".equals(result.get("Landroid/net/Keep;").getSourceFile()));
  require(result.containsKey("Lhelper/Missing;"));
  require(Arrays.equals(original,Files.readAllBytes(host)));
  try(ZipFile zip=new ZipFile(output.toFile())) { require(zip.getInputStream(zip.getEntry("resource.txt")).read()==42); }
  reject(host,donor,output);
  reject(host,jar(dir,"no-http",cls("Lhelper/Only;","donor")),dir.resolve("invalid.jar"));
  Path broken=dir.resolve("broken.jar"); Files.write(broken,new byte[]{1,2,3});
  reject(broken,donor,dir.resolve("broken-output.jar"));
  Path multi=dir.resolve("multi.jar");
  try(ZipOutputStream z=new ZipOutputStream(Files.newOutputStream(multi))) {
   z.putNextEntry(new ZipEntry("classes2.dex")); z.write(new byte[]{1}); z.closeEntry();
  }
  reject(multi,donor,dir.resolve("multi-output.jar"));
  System.out.println("NETWORK_MERGE_TESTS_OK");
 }
}
