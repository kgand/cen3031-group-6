export default function Guide() {
  return (
    <div className="h-screen max-h-screen w-full overflow-hidden p-5">
      <div className="border-primary-700 dashboard-box bg-primary-900 h-full w-full overflow-y-auto rounded-xl border p-5 shadow-xl">
        <div className="grid gap-8">
          <div>
            <h1 className="text-3xl font-semibold">
              FaciliGator Getting Started Guide
            </h1>
            <p className="text-primary-300 pt-2">
              Everything you need to know to productively use Faciligator
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-medium">1. Run/Download Faciligator Browser Extension</h2>
            <p className="text-lg text-primary-300 pl-3 pt-2">1.1 If running locally, review the README in the extension folder for setup.</p>
          </div>
          <div>
            <h2 className="text-2xl font-medium">2. Create an account through the Faciligator website/extenstion</h2>
            <p className="text-lg text-primary-300 pl-3 pt-2">2.1 Verify your account through the email sent to you.</p>
          </div>
          <div className="">
            <h2 className="text-2xl font-medium">3. Navigate to the Canvas class of your choosing.</h2>
          </div>
          <div className="">
            <h2 className="text-2xl font-medium">4. Chose whether you want to upload lectures or assignments in the browser extension.</h2>
            <p className="text-lg text-primary-300 pl-3 pt-2">4.1 For zoom lectures make sure to select the class to upload in the inbox.</p>
            <p className="text-lg text-primary-300 pl-3 pt-2">4.2 The extension should automatically begin uploading the material.</p>
            <p className="text-lg text-primary-300 pl-3 pt-1">4.3 Wait for all assignments/lectures to be uploaded or stop the process when you are pleased.</p>
          </div>
          <div className="">
            <h2 className="text-2xl font-medium">5. Return to the FaciliGator website and utilize the various study features.</h2>
          </div>
        </div>
      </div>
    </div>
  );
}
