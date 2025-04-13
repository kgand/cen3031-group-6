import LandingBento from "../components/LandingBento";
import LandingMac from "../components/LandingMac";
import LandingSecurity from "../components/LandingSecurity";
import LandingHero from "../components/LandingHero";
import Footer from "../components/Footer";
import Gridlines from "../components/ui/Gridlines";

export default function Home() {
  return (
    <>
    <Gridlines/>
      <div className="relative">
        <LandingHero />
        <div className="bg-primary-700 mt-28 h-px w-full" />
        <LandingBento />
        <LandingMac />
        <LandingSecurity />
        <Footer />
      </div>
    </>
  );
}
