const QA_SURFACE_RUNTIME_KEY = "__QWORDLY_QA_SURFACE_RUNTIME_ACTIVE__";

type QAGlobal = typeof globalThis & {
  [QA_SURFACE_RUNTIME_KEY]?: boolean;
};

export const setQASurfaceRuntimeActive = (isActive: boolean) => {
  (globalThis as QAGlobal)[QA_SURFACE_RUNTIME_KEY] = isActive;
};

export const isQASurfaceRuntimeActive = () =>
  (globalThis as QAGlobal)[QA_SURFACE_RUNTIME_KEY] === true;
