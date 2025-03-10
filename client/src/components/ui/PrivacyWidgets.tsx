import { useState } from "react";
import { FaCheck } from "react-icons/fa";

export function PrivacyWidget1() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-md p-4">
      <div className="absolute inset-4 overflow-hidden z-0 p-4 leading-tight text-primary-300">
        Lorem ipsum dolor sit amet consectetur, adipisicing elit. Dolorem
        architecto repudiandae voluptates quo at maiores alias quia velit modi,
        perspiciatis soluta illo, voluptate labore sit unde nemo nam esse
        tenetur voluptatem nobis ipsa corrupti neque consectetur illum. Nisi
        sint quibusdam rem, temporibus labore, velit numquam officiis maxime
        dolores beatae cum vero facilis libero provident perferendis hic nobis.
        Natus blanditiis, cum dicta debitis corrupti quam magnam fugit quidem
        saepe molestiae. Commodi cumque provident aut ipsa libero doloribus est
        porro quae! Quam, iure. Ex commodi iste, est ea doloremque neque officia
        ipsam maiores perferendis culpa, quasi, nisi odit adipisci ab.
        Accusantium quidem ab porro. Illum nam et placeat minus reiciendis.
        Obcaecati, totam maxime sint beatae aut sapiente nulla nobis voluptate
        pariatur, rem vero quas ut ipsum unde impedit aspernatur voluptates
        repellat delectus alias, officia eligendi voluptas sit dolorem! Quia
        dolorum, error, ratione nostrum quam distinctio id eius sequi tenetur
        maxime eos accusamus!
      </div>
      <div className="bd-blur relative z-10 flex h-full w-full items-center justify-center bg-[rgba(40,40,40,0.9)] border border-primary-700 rounded-md">
        <div className="pulsing-box bg-primary-800 border-primary-700 relative z-10 flex h-40 w-40 items-center justify-center rounded-full border">
          <svg
            width="40"
            height="51"
            viewBox="0 0 40 51"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M30.8 21.8846V12.8462C30.8 9.96957 29.6621 7.21081 27.6368 5.17676C25.6114 3.14272 22.8643 2 20 2C17.1357 2 14.3886 3.14272 12.3632 5.17676C10.3379 7.21081 9.2 9.96957 9.2 12.8462V21.8846M7.4 49H32.6C34.0322 49 35.4057 48.4286 36.4184 47.4116C37.4311 46.3946 38 45.0152 38 43.5769V27.3077C38 25.8694 37.4311 24.49 36.4184 23.473C35.4057 22.456 34.0322 21.8846 32.6 21.8846H7.4C5.96783 21.8846 4.59432 22.456 3.58162 23.473C2.56893 24.49 2 25.8694 2 27.3077V43.5769C2 45.0152 2.56893 46.3946 3.58162 47.4116C4.59432 48.4286 5.96783 49 7.4 49Z"
              stroke="#898989"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function PrivacyWidget2() {
  return (
    <div className="grid h-full w-full gap-2 p-3 sm:p-4">
      <Assignment
        name={"Module 1 Study Guide - Trees"}
        isInitiallySelected={true}
      />
      <Assignment
        name={"Programming Assignment 1 - Binary Search Tree"}
        isInitiallySelected={false}
      />
      <Assignment name={"Lab 1 - Red Black Trees"} isInitiallySelected={true} />
      <Assignment
        name={"Lecture #3 - Balanced Trees"}
        isInitiallySelected={false}
      />
    </div>
  );
}

type AssignmentProps = {
  name: string;
  isInitiallySelected: boolean;
};

const Assignment: React.FC<AssignmentProps> = ({
  name,
  isInitiallySelected,
}) => {
  const [isSelected, setIsSelected] = useState<boolean>(isInitiallySelected);
  return (
    <div
      className="hover:text-primary-300 hover:bg-primary-600 text-primary-400 bg-primary-700 border-primary-600 flex h-full w-full cursor-pointer items-center justify-between overflow-hidden rounded-md border px-4 py-1.5 transition-all"
      onClick={() => setIsSelected((prev) => !prev)}
    >
      <p className="flex max-w-[85%] overflow-hidden text-sm text-ellipsis whitespace-nowrap sm:text-base">
        {name}
      </p>
      <div
        className={`border-primary-400 flex h-7 w-7 min-w-7 items-center justify-center rounded-full border ${isSelected ? "bg-primary-500" : ""}`}
      >
        <span
          className={`text-primary-300 text-xs transition-all ${isSelected ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}
        >
          <FaCheck />
        </span>
      </div>
    </div>
  );
};
