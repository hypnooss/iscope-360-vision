import { Header } from '../components/Header';
import { HeroSection } from '../components/HeroSection';
import { ProblemSection } from '../components/ProblemSection';
import { FeaturesSection } from '../components/FeaturesSection';
import { MonitoringSection } from '../components/MonitoringSection';
import { HowItWorksSection } from '../components/HowItWorksSection';
import { ScoreSection } from '../components/ScoreSection';
import { DemoSection } from '../components/DemoSection';
import { PricingSection } from '../components/PricingSection';
import { FaqSection } from '../components/FaqSection';
import { CtaSection } from '../components/CtaSection';
import { Footer } from '../components/Footer';

export default function Index() {
  return (
    <div className="min-h-screen bg-surface text-text">
      <Header />
      <main>
        <HeroSection />
        <ProblemSection />
        <FeaturesSection />
        <MonitoringSection />
        <HowItWorksSection />
        <ScoreSection />
        <DemoSection />
        <PricingSection />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
