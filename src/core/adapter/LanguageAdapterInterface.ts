import type {
  DebugSessionParams,
  DebugSessionResult,
  EvalContext,
  EvalResult,
  InspectionDescriptor,
  InspectionResult,
  ProfileParams,
  ProfileResult,
} from './types.js';

export interface LanguageAdapterInterface {
  readonly name: string;

  initialize(config: unknown): Promise<void>;
  shutdown(): Promise<void>;

  executeDebugSession(params: DebugSessionParams): Promise<DebugSessionResult>;

  evaluate(expression: string, context: EvalContext): Promise<EvalResult>;

  inspect(what: string, params?: Record<string, unknown>): Promise<InspectionResult>;
  availableInspections(): InspectionDescriptor[];

  profile(params: ProfileParams): Promise<ProfileResult>;
}
