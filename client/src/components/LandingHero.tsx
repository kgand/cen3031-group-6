import { FaPlay } from "react-icons/fa";
import { MacbookScroll } from "./ui/macbook-scroll";
import FadeUp from "./motion/FadeUp";
import { Link } from "react-router-dom";

export default function LandingHero() {
  return (
    <FadeUp>
      <div className="relative z-10 mx-auto mt-36 md:mt-44 max-w-6xl flex-col items-center justify-center px-6 sm:px-8 sm:text-center">
        <p className="text-primary-200 text-balance">
          Study smarter, not harder with FaciliGator
        </p>
        <h1 className="pt-4 text-4xl sm:text-5xl leading-[1.08] font-bold tracking-tight text-balance">
          Your <span className="text-blue-500">AI companion </span>that <br className="hidden md:inline"/>
          goes to class for you.
        </h1>
        <h2 className="text-primary-200 pt-6 sm:pt-8 sm:text-lg leading-normal ">
          FaciliGator is a smart content aggregator that analyzes video lectures{" "}
          <br className="hidden md:inline"/>
          and course content to prepare personalized learning materials.{" "}
        </h2>
        <div className="flex flex-wrap justify-center gap-4 pt-8">
          <Link to={"/login"} className="bg-primary-100 text-primary-900 cursor-pointer rounded-md w-full text-center sm:w-auto px-10 pt-[11px] pb-2 cta">
            Get Started
          </Link>

          <a className="hover:bg-primary-700 hover-bg-opacity-50 flex cursor-pointer items-center gap-3 rounded-md px-10 pt-[11px] pb-2 transition-all">
            Learn More{" "}
            <span className="text-sm pb-px">
              <FaPlay />
            </span>
          </a>
        </div>

        <MacbookScroll src="/images/landing/pc.png" />
        <h3 className="text-center text-3xl sm:text-4xl font-medium tracking-tight text-balance">
          Canvas LMS and Lecture Integration
        </h3>
        <p className="text-primary-300 pt-4 text-center">
          FaciliGator is a smart content aggregator that analyzes video lectures{" "}
          <br className="hidden md:inline"/>
          and course content to prepare personalized learning materials.{" "}
        </p>
      </div>
    </FadeUp>
  );
}
