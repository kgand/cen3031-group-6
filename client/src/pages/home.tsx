import LandingBento from "../components/landing-bento";
import LandingMac from "../components/landing-mac";
import Footer from "../components/footer";
import LandingSecurity from "../components/landing-security";
import LandingHero from "../components/LandingHero";

export default function home() {
  return (
    <>
      <div className="bg-primary-700 absolute top-24 hidden h-px w-full md:block" />
      <div className="fixed inset-0 p-1">
        <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl justify-between">
          <div className="bg-primary-700 w-px" />
          <div className="bg-primary-700 w-px" />
        </div>
      </div>

      <div className="relative">
        <LandingHero />
        <div className="bg-primary-700 mt-28 h-px w-full"/>
        <LandingBento />
        <LandingMac />
        <LandingSecurity />
        <Footer />
      </div>
    </>
  );
}
