import type { LanguageAdapterInterface } from './LanguageAdapterInterface.js';

export class AdapterRegistry {
  private adapters = new Map<string, LanguageAdapterInterface>();

  register(adapter: LanguageAdapterInterface): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): LanguageAdapterInterface {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(
        `Adapter "${name}" not found. Available: ${[...this.adapters.keys()].join(', ')}`,
      );
    }
    return adapter;
  }

  has(name: string): boolean {
    return this.adapters.has(name);
  }

  list(): string[] {
    return [...this.adapters.keys()];
  }
}
