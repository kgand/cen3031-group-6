export default function Gridlines() {
  return (
    <>
      <div className="bg-primary-700 absolute top-24 hidden h-px w-full md:block" />
      <div className="fixed inset-0 p-1">
        <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl justify-between">
          <div className="bg-primary-700 w-px" />
          <div className="bg-primary-700 w-px" />
        </div>
      </div>
    </>
  );
}
