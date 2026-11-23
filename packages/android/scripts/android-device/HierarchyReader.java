package com.riddlequest.verification;

import android.os.Environment;
import com.android.uiautomator.core.Configurator;
import com.android.uiautomator.testrunner.UiAutomatorTestCase;
import java.io.File;

/** External SDK-only reader: animated game screens need no artificial idle interval. */
public final class HierarchyReader extends UiAutomatorTestCase {
  public void testDump() {
    Configurator.getInstance().setWaitForIdleTimeout(0);
    File target = new File(Environment.getDataDirectory(), "local/tmp/riddle-quest-window.xml");
    assertTrue("Hierarchy output directory is unavailable", target.getParentFile().isDirectory() || target.getParentFile().mkdirs());
    if (target.isFile()) assertTrue("Previous hierarchy cannot be removed", target.delete());
    for (int attempt = 0; attempt < 10 && !target.isFile(); attempt++) {
      getUiDevice().dumpWindowHierarchy("riddle-quest-window.xml");
      if (!target.isFile()) sleep(50);
    }
    assertTrue("Hierarchy XML was not written", target.isFile());
    System.out.println("RQ_HIERARCHY_PATH=" + target.getAbsolutePath());
  }
}
