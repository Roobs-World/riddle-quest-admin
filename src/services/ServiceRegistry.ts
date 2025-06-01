import { IUserDataService } from "./interfaces/IUserDataService";
import { IRiddleDataService } from "./interfaces/IRiddleDataService";
import { IAudioFeedbackService } from "./interfaces/IAudioFeedbackService";
import { UserDataService } from "./UserDataService";
import { RiddleDataService } from "./RiddleDataService";
import { AudioFeedbackManager } from "./AudioFeedbackManager";

/**
 * Service registry for dependency injection
 * Follows the Dependency Inversion Principle by depending on abstractions (interfaces)
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry;

  private services = new Map<string, unknown>();

  private constructor() {
    // Initialize default services
    this.registerDefaults();
  }

  /**
   * Get the singleton instance of the service registry
   */
  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Register default service implementations
   */
  private registerDefaults(): void {
    // Register default implementations
    this.register<IUserDataService>("UserDataService", new UserDataService());
    this.register<IRiddleDataService>(
      "RiddleDataService",
      new RiddleDataService()
    );
    this.register<IAudioFeedbackService>(
      "AudioFeedbackService",
      new AudioFeedbackManager()
    );
  }

  /**
   * Register a service implementation
   */
  register<T>(key: string, service: T): void {
    this.services.set(key, service);
  }

  /**
   * Get a registered service
   */
  get<T>(key: string): T {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service not found: ${key}`);
    }
    return service as T;
  }

  /**
   * Check if a service is registered
   */
  has(key: string): boolean {
    return this.services.has(key);
  }

  /**
   * Clear all registered services (useful for testing)
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Reset to default services
   */
  reset(): void {
    this.clear();
    this.registerDefaults();
  }

  /**
   * Get user data service
   */
  getUserDataService(): IUserDataService {
    return this.get<IUserDataService>("UserDataService");
  }

  /**
   * Get riddle data service
   */
  getRiddleDataService(): IRiddleDataService {
    return this.get<IRiddleDataService>("RiddleDataService");
  }

  /**
   * Get audio feedback service
   */
  getAudioFeedbackService(): IAudioFeedbackService {
    return this.get<IAudioFeedbackService>("AudioFeedbackService");
  }
}

// Export a singleton instance for convenience
export const serviceRegistry = ServiceRegistry.getInstance();
