/** Produces notices only for packages emitted in the selected Web Target. */
export function createNotice(packageNames?: ReadonlySet<string>, options?: {includeHomepages?: boolean}): string;
