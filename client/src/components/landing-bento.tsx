export default function LandingBento() {
  return (
    <div className="border-primary-700 border-b py-28">
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <h3 className="text-center text-3xl sm:text-4xl text-balance font-medium tracking-tight">
          Why choose FaciliGator for learning
        </h3>
        <p className="text-primary-300 pt-4 text-center">
          FaciliGator is a smart content aggregator that analyzes video lectures{" "}
          <br className="hidden md:block" />
          and course content to prepare personalized learning materials.{" "}
        </p>
        <div className="grid grid-cols-1 gap-4 pt-20 sm:pt-28 md:grid-cols-12">
          <div className="w-full md:col-span-7">
            <TimeCard />
          </div>
          <div className="w-full md:col-span-5">
            <CoursesCard />
          </div>
          <div className="w-full md:col-span-4">
            <PerformanceCard />
          </div>
          <div className="w-full md:col-span-8">
            <QuizCard />
          </div>
        </div>
      </div>
    </div>
  );
}

const PerformanceCard: React.FC = () => {
  return (
    <div className="bg-primary-800 border-primary-700 flex h-full flex-col items-center rounded-xl border px-6 py-8">
      <div className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-blue-500 sm:h-[168px] sm:w-[168px]">
        <span className="font-mono text-3xl text-[#898989]">100%</span>
      </div>
      <div className="pt-10">
        <p className="text-primary-200 text-center text-xl">
          Improve your <br className="hidden md:block" />
          academic performance
        </p>
        <p className="text-primary-300 pt-4">
          Lorem ipsum dolor sit amet, consectetur adipisicing elit. Nulla, quas
          magni? Illo,
        </p>
      </div>
    </div>
  );
};

const CoursesCard: React.FC = () => {
  return (
    <div className="bg-primary-800 border-primary-700 flex h-full flex-col rounded-xl border px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex w-full flex-col gap-2.5 font-light text-[#898989]">
        <div className="bg-primary-700 border-primary-600 flex w-full items-center gap-4 rounded-lg border p-2 overflow-hidden">
          <span className="h-10 min-w-1.5 rounded-sm bg-blue-500" />
          <span className="text-sm whitespace-nowrap overflow-ellipsis overflow-hidden">
            CEN3031 - Intro to Software Engineering
          </span>
        </div>
        <div className="bg-primary-700 border-primary-600 flex w-full items-center gap-4 rounded-lg border p-2 overflow-hidden">
          <span className="h-10 min-w-1.5 rounded-sm bg-blue-500" />
          <span className="text-sm whitespace-nowrap overflow-ellipsis overflow-hidden">
            COP3530 - Data Structures and Algorithms
          </span>
        </div>
        <div className="faded-card relative rounded-lg p-px">
          <div className="bg-primary-700 flex w-full items-center gap-4 rounded-lg p-2 overflow-hidden">
            <span className="h-10 min-w-1.5 rounded-sm bg-blue-500" />
            <span className="text-sm whitespace-nowrap overflow-ellipsis overflow-hidden">CDA3101 - Computer Organization</span>
            <div className="cover absolute" />
          </div>
        </div>
      </div>
      <div className="pt-14">
        <p className="text-primary-200 text-xl">
          Study for every class in one place
        </p>
        <p className="text-primary-300 pt-4">
          Lorem ipsum dolor sit amet, consectetur adipisicing elit. Nulla, quas
          magni? Illo, rerum! Totam molestias.
        </p>
      </div>
    </div>
  );
};

const QuizCard: React.FC = () => {
  return (
    <div className="bg-primary-800 border-primary-700 h-full rounded-xl border px-4 py-6 sm:px-6 sm:py-8">
      <div className="font-light text-[#898989]">
        <p className="text-lg">
          What data structure is best represented by the figure below?
        </p>
        <div className="flex justify-center md:justify-start">
          <img
            src="/images/landing/linked-list.svg"
            alt=""
            className="max-w-56 pt-6 sm:max-w-80"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 pt-8 text-sm">
          <div className="bg-primary-700 border-primary-600 rounded-sm border px-4 py-1.5">
            Graph
          </div>
          <div className="bg-primary-700 border-primary-600 rounded-sm border px-4 py-1.5">
            Linked List
          </div>
          <div className="bg-primary-700 border-primary-600 rounded-sm border px-4 py-1.5">
            Tree
          </div>
          <div className="bg-primary-700 border-primary-600 rounded-sm border px-4 py-1.5">
            Array
          </div>
        </div>
      </div>
      <div className="pt-10">
        <p className="text-primary-200 text-xl">
          Dynamic learning based on your classes' content.
        </p>
        <p className="text-primary-300 pt-4">
          Lorem ipsum dolor sit amet, consectetur adipisicing elit. Nulla, quas
          magni? Illo, rerum! Totam molestias error quae, facere veritatis
          expedita iusto amet cum.
        </p>
      </div>
    </div>
  );
};

const TimeCard: React.FC = () => {
  return (
    <div className="bg-primary-800 border-primary-700 h-full rounded-xl border px-4 py-6 sm:px-6 sm:py-8">
      <div className="faded-card relative h-[220px] rounded-lg p-px">
        <span className="cover" />
        <div className="bg-primary-700 flex h-full flex-col gap-4 overflow-hidden rounded-lg px-4 py-6 text-xs font-light sm:gap-3 sm:p-6 sm:text-sm">
          <p className="text-primary-300 whitespace-nowrap">
            Verifying user credentials... (3.2s)
          </p>
          <p className="text-primary-300 whitespace-nowrap">
            Downloading lectures for CEN3031 (2.4s)
          </p>
          <p className="text-primary-300 whitespace-nowrap">
            Analyzing course content (CEN3031) (4.3s)
          </p>
          <p className="text-primary-300 whitespace-nowrap">
            Creating quizzes based on course content (3.1s)
          </p>
          <p className="text-primary-300 whitespace-nowrap">
            Sending data to user... (1.7s)
          </p>
        </div>
      </div>
      <div className="pt-4 sm:pt-8">
        <p className="text-primary-200 text-xl">
          Save hundreds of hours spent in lectures
        </p>
        <p className="text-primary-300 pt-4">
          Lorem ipsum dolor sit amet, consectetur adipisicing elit. Nulla, quas
          magni? Illo, rerum! Totam molestias error quae.
        </p>
      </div>
    </div>
  );
};
