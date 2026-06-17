export type NavItem = { id: string; label: string };

export type Stat = { value: string; suffix?: string; label: string };

export type PainPoint = { title: string; description: string; icon: string };

export type Engine = { id: string; title: string; tagline: string; description: string };

export type Persona = { role: string; headline: string; value: string; icon: string };

export type PricingTier = {
  name: string; price: string; period: string; tagline: string; features: string[]; cta: string; highlight?: boolean;
};

export type FAQ = { question: string; answer: string };
