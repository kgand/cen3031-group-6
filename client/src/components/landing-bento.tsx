export default function LandingBento() {
  return (
    <div className="border-primary-700 border-b py-28">
      <div className="mx-auto max-w-6xl px-8">
        <h3 className="text-center text-4xl font-medium tracking-tight">
          Why choose FaciliGator for learning
        </h3>
        <p className="text-primary-300 pt-4 text-center">
          FaciliGator is a smart content aggregator that analyzes video lectures{" "}
          <br />
          and course content to prepare personalized learning materials.{" "}
        </p>
        <div className="grid grid-cols-12 gap-4 pt-20">
          <TimeCard />
          <CoursesCard />
          <PerformanceCard />
          <QuizCard />
        </div>
      </div>
    </div>
  );
}

const PerformanceCard: React.FC = () => {
  return (
    <div className="bg-primary-800 border-primary-700 col-span-4 flex flex-col items-center rounded-xl border px-6 py-8">
      <div className="flex h-[180px] w-[180px] items-center justify-center rounded-full border-4 border-blue-500">
        <span className="text-primary-200 font-mono text-3xl">100%</span>
      </div>
      <div className="pt-10">
        <p className="text-primary-200 text-center text-xl">
          Improve your <br />
          academic performance
        </p>
        <p className="text-primary-300 pt-4">
          Lorem ipsum dolor sit amet, consectetur adipisicing elit. Nulla, quas
          magni? Illo, rerum! Totam molestias error quae, facere veritatis lorem
          dolor sit lorem ipsum?
        </p>
      </div>
    </div>
  );
};

const CoursesCard: React.FC = () => {
  return (
    <div className="bg-primary-800 border-primary-700 col-span-5 flex flex-col rounded-xl border px-6 py-8">
      <div className="flex w-full flex-col gap-2.5 font-light">
        <div className="bg-primary-700 border-primary-600 text-primary-300 flex w-full items-center gap-4 rounded-lg border p-2">
          <span className="h-10 w-1.5 rounded-sm bg-blue-500" />
          <span className="text-sm">
            CEN3031 - Intro to Software Engineering
          </span>
        </div>
        <div className="bg-primary-700 border-primary-600 text-primary-300 flex w-full items-center gap-4 rounded-lg border p-2">
          <span className="h-10 w-1.5 rounded-sm bg-blue-500" />
          <span className="text-sm">
            COP3530 - Data Structures and Algorithms
          </span>
        </div>
        <div className="faded-card relative rounded-lg p-px">
          <div className="bg-primary-700 text-primary-300 flex w-full items-center gap-4 rounded-lg p-2">
            <span className="h-10 w-1.5 rounded-sm bg-blue-500" />
            <span className="text-sm">CDA3101 - Computer Organization</span>
            <div className="cover absolute" />
          </div>
        </div>
      </div>
      <div className="pt-10">
        <p className="text-primary-200 text-xl">
          Study for every class in one place
        </p>
        <p className="text-primary-300 pt-4">
          Lorem ipsum dolor sit amet, consectetur adipisicing elit. Nulla, quas
          magni? Illo, rerum! Totam molestias error quae, facere veritatis
          expedita iusto amet cum quas tempora lorem ipsum dolor.
        </p>
      </div>
    </div>
  );
};

const QuizCard: React.FC = () => {
  return (
    <div className="bg-primary-800 border-primary-700 col-span-8 rounded-xl border px-6 py-8">
      <div className="text-primary-300 font-light">
        <p className="text-xl">
          What data structure is best represented by the figure below?
        </p>
        <img src="/images/landing/linked-list.svg" alt="" className="pt-6" />
        <div className="grid grid-cols-2 gap-4 pt-8">
          <div className="bg-primary-700 border-primary-600 rounded-sm border px-4 py-2">
            Graph
          </div>
          <div className="bg-primary-700 border-primary-600 rounded-sm border px-4 py-2">
            Linked List
          </div>
          <div className="bg-primary-700 border-primary-600 rounded-sm border px-4 py-2">
            Tree
          </div>
          <div className="bg-primary-700 border-primary-600 rounded-sm border px-4 py-2">
            Array
          </div>
        </div>
      </div>
      <div className="pt-10">
        <p className="text-primary-200 text-xl">
          Dynamic learning based on your classes’ content.
        </p>
        <p className="text-primary-300 pt-4">
          Lorem ipsum dolor sit amet, consectetur adipisicing elit. Nulla, quas
          magni? Illo, rerum! Totam molestias error quae, facere veritatis
          expedita iusto amet cum quas tempora lorem ipsum dolor sit lorem dolor
          sit lorem ipsum?
        </p>
      </div>
    </div>
  );
};

const TimeCard: React.FC = () => {
  return (
    <div className="bg-primary-800 border-primary-700 col-span-7 rounded-xl border px-6 py-8">
      <div className="faded-card relative h-[220px] rounded-lg p-px">
        <span className="cover"></span>
        <div className="bg-primary-700 h-full rounded-lg p-6 flex flex-col gap-3 font-light text-sm">
          <p className="text-primary-300">Verifying user credentials... (3.2s)</p>
          <p className="text-primary-300">Downloading lectures for CEN3031 (2.4s)</p>
          <p className="text-primary-300">Analyzing course content (CEN3031) (4.3s)</p>
          <p className="text-primary-300">Creating quizzes based on course content (3.1s)</p>
          <p className="text-primary-300">Sending data to user... (1.7s)</p>
        </div>
      </div>
      <div className="pt-8">
        <p className="text-primary-200 text-xl">
          Save hundreds of hours spent in lectures
        </p>
        <p className="text-primary-300 pt-4">
          Lorem ipsum dolor sit amet, consectetur adipisicing elit. Nulla, quas
          magni? Illo, rerum! Totam molestias error quae, facere veritatis
          expedita iusto amet cum quas tempora lorem ipsum dolor.
        </p>
      </div>
    </div>
  );
};
