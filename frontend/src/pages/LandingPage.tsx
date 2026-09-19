import LandingHeader from '../components/landing/LandingHeader';
import AnnouncementBar from '../components/landing/AnnouncementBar';
import HeroSection from '../components/landing/HeroSection';
import StatsStrip from '../components/landing/StatsStrip';
import PillarsSection from '../components/landing/PillarsSection';
import PracticeArena from '../components/landing/PracticeArena';
import HowItWorks from '../components/landing/HowItWorks';
import FinalCta from '../components/landing/FinalCta';

export default function LandingPage() {
  return (
    <div className="bg-surface text-on-surface antialiased">
      <LandingHeader />
      <main className="w-full pt-16">
        <AnnouncementBar />
        <HeroSection />
        <StatsStrip />
        <PillarsSection />
        <PracticeArena />
        <HowItWorks />
        <FinalCta />
      </main>
    </div>
  );
}
