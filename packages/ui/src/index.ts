/**
 * @maralito/ui — PLACEHOLDER (Phase 0). Base UI kit; BorderPass themes Stitch tokens over this.
 * TODO(phase2): real component library (Button, Input, Card, Modal, Sheet, Toast, Skeleton …).
 */
export const tokens = {
  color: { primary: '#a33e06', secondary: '#565e74', success: '#1b6b51', surface: '#fff8f6' },
  radius: { card: '1.5rem' },
} as const;

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';
export interface ButtonProps {
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}
// Component implementations arrive in Phase 2.
