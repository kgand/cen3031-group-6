export default function LandingMac() {
  return (
    <div className="border-primary-700 border-b py-28 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <h3 className="text-center text-3xl sm:text-4xl text-balance font-medium tracking-tight">
          Let the browser extension do the work
        </h3>
        <p className="text-primary-300 pt-4 text-center text-balance">
          FaciliGator is a smart content aggregator that analyzes video lectures{" "}
          <br className="hidden sm:inline"/>
          and course content to prepare personalized learning materials.{" "}
        </p>
        <div className="pt-20 sm:pt-28">
          <Mac />
        </div>
      </div>
    </div>
  );
}

const Mac: React.FC = () => {
  return (
    <div className="flex flex-col md:items-center">
      <div className="flex flex-col items-center w-[800px]">
        <Screen />
        <div className="pc-stand h-40 w-[260px]" />
        <div className="pc-base relative h-4 w-[260px]">
          <div className="bg-primary-700 absolute top-0 h-0.5 w-full"></div>
        </div>
      </div>
    </div>
  );
};

const Screen: React.FC = () => {
  return (
    <div className="relative">
      <div
        className="hidden sm:block bg-blue absolute right-9 bottom-2 left-9 z-0 h-2 bg-blue-500"
        style={{ filter: "blur(20px)" }}
      />
      <div className="border-primary-800 bg-primary-900 relative z-10 mx-auto rounded-xl border">
        <div className="h-[450px] w-[800px] p-2.5">
          <img
            src="/images/landing/pc-bg.png"
            alt=""
            className="absolute inset-2.5 z-0"
          />

          <div className="relative h-full w-full">
            <Taskbar />
            <ScreenMain />
          </div>
        </div>
      </div>
    </div>
  );
};

const Taskbar: React.FC = () => {
  function getFormattedDate(): string {
    const date = new Date();

    const year = date.getFullYear();

    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");

    return `${year}-${month}-${day}`;
  }
  return (
    <div className="bg-primary-800 text-primary-300 flex h-5 w-full items-center justify-between px-4 text-[7px] font-thin tracking-wide">
      <div className="flex gap-4 pt-px">
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
        <span>Window</span>
      </div>
      <div className="pt-px">
        <span>{getFormattedDate()}</span>
      </div>
    </div>
  );
};

const ScreenMain: React.FC = () => {
  return (
    <div className="flex h-full w-full items-center pl-10 md:pl-0 md:justify-center rounded-sm backdrop-blur-sm">
      <div className="rounded-sm bg-[rgba(26,26,26,0.8)] p-2 pt-0">
        <div className="flex gap-1 py-1.5">
          <span className="h-1 w-1 rounded-full bg-blue-500" />
          <span className="h-1 w-1 rounded-full bg-blue-500" />
          <span className="h-1 w-1 rounded-full bg-blue-500" />
        </div>
        <img src="/images/landing/pc-tab.png" alt="" />
      </div>
    </div>
  );
};
