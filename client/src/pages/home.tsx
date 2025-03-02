import { FaPlay } from "react-icons/fa";
import { MacbookScroll } from "../components/ui/macbook-scroll";
import LandingBento from "../components/landing-bento";
import LandingMac from "../components/landing-mac";
import Footer from "../components/footer";
import LandingSecurity from "../components/landing-security";

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

      <div className="relative z-10 mx-auto mt-44 max-w-6xl flex-col items-center justify-center px-10 text-center">
        <p className="text-primary-200">
          Study smarter, not harder with FaciliGator
        </p>
        <h1 className="pt-4 text-[48px] leading-[1.08] font-bold tracking-tight">
          Your <span className="text-blue-500">AI companion </span>that <br />
          goes to class for you.
        </h1>
        <h2 className="text-primary-200 pt-8 text-lg leading-normal">
          FaciliGator is a smart content aggregator that analyzes video lectures{" "}
          <br />
          and course content to prepare personalized learning materials.{" "}
        </h2>
        <div className="flex justify-center gap-4 pt-8">
          <button className="bg-primary-100 text-primary-900 cursor-pointer rounded-md px-10 py-2">
            Get Started
          </button>

          <a className="hover:bg-primary-700 hover-bg-opacity-50 flex cursor-pointer items-center gap-4 rounded-md px-10 py-2 transition-all">
            Learn More{" "}
            <span className="text-sm">
              <FaPlay />
            </span>
          </a>
        </div>

        <MacbookScroll src="/images/landing/pc.png" showGradient={true} />
        <h3 className="text-center text-4xl font-medium tracking-tight">
        Canvas LMS and Lecture Integration
        </h3>
        <p className="text-primary-300 pt-4 text-center">
          FaciliGator is a smart content aggregator that analyzes video lectures{" "}
          <br />
          and course content to prepare personalized learning materials.{" "}
        </p>
      </div>
      <div className="h-px w-full bg-primary-700 mt-28"></div>
      <LandingBento />
      <LandingMac/>
      <LandingSecurity/>
      <Footer/>

    </div>
  );
}
