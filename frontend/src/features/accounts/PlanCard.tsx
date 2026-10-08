import type { ReactNode } from 'react';
import { moveSurface, resetSurface } from '../../components/surface-motion.js';

export function PlanCard({ children, pro = false }: { children: ReactNode; pro?: boolean }) {
  return (
    <section
      className={`pricing-card${pro ? ' pricing-card-pro' : ''}`}
      onPointerMove={moveSurface}
      onPointerLeave={resetSurface}
    >
      <div className="pricing-card-content">{children}</div>
    </section>
  );
}
