import java.io.File;
import java.util.*;
import com.android.tools.smali.dexlib2.*;
import com.android.tools.smali.dexlib2.iface.*;
import com.android.tools.smali.dexlib2.immutable.ImmutableDexFile;
import com.android.tools.smali.dexlib2.writer.pool.DexPool;
public class MergeConnectivity {
 public static void main(String[] args) throws Exception {
  DexFile global=DexFileFactory.loadDexFile(new File(args[0]),Opcodes.getDefault());
  DexFile donor=DexFileFactory.loadDexFile(new File(args[1]),Opcodes.getDefault());
  Map<String,ClassDef> classes=new TreeMap<>();int replaced=0;
  for(ClassDef c:global.getClasses())if(!c.getType().startsWith("Landroid/net/http/"))classes.put(c.getType(),c);
  for(ClassDef c:donor.getClasses())if(c.getType().startsWith("Landroid/net/http/") || c.getType().startsWith("Landroid/net/connectivity/org/chromium/") || !classes.containsKey(c.getType())){classes.put(c.getType(),c);replaced++;}
  DexPool.writeTo(args[2],new ImmutableDexFile(global.getOpcodes(),classes.values()));
  System.out.println("classes="+classes.size()+" matching donor HTTP classes="+replaced);
 }
}
