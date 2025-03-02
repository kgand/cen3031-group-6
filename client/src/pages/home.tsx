import LandingBento from "../components/landing-bento";
import LandingMac from "../components/landing-mac";
import Footer from "../components/footer";
import LandingSecurity from "../components/landing-security";
import Hero from "../components/hero";

export default function home() {
  return (
    <div>
      <div className="bg-primary-700 absolute top-24 h-px w-full" />
      <div className="fixed inset-0 p-1">
        <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl justify-between">
          <div className="bg-primary-700 w-px" />
          <div className="bg-primary-700 w-px" />
        </div>
      </div>

      <Hero/>
      <div className="h-px w-full bg-primary-700 mt-28"></div>
      <LandingBento />
      <LandingMac/>
      <LandingSecurity/>
      <Footer/>

    </div>
  );
}
