import type { ReportStatus, UserRole } from './types'

export class IllegalTransitionError extends Error {
  constructor(
    public from: ReportStatus,
    public to: ReportStatus,
    public role: UserRole,
  ) {
    super(`Illegal transition ${from} → ${to} for role ${role}`)
    this.name = 'IllegalTransitionError'
  }
}

type Edge = { to: ReportStatus; roles: UserRole[] }

const T: Record<ReportStatus, Edge[]> = {
  submitted: [
    { to: 'validated', roles: ['dispatcher', 'admin', 'worker'] },
    { to: 'needs_review', roles: ['dispatcher', 'admin', 'analyst'] },
    { to: 'rejected_duplicate', roles: ['dispatcher', 'admin'] },
  ],
  validated: [
    { to: 'pending_assignment', roles: ['dispatcher', 'admin'] },
    { to: 'needs_review', roles: ['dispatcher', 'admin'] },
    { to: 'rejected_duplicate', roles: ['dispatcher', 'admin'] },
  ],
  pending_assignment: [
    { to: 'assigned', roles: ['dispatcher', 'admin'] },
    { to: 'rejected_duplicate', roles: ['dispatcher', 'admin'] },
  ],
  assigned: [
    { to: 'in_progress', roles: ['worker', 'dispatcher', 'admin'] },
    { to: 'pending_assignment', roles: ['dispatcher', 'admin'] },
  ],
  in_progress: [
    { to: 'completed', roles: ['worker', 'dispatcher', 'admin'] },
    { to: 'partially_completed', roles: ['worker', 'dispatcher', 'admin'] },
    { to: 'inaccessible', roles: ['worker', 'dispatcher', 'admin'] },
    { to: 'needs_review', roles: ['worker', 'dispatcher', 'admin'] },
  ],
  completed: [{ to: 'reopened', roles: ['resident', 'dispatcher', 'admin'] }],
  needs_review: [
    { to: 'validated', roles: ['dispatcher', 'admin'] },
    { to: 'rejected_duplicate', roles: ['dispatcher', 'admin'] },
    { to: 'pending_assignment', roles: ['dispatcher', 'admin'] },
  ],
  partially_completed: [
    { to: 'pending_assignment', roles: ['dispatcher', 'admin'] },
    { to: 'assigned', roles: ['dispatcher', 'admin'] },
    { to: 'completed', roles: ['dispatcher', 'admin'] },
  ],
  inaccessible: [
    { to: 'pending_assignment', roles: ['dispatcher', 'admin'] },
    { to: 'assigned', roles: ['dispatcher', 'admin'] },
  ],
  rejected_duplicate: [],
  reopened: [
    { to: 'pending_assignment', roles: ['dispatcher', 'admin'] },
    { to: 'validated', roles: ['dispatcher', 'admin'] },
  ],
}

export function allowedTransitions(from: ReportStatus, role: UserRole): ReportStatus[] {
  return (T[from] ?? []).filter((e) => e.roles.includes(role)).map((e) => e.to)
}

export function canTransition(from: ReportStatus, to: ReportStatus, role: UserRole): boolean {
  return allowedTransitions(from, role).includes(to)
}

export function assertTransition(from: ReportStatus, to: ReportStatus, role: UserRole) {
  if (!canTransition(from, to, role)) throw new IllegalTransitionError(from, to, role)
}

export function canApproveRoutes(role: UserRole) {
  return role === 'dispatcher' || role === 'admin'
}

export function canMergeDuplicates(role: UserRole) {
  return role === 'dispatcher' || role === 'admin'
}
