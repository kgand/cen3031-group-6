import { FaPlay } from "react-icons/fa";
import { MacbookScroll } from "./ui/macbook-scroll";
import FadeUp from "./motion/FadeUp";
import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <FadeUp>
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
          <Link to={"/login"} className="bg-primary-100 text-primary-900 cursor-pointer rounded-md px-10 py-2 cta">
            Get Started
          </Link>

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
    </FadeUp>
  );
}
