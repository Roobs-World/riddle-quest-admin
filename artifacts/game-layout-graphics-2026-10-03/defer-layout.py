from pathlib import Path
p=Path('packages/portal/src/play/SolarSystem.tsx');s=p.read_text();s=s.replace('    /** Whether Three can currently draw', '''    /** Last observer measurement, retained while host pause delays graphics construction. */
    let measuredLayout: DOMRectReadOnly | undefined;
    /** Layout setup is requested once without polling or repeated readiness frames. */
    let layoutPrepared = false;
    /** The resize implementation becomes available only after graphics construction. */
    let resizeScene: ((layout: DOMRectReadOnly) => void) | undefined;
    /** Whether Three can currently draw''');needle='    initialization = createDecorativeInitialization({\n      canInitialize: () => !pausedRef.current,';assert needle in s;s=s.replace(needle,'''    /** Measures layout before creating a renderer or requesting scene textures. */
    const prepareLayout = () => {
      if (layoutPrepared || disposed) return;
      layoutPrepared = true;
      stopWaitingForLayout = runWhenLayoutReady(() => {
        if (disposed) return;
        try {
          observer = new ResizeObserver(([entry]) => {
            if (disposed || !entry) return;
            measuredLayout = entry.contentRect;
            renderingReady = Number.isFinite(measuredLayout.width) && Number.isFinite(measuredLayout.height) &&
              measuredLayout.width > 0 && measuredLayout.height > 0;
            if (resizeScene) resizeScene(measuredLayout);
            else initialization?.refresh();
          });
          resources.defer(() => observer?.disconnect());
          observer.observe(mount);
        } catch (error) {
          failScene(error, "observe_scene");
        }
      });
      resources.defer(() => stopWaitingForLayout?.());
    };

    initialization = createDecorativeInitialization({
      canInitialize: () => {
        if (pausedRef.current) return false;
        prepareLayout();
        return renderingReady;
      },''');s=s.replace('          const resize = ({width, height}: DOMRectReadOnly) => {','          resizeScene = ({width, height}: DOMRectReadOnly) => {').replace('            renderingReady = width > 0 && height > 0;','            renderingReady = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;');a=s.index('          stopWaitingForLayout = runWhenLayoutReady(() => {');b=s.index('\n        } catch (error) {\n          failScene(error, "initialize_scene");',a);s=s[:a]+'          if (measuredLayout) resizeScene(measuredLayout);'+s[b:];p.write_text(s)
