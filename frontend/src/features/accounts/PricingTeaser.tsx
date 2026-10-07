import { ArrowUpRight, Sparkles } from 'lucide-react';
import './pricing.css';

export function PricingTeaser({ onPricing }: { onPricing: () => void }) {
  return (
    <section className="pricing-teaser">
      <div
        className="teaser-orbit"
        aria-hidden="true"
      >
        <Sparkles size={24} />
      </div>
      <div>
        <span className="plan-eyebrow">A little more possibility</span>
        <h2>Your next chapter deserves a clear plan.</h2>
        <p>Start free. Explore Pro, and find a rhythm that works for you.</p>
      </div>
      <button
        className="primary-button"
        onClick={onPricing}
      >
        Explore the plans <ArrowUpRight size={17} />
      </button>
    </section>
  );
}
