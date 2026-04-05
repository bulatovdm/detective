import { resolve, relative, isAbsolute } from 'node:path';

export class PathMapper {
  private readonly mappings: Array<{ containerPrefix: string; hostPrefix: string }>;
  private readonly projectRoot: string;

  constructor(pathMapping: Record<string, string>, projectRoot: string) {
    this.projectRoot = projectRoot;

    this.mappings = Object.entries(pathMapping)
      .map(([containerPrefix, hostPrefix]) => ({
        containerPrefix: this.normalizePath(containerPrefix),
        hostPrefix: this.resolveHostPath(hostPrefix),
      }))
      .sort((a, b) => b.containerPrefix.length - a.containerPrefix.length);
  }

  get isIdentity(): boolean {
    return this.mappings.length === 0;
  }

  toDebugger(hostRelativeOrAbsolute: string): string {
    const absoluteHost = this.toAbsoluteHost(hostRelativeOrAbsolute);

    for (const { containerPrefix, hostPrefix } of this.mappings) {
      if (absoluteHost.startsWith(hostPrefix)) {
        return containerPrefix + absoluteHost.slice(hostPrefix.length);
      }
    }

    return absoluteHost;
  }

  toHost(debuggerPath: string): string {
    const normalized = this.normalizePath(debuggerPath);

    for (const { containerPrefix, hostPrefix } of this.mappings) {
      if (normalized.startsWith(containerPrefix)) {
        return hostPrefix + normalized.slice(containerPrefix.length);
      }
    }

    return normalized;
  }

  toRelative(absoluteHostPath: string): string {
    return relative(this.projectRoot, absoluteHostPath);
  }

  private toAbsoluteHost(path: string): string {
    if (isAbsolute(path)) return path;
    return resolve(this.projectRoot, path);
  }

  private resolveHostPath(hostPath: string): string {
    if (isAbsolute(hostPath)) return hostPath;
    return resolve(this.projectRoot, hostPath);
  }

  private normalizePath(p: string): string {
    return p.endsWith('/') ? p.slice(0, -1) : p;
  }
}
