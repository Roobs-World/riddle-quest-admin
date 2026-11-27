/** Preparation has no native display to dismiss; a late result must never proceed to show. */
export function createFacebookAdPreparation() {
  let pending = false;
  return {
    isPending: () => pending,
    async run<Value>(phase: "create" | "load", operation: () => Promise<Value>): Promise<Value> {
      if (pending) throw new Error("facebook-ad-preparation-in-progress");
      pending = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const native = Promise.resolve().then(operation).finally(() => {pending = false;});
      try {
        return await Promise.race([
          native,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`facebook-ad-${phase}-timeout`)), 30_000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
