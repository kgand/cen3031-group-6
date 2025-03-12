export default function Footer() {
  return (
    <footer className="border-primary-700 border-t">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-16 px-8 pt-28 pb-7 sm:pt-40 md:pt-48 lg:flex-row lg:items-end">
        <div>
          <img src="/images/nav-logo.png" alt="" className="w-40" />
          <p className="pt-3 text-3xl">FaciliGator</p>
          <p className="text-primary-300 pt-3 text-sm">
            © Copyright 2024 Faciligator. All <br />
            Commercial Rights Reserved.
          </p>
        </div>
        <div className="grid gap-16 sm:grid-cols-2 md:grid-cols-3">
          <div className="grid gap-3 font-light">
            <p className="text-primary-300">Links</p>
            <a href="" className="text-primary-200">
              Source Code
            </a>
            <a href="" className="text-primary-200">
              Browser Extension
            </a>
            <a href="" className="text-primary-200">
              Demo Video
            </a>
          </div>
          <div className="grid gap-3 font-light">
            <p className="text-primary-300">Links</p>
            <a href="" className="text-primary-200">
              Source Code
            </a>
            <a href="" className="text-primary-200">
              Browser Extension
            </a>
            <a href="" className="text-primary-200">
              Demo Video
            </a>
          </div>
          <div className="grid gap-3 font-light">
            <p className="text-primary-300">Links</p>
            <a href="" className="text-primary-200">
              Source Code
            </a>
            <a href="" className="text-primary-200">
              Browser Extension
            </a>
            <a href="" className="text-primary-200">
              Demo Video
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
