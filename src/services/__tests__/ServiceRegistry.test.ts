import {ServiceRegistry, serviceRegistry} from "../ServiceRegistry";

// Mock the service implementations
jest.mock("../UserDataService", () => ({
  UserDataService: jest.fn().mockImplementation(() => ({
    getUserData: jest.fn(),
    updateUserData: jest.fn(),
  })),
}));

jest.mock("../RiddleDataService", () => ({
  RiddleDataService: jest.fn().mockImplementation(() => ({
    getRiddle: jest.fn(),
    saveRiddle: jest.fn(),
  })),
}));

jest.mock("../AudioFeedbackManager", () => ({
  AudioFeedbackManager: jest.fn().mockImplementation(() => ({
    playSound: jest.fn(),
    vibrate: jest.fn(),
  })),
}));

describe("ServiceRegistry", () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    // Clear any existing instance for clean testing
    (ServiceRegistry as any).instance = undefined;
    registry = ServiceRegistry.getInstance();
  });

  afterEach(() => {
    // Clean up for next test
    registry.clear();
    (ServiceRegistry as any).instance = undefined;
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance on multiple calls", () => {
      const instance1 = ServiceRegistry.getInstance();
      const instance2 = ServiceRegistry.getInstance();
      const instance3 = ServiceRegistry.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(instance1).toBe(instance3);
    });

    it("should create new instance only once", () => {
      const instance1 = ServiceRegistry.getInstance();
      expect(instance1).toBeInstanceOf(ServiceRegistry);

      const instance2 = ServiceRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should export a singleton instance for convenience", () => {
      expect(serviceRegistry).toBeInstanceOf(ServiceRegistry);
      // Note: serviceRegistry was created when module was imported,
      // so it may be different from current test instance
      expect(serviceRegistry).toBeInstanceOf(ServiceRegistry);
    });
  });

  describe("Service Registration", () => {
    it("should register a service", () => {
      const mockService = {test: "service"};
      registry.register("TestService", mockService);

      expect(registry.has("TestService")).toBe(true);
      expect(registry.get("TestService")).toBe(mockService);
    });

    it("should register multiple services", () => {
      const service1 = {name: "service1"};
      const service2 = {name: "service2"};
      const service3 = {name: "service3"};

      registry.register("Service1", service1);
      registry.register("Service2", service2);
      registry.register("Service3", service3);

      expect(registry.has("Service1")).toBe(true);
      expect(registry.has("Service2")).toBe(true);
      expect(registry.has("Service3")).toBe(true);
      expect(registry.get("Service1")).toBe(service1);
      expect(registry.get("Service2")).toBe(service2);
      expect(registry.get("Service3")).toBe(service3);
    });

    it("should overwrite existing service with same key", () => {
      const originalService = {version: "original"};
      const newService = {version: "new"};

      registry.register("TestService", originalService);
      expect(registry.get("TestService")).toBe(originalService);

      registry.register("TestService", newService);
      expect(registry.get("TestService")).toBe(newService);
      expect(registry.get("TestService")).not.toBe(originalService);
    });
  });

  describe("Service Retrieval", () => {
    it("should retrieve registered service", () => {
      const mockService = {getData: jest.fn()};
      registry.register("DataService", mockService);

      const retrieved = registry.get("DataService");
      expect(retrieved).toBe(mockService);
    });

    it("should throw error for non-existent service", () => {
      expect(() => registry.get("NonExistentService")).toThrow("Service not found: NonExistentService");
    });

    it("should handle empty key", () => {
      expect(() => registry.get("")).toThrow("Service not found: ");
    });

    it("should preserve service type through generics", () => {
      interface TestService {
        testMethod(): string;
      }

      const mockService: TestService = {
        testMethod: () => "test result",
      };

      registry.register<TestService>("TypedService", mockService);
      const retrieved = registry.get<TestService>("TypedService");

      expect(retrieved.testMethod()).toBe("test result");
    });
  });

  describe("Service Existence Checking", () => {
    it("should return true for existing services", () => {
      const mockService = {test: true};
      registry.register("ExistingService", mockService);

      expect(registry.has("ExistingService")).toBe(true);
    });

    it("should return false for non-existent services", () => {
      expect(registry.has("NonExistentService")).toBe(false);
      expect(registry.has("")).toBe(false);
      expect(registry.has("undefined")).toBe(false);
    });

    it("should handle multiple checks correctly", () => {
      registry.register("Service1", {name: "one"});
      registry.register("Service2", {name: "two"});

      expect(registry.has("Service1")).toBe(true);
      expect(registry.has("Service2")).toBe(true);
      expect(registry.has("Service3")).toBe(false);
      expect(registry.has("Service4")).toBe(false);
    });
  });

  describe("Service Clearing", () => {
    it("should clear all services", () => {
      registry.register("Service1", {name: "one"});
      registry.register("Service2", {name: "two"});
      registry.register("Service3", {name: "three"});

      expect(registry.has("Service1")).toBe(true);
      expect(registry.has("Service2")).toBe(true);
      expect(registry.has("Service3")).toBe(true);

      registry.clear();

      expect(registry.has("Service1")).toBe(false);
      expect(registry.has("Service2")).toBe(false);
      expect(registry.has("Service3")).toBe(false);
    });

    it("should handle clearing empty registry", () => {
      expect(() => registry.clear()).not.toThrow();
      expect(registry.has("AnyService")).toBe(false);
    });

    it("should allow re-registration after clearing", () => {
      registry.register("TestService", {version: "v1"});
      expect(registry.has("TestService")).toBe(true);

      registry.clear();
      expect(registry.has("TestService")).toBe(false);

      registry.register("TestService", {version: "v2"});
      expect(registry.has("TestService")).toBe(true);
      expect(registry.get("TestService")).toEqual({version: "v2"});
    });
  });

  describe("Default Services Registration", () => {
    it("should register default services on reset", () => {
      registry.reset();

      expect(registry.has("UserDataService")).toBe(true);
      expect(registry.has("RiddleDataService")).toBe(true);
      expect(registry.has("AudioFeedbackService")).toBe(true);
    });

    it("should replace existing services on reset", () => {
      const customService = {custom: true};
      registry.register("UserDataService", customService);
      expect(registry.get("UserDataService")).toBe(customService);

      registry.reset();

      const resetService = registry.get("UserDataService");
      expect(resetService).not.toBe(customService);
      expect(resetService).toBeDefined();
    });

    it("should clear and then register defaults on reset", () => {
      registry.register("CustomService", {test: true});
      expect(registry.has("CustomService")).toBe(true);

      registry.reset();

      expect(registry.has("CustomService")).toBe(false);
      expect(registry.has("UserDataService")).toBe(true);
      expect(registry.has("RiddleDataService")).toBe(true);
      expect(registry.has("AudioFeedbackService")).toBe(true);
    });
  });

  describe("Convenience Getters", () => {
    beforeEach(() => {
      registry.reset(); // Ensure default services are registered
    });

    it("should get UserDataService through convenience method", () => {
      const userService = registry.getUserDataService();
      expect(userService).toBeDefined();
      expect(userService).toBe(registry.get("UserDataService"));
    });

    it("should get RiddleDataService through convenience method", () => {
      const riddleService = registry.getRiddleDataService();
      expect(riddleService).toBeDefined();
      expect(riddleService).toBe(registry.get("RiddleDataService"));
    });

    it("should get AudioFeedbackService through convenience method", () => {
      const audioService = registry.getAudioFeedbackService();
      expect(audioService).toBeDefined();
      expect(audioService).toBe(registry.get("AudioFeedbackService"));
    });

    it("should return same instance on multiple convenience calls", () => {
      const userService1 = registry.getUserDataService();
      const userService2 = registry.getUserDataService();
      expect(userService1).toBe(userService2);

      const riddleService1 = registry.getRiddleDataService();
      const riddleService2 = registry.getRiddleDataService();
      expect(riddleService1).toBe(riddleService2);

      const audioService1 = registry.getAudioFeedbackService();
      const audioService2 = registry.getAudioFeedbackService();
      expect(audioService1).toBe(audioService2);
    });
  });

  describe("Error Handling", () => {
    it("should handle service registration errors gracefully", () => {
      // This should not throw as registration accepts any value
      expect(() => registry.register("NullService", null)).not.toThrow();
      expect(() => registry.register("UndefinedService", undefined)).not.toThrow();

      // Services are registered, so has() should return true
      expect(registry.has("NullService")).toBe(true);
      expect(registry.has("UndefinedService")).toBe(true);

      // Getting falsy services should throw errors (ServiceRegistry design)
      expect(() => registry.get("NullService")).toThrow("Service not found: NullService");
      expect(() => registry.get("UndefinedService")).toThrow("Service not found: UndefinedService");
    });

    it("should handle multiple error scenarios", () => {
      expect(() => registry.get("NonExistent1")).toThrow();
      expect(() => registry.get("NonExistent2")).toThrow();
      expect(() => registry.get("NonExistent3")).toThrow();

      // Registry should still work after errors
      registry.register("ValidService", {valid: true});
      expect(registry.get("ValidService")).toEqual({valid: true});
    });
  });

  describe("Integration Tests", () => {
    it("should work with complex service workflows", () => {
      // Register multiple services
      const userService = {getCurrentUser: jest.fn()};
      const dataService = {fetchData: jest.fn()};
      const logService = {log: jest.fn()};

      registry.register("UserService", userService);
      registry.register("DataService", dataService);
      registry.register("LogService", logService);

      // Verify all services are accessible
      expect(registry.get("UserService")).toBe(userService);
      expect(registry.get("DataService")).toBe(dataService);
      expect(registry.get("LogService")).toBe(logService);

      // Test service interaction
      const user = registry.get("UserService") as any;
      const data = registry.get("DataService") as any;
      const logger = registry.get("LogService") as any;

      expect(user.getCurrentUser).toBeDefined();
      expect(data.fetchData).toBeDefined();
      expect(logger.log).toBeDefined();
    });

    it("should maintain service state across operations", () => {
      const statefulService = {
        counter: 0,
        increment: function () {
          this.counter++;
        },
        getCount: function () {
          return this.counter;
        },
      };

      registry.register("StatefulService", statefulService);

      const service1 = registry.get("StatefulService") as any;
      service1.increment();
      expect(service1.getCount()).toBe(1);

      const service2 = registry.get("StatefulService") as any;
      expect(service2.getCount()).toBe(1); // Should be same instance
      expect(service1).toBe(service2);
    });

    it("should handle service dependencies through registry", () => {
      const loggerService = {log: jest.fn()};
      const userService = {
        logger: null as any,
        login: function (username: string) {
          this.logger?.log(`User ${username} logged in`);
        },
      };

      registry.register("Logger", loggerService);
      registry.register("UserService", userService);

      // Simulate dependency injection
      const user = registry.get("UserService") as any;
      user.logger = registry.get("Logger");

      user.login("testuser");
      expect(loggerService.log).toHaveBeenCalledWith("User testuser logged in");
    });
  });
});
