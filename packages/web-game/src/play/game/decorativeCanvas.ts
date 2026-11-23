/** Browser events whose driver callbacks belong to this optional graphics lifetime. */
const CONTEXT_EVENTS = new Set(["webglcontextlost", "webglcontextrestored", "webglcontextcreationerror"]);

/** A guarded native registration, deduplicated using the browser's listener/capture identity. */
type ContextRegistration = {
  /** Native event name. */
  type: string;
  /** Original callback, released when this registration retires. */
  listener: EventListenerOrEventListenerObject | null;
  /** Capture participates in native registration identity. */
  capture: boolean;
  /** Whether the native registration is still owned. */
  active: boolean;
  /** Callback installed on the canvas rather than the unguarded driver callback. */
  wrapped: EventListener;
  /** Removes an optional abort subscription alongside the native listener. */
  removeAbort?: () => void;
};

/** Owns driver event callbacks on one canvas without changing shared browser prototypes. */
export function createDecorativeCanvas(onError: (error: unknown, eventType: string) => void) {
  /** Matches Three's default canvas display behavior. */
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  /** Native methods remain bound to this exact canvas. */
  const nativeAdd = canvas.addEventListener.bind(canvas);
  /** Removal uses the wrapped callback's native identity. */
  const nativeRemove = canvas.removeEventListener.bind(canvas);
  /** At most the renderer and scene's current context subscriptions are retained. */
  const registrations = new Set<ContextRegistration>();
  /** Retired canvas callbacks and retained add methods cannot re-enter driver setup. */
  let disposed = false;

  /** Releases the original callback even if a browser retains its removed wrapper. */
  const remove = (registration: ContextRegistration) => {
    if (!registration.active) return;
    registration.active = false;
    registrations.delete(registration);
    registration.listener = null;
    registration.removeAbort?.();
    nativeRemove(registration.type, registration.wrapped, registration.capture);
  };
  /** Retires all context callbacks before the renderer and context are released. */
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const registration of registrations) remove(registration);
  };

  canvas.addEventListener = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
    if (!listener) return;
    if (!CONTEXT_EVENTS.has(type)) { nativeAdd(type, listener, options); return; }
    if (disposed || (typeof options === "object" && options?.signal?.aborted)) return;
    /** Native identity ignores once, passive and signal when an existing listener matches. */
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    for (const registration of registrations) {
      if (registration.type === type && registration.listener === listener && registration.capture === capture) return;
    }
    /** Snapshot the native once option instead of observing later changes to the options object. */
    const once = typeof options === "object" && Boolean(options?.once);
    /** The registration exists before the callback can run or remove itself. */
    const registration: ContextRegistration = {type, listener, capture, active: true, wrapped: () => {}};
    registration.wrapped = (event) => {
      if (disposed || !registration.active || !registration.listener) return;
      /** Preserve once behavior, including a callback registering itself again. */
      const callback = registration.listener;
      if (once) remove(registration);
      try {
        if (typeof callback === "function") callback.call(canvas, event);
        else callback.handleEvent(event);
      } catch (error) {
        // Retire later callbacks in this dispatch before reporting or graphics cleanup.
        dispose();
        try { onError(error, type); } catch { /* Optional diagnostics cannot escape a browser event. */ }
      }
    };
    registrations.add(registration);
    nativeAdd(type, registration.wrapped, options);
    if (typeof options === "object" && options?.signal) {
      /** Native abort removes the wrapper; the owner must also release its original callback. */
      const signal = options.signal;
      /** Completes owned removal when the caller's abort signal fires. */
      const abort = () => remove(registration);
      registration.removeAbort = () => signal.removeEventListener("abort", abort);
      signal.addEventListener("abort", abort, {once: true});
    }
  };
  canvas.removeEventListener = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) => {
    if (!listener) return;
    if (!CONTEXT_EVENTS.has(type)) { nativeRemove(type, listener, options); return; }
    /** Removing an original driver callback must remove its corresponding native wrapper. */
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    for (const registration of registrations) {
      if (registration.type === type && registration.listener === listener && registration.capture === capture) remove(registration);
    }
  };

  return {canvas, dispose};
}
