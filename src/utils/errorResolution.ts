export interface ErrorMessageStrategy {
  name: string;
  matches(error: unknown): boolean;
  resolve(error: unknown): string | null;
}

export interface ErrorMessageResolverOptions {
  fallbackMessage: string;
}

const normalizeCode = (code: string): string => code.trim().toLowerCase();

export const extractErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const code = (error as {code?: unknown}).code;
  return typeof code === "string" ? code : undefined;
};

export const extractErrorMessage = (error: unknown): string | undefined => {
  if (typeof error === "string") {
    return error;
  }

  if (!error || typeof error !== "object") {
    return undefined;
  }

  const message = (error as {message?: unknown}).message;
  return typeof message === "string" ? message : undefined;
};

export const createCodeMapStrategy = (
  name: string,
  codeMap: Record<string, string>,
  options?: {
    normalizeCode?: (code: string) => string;
  },
): ErrorMessageStrategy => {
  const normalize = options?.normalizeCode ?? normalizeCode;

  return {
    name,
    matches(error: unknown): boolean {
      const code = extractErrorCode(error);
      return code ? Object.prototype.hasOwnProperty.call(codeMap, normalize(code)) : false;
    },
    resolve(error: unknown): string | null {
      const code = extractErrorCode(error);
      if (!code) {
        return null;
      }

      const normalizedCode = normalize(code);
      return codeMap[normalizedCode] ?? null;
    },
  };
};

export const createMessageContainsStrategy = (
  name: string,
  patterns: Array<{pattern: string | RegExp; message: string}>,
  options?: {
    messageExtractor?: (error: unknown) => string | undefined;
  },
): ErrorMessageStrategy => {
  const messageExtractor = options?.messageExtractor ?? extractErrorMessage;

  return {
    name,
    matches(error: unknown): boolean {
      const message = messageExtractor(error);
      if (!message) {
        return false;
      }

      return patterns.some(({pattern}) => {
        if (typeof pattern === "string") {
          return message.includes(pattern);
        }

        pattern.lastIndex = 0;
        return pattern.test(message);
      });
    },
    resolve(error: unknown): string | null {
      const message = messageExtractor(error);
      if (!message) {
        return null;
      }

      const matchedPattern = patterns.find(({pattern}) => {
        if (typeof pattern === "string") {
          return message.includes(pattern);
        }

        pattern.lastIndex = 0;
        return pattern.test(message);
      });

      return matchedPattern?.message ?? null;
    },
  };
};

export class ErrorMessageResolver {
  constructor(
    private readonly strategies: ErrorMessageStrategy[],
    private readonly options: ErrorMessageResolverOptions,
  ) {}

  resolve(error: unknown): string {
    for (const strategy of this.strategies) {
      if (!strategy.matches(error)) {
        continue;
      }

      const resolvedMessage = strategy.resolve(error);
      if (resolvedMessage) {
        return resolvedMessage;
      }
    }

    return this.options.fallbackMessage;
  }
}

