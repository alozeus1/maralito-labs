/**
 * @maralito/sdk — PLACEHOLDER boundary (Phase 0/1). BorderPass consumes platform services
 * through this typed interface and NEVER calls providers directly. Real surface confirmed
 * with the platform team before it replaces the BorderPass-local foundation (ADR-0005).
 */
export interface MaralitoContext {
  orgId: string;
  appId: 'borderpass';
  principal: { type: 'customer' | 'staff' | 'admin' | 'agent' | 'system'; id: string };
}

// Refined Phase-1 shapes (what the app actually needs) — interfaces only, no impl.
export interface IdentityService {
  getOrgForUser(authUserId: string): Promise<{ orgId: string } | null>;
  getRolesForUser(authUserId: string): Promise<string[]>;
}
export interface AuditService {
  write(entry: {
    action: string;
    actorUserId?: string;
    actorRole?: string;
    entityType?: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}
export interface PaymentsService {
  readonly _placeholder: true;
}
export interface NotificationsService {
  readonly _placeholder: true;
}
export interface FilesService {
  readonly _placeholder: true;
}
export interface AiGatewayService {
  readonly _placeholder: true;
}
export interface AutomationService {
  readonly _placeholder: true;
}

export interface MaralitoSdk {
  identity: IdentityService;
  audit: AuditService;
  payments: PaymentsService;
  notifications: NotificationsService;
  files: FilesService;
  ai: AiGatewayService;
  automation: AutomationService;
}

export function createMaralitoSdk(_ctx: MaralitoContext): MaralitoSdk {
  throw new Error(
    'TODO(pre-phase1-confirm): @maralito/sdk not implemented; BorderPass-local foundation in use (ADR-0005).',
  );
}
