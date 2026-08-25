export type GovernancePenaltyStatus = 'none' | 'warning' | 'suspension' | 'banned';
export type GovernanceIncidentSeverity = 'info' | 'warning' | 'critical';

export interface GovernanceConfig {
  active: boolean;
  warningThreshold: number;
  suspensionThreshold: number;
  banThreshold: number;
  suspensionDays: number;
  requireAudit: boolean;
}

export interface GovernanceIncident {
  id: string;
  employeeId: string;
  employeeName: string;
  reason: string;
  notes?: string;
  severity: GovernanceIncidentSeverity;
  createdBy: string;
  createdAt: string;
  status: GovernancePenaltyStatus;
  penaltyLevel: number;
}

export interface DeliveryEmployeeGovernanceProfile {
  employeeId: string;
  employeeName: string;
  negativeEvents: number;
  penaltyStatus: GovernancePenaltyStatus;
  suspensionUntil?: string;
  lastIncidentAt?: string;
  incidents: GovernanceIncident[];
}

export function normalizeGovernanceConfig(overrides: Partial<GovernanceConfig> = {}): GovernanceConfig {
  return {
    active: true,
    warningThreshold: 1,
    suspensionThreshold: 2,
    banThreshold: 3,
    suspensionDays: 48,
    requireAudit: true,
    ...overrides,
  };
}

export function buildPenaltyStatus(negativeEvents: number, config: GovernanceConfig): GovernancePenaltyStatus {
  if (!config.active) return 'none';
  if (negativeEvents >= config.banThreshold) return 'banned';
  if (negativeEvents >= config.suspensionThreshold) return 'suspension';
  if (negativeEvents >= config.warningThreshold) return 'warning';
  return 'none';
}

export function isGovernanceBlocked(profile: DeliveryEmployeeGovernanceProfile | undefined): boolean {
  return profile?.penaltyStatus === 'suspension' || profile?.penaltyStatus === 'banned';
}

export function applyGovernanceIncident(
  currentProfile: DeliveryEmployeeGovernanceProfile | undefined,
  incident: GovernanceIncident,
  config: GovernanceConfig = normalizeGovernanceConfig(),
): DeliveryEmployeeGovernanceProfile {
  const profile = currentProfile ?? {
    employeeId: incident.employeeId,
    employeeName: incident.employeeName,
    negativeEvents: 0,
    penaltyStatus: 'none',
    incidents: [],
  };

  const nextIncidents = [incident, ...profile.incidents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const negativeEvents = nextIncidents.length;
  // Incidents loaded from persistence can already carry the penalty decision
  // made by the governance workflow. Keep that explicit decision when it is
  // stricter than the status calculated from the number of incidents alone.
  // This also makes a first incident that was manually escalated to suspension
  // or ban enforceable immediately.
  const calculatedStatus = buildPenaltyStatus(negativeEvents, config);
  const penaltyRank: Record<GovernancePenaltyStatus, number> = {
    none: 0,
    warning: 1,
    suspension: 2,
    banned: 3,
  };
  const penaltyStatus = penaltyRank[incident.status] > penaltyRank[calculatedStatus]
    ? incident.status
    : calculatedStatus;
  const suspensionUntil = penaltyStatus === 'suspension' && config.suspensionDays > 0
    ? new Date(Date.now() + config.suspensionDays * 60 * 60 * 1000).toISOString()
    : undefined;

  return {
    ...profile,
    employeeId: incident.employeeId,
    employeeName: incident.employeeName,
    negativeEvents,
    penaltyStatus,
    suspensionUntil: penaltyStatus === 'suspension' ? suspensionUntil : undefined,
    lastIncidentAt: incident.createdAt,
    incidents: nextIncidents,
  };
}
