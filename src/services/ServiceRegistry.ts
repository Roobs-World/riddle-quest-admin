import type {IUserDataService} from "./ports/IUserDataService";
import type {IRiddleDataService} from "./ports/IRiddleDataService";
import type {IAudioFeedbackService} from "./ports/IAudioFeedbackService";
import type {IGameCompletionPort} from "./ports/IGameCompletionPort";
import {SERVICE_KEYS, type ServiceKey} from "./ports/serviceKeys";
import {UserDataService} from "./UserDataService";
import {RiddleDataService} from "./RiddleDataService";
import {AudioFeedbackManager} from "./AudioFeedbackManager";

export {SERVICE_KEYS, type ServiceKey};

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
    this.register<IUserDataService>(SERVICE_KEYS.userData, new UserDataService());
    this.register<IRiddleDataService>(SERVICE_KEYS.riddleData, new RiddleDataService());
    this.register<IAudioFeedbackService>(SERVICE_KEYS.audioFeedback, new AudioFeedbackManager());
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

  getUserDataService(): IUserDataService {
    return this.get<IUserDataService>(SERVICE_KEYS.userData);
  }

  getRiddleDataService(): IRiddleDataService {
    return this.get<IRiddleDataService>(SERVICE_KEYS.riddleData);
  }

  getAudioFeedbackService(): IAudioFeedbackService {
    return this.get<IAudioFeedbackService>(SERVICE_KEYS.audioFeedback);
  }

  /**
   * Optional port — register a Firebase adapter before use (PR 4+).
   */
  getGameCompletionPort(): IGameCompletionPort {
    return this.get<IGameCompletionPort>(SERVICE_KEYS.gameCompletion);
  }

  hasGameCompletionPort(): boolean {
    return this.has(SERVICE_KEYS.gameCompletion);
  }

  registerGameCompletionPort(port: IGameCompletionPort): void {
    this.register<IGameCompletionPort>(SERVICE_KEYS.gameCompletion, port);
  }
}

// Export a singleton instance for convenience
export const serviceRegistry = ServiceRegistry.getInstance();
