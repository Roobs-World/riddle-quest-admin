import type {Page, Request, Route} from "@playwright/test";
import {isProtectedPayload, parsePayloadEnvelope, protectPayload, readProtectedPayload} from "../../../../../src/platform/transport/payloadProtection";

/** Keep fixtures readable while exercising the artifact's real protected HTTP transport. */
export function withProtectedFacebookFixtures(page: Page): Page {
  const handlers = new WeakMap<Function, (route: Route, request: Request) => Promise<void>>();
  const fixtureRequests = new WeakMap<Request, Request>();
  const wrap = (handler: (route: Route, request: Request) => unknown) => {
    const existing = handlers.get(handler);
    if (existing) return existing;
    const wrapped = async (route: Route, request: Request) => {
      const body = request.postData();
      let input: unknown;
      try {input = body ? JSON.parse(body) : null;} catch {input = null;}
      const callable = !isProtectedPayload(input) && typeof input === "object" && input !== null && "data" in input;
      const envelope = callable ? (input as {data: unknown}).data : input;
      if (!isProtectedPayload(envelope)) {
        if (request.method() === "POST" && new URL(request.url()).hostname.endsWith(".cloudfunctions.net"))
          throw new Error("The Facebook artifact sent an unprotected Functions request.");
        await handler(route, request); return;
      }
      const operation = new URL(request.url()).pathname.split("/").at(-1)!;
      const context = {operation, requestId: parsePayloadEnvelope(envelope).requestId};
      const decoded = await readProtectedPayload(envelope, {...context, direction: "request"});
      const fixtureInput = callable ? {data: decoded} : decoded;
      const fixtureRequest = new Proxy(request, {
        get(target, property) {
          if (property === "postData") return () => JSON.stringify(fixtureInput);
          if (property === "postDataJSON") return () => fixtureInput;
          const value = Reflect.get(target, property);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      fixtureRequests.set(request, fixtureRequest);
      const fixtureRoute = new Proxy(route, {
        get(target, property) {
          if (property === "request") return () => fixtureRequest;
          if (property === "fulfill") return async (options: Parameters<Route["fulfill"]>[0]) => {
            if (!options.body || typeof options.body !== "string") return target.fulfill(options);
            const response = JSON.parse(options.body);
            if (callable && response.error) return target.fulfill(options);
            const protectedResponse = await protectPayload(callable ? response.data : response,
              {...context, direction: "response"});
            return target.fulfill({...options, body: JSON.stringify(callable ? {data: protectedResponse} : protectedResponse)});
          };
          const value = Reflect.get(target, property);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      await handler(fixtureRoute, fixtureRequest);
    };
    handlers.set(handler, wrapped);
    return wrapped;
  };
  return new Proxy(page, {
    get(target, property) {
      if (property === "route") return (url: Parameters<Page["route"]>[0], handler: Parameters<Page["route"]>[1], options?: Parameters<Page["route"]>[2]) =>
        target.route(url, wrap(handler), options);
      if (property === "unroute") return (url: Parameters<Page["unroute"]>[0], handler?: Parameters<Page["unroute"]>[1]) =>
        target.unroute(url, handler ? handlers.get(handler) ?? handler : undefined);
      if (property === "waitForRequest") return (predicate: Parameters<Page["waitForRequest"]>[0], options?: Parameters<Page["waitForRequest"]>[1]) => {
        if (typeof predicate !== "function") return target.waitForRequest(predicate, options);
        return target.waitForRequest(async request => {
          let raw: unknown;
          try {raw = request.postDataJSON();} catch {return predicate(request);}
          const callable = !isProtectedPayload(raw) && typeof raw === "object" && raw !== null && "data" in raw;
          const envelope = callable ? (raw as {data: unknown}).data : raw;
          if (!isProtectedPayload(envelope)) return predicate(request);
          const decoded = await readProtectedPayload(envelope, {operation: new URL(request.url()).pathname.split("/").at(-1)!,
            requestId: parsePayloadEnvelope(envelope).requestId, direction: "request"});
          const input = callable ? {data: decoded} : decoded;
          return predicate(new Proxy(request, {get(target, property) {
            if (property === "postDataJSON") return () => input;
            if (property === "postData") return () => JSON.stringify(input);
            const value = Reflect.get(target, property);
            return typeof value === "function" ? value.bind(target) : value;
          }}));
        }, options);
      };
      if (property === "waitForResponse") return (predicate: Parameters<Page["waitForResponse"]>[0], options?: Parameters<Page["waitForResponse"]>[1]) => {
        if (typeof predicate !== "function") return target.waitForResponse(predicate, options);
        return target.waitForResponse(response => predicate(new Proxy(response, {get(target, property) {
          if (property === "request") return () => fixtureRequests.get(target.request()) ?? target.request();
          const value = Reflect.get(target, property);
          return typeof value === "function" ? value.bind(target) : value;
        }})), options);
      };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
