import { PrivacyWidget1, PrivacyWidget2 } from "./ui/PrivacyWidgets";

export default function LandingSecurity() {
  return (
    <div className="border-primary-700 border-b py-28">
      <div className="mx-auto max-w-6xl p-6 sm:px-8">
        <h3 className="text-center text-3xl sm:text-4xl text-balance font-medium tracking-tight">
          No need to worry about privacy
        </h3>
        <p className="text-primary-300 pt-4 text-center text-balance">
          FaciliGator is a smart content aggregator that analyzes video lectures{" "}
          <br className="hidden sm:inline"/>
          and course content to prepare personalized learning materials.{" "}
        </p>
        <div className="pt-20 sm:pt-28">
          <div className="grid md:grid-cols-2 gap-12 md:gap-24">
            <div>
              <p className="text-2xl">
                We never give user data to third parties.
              </p>
              <p className="text-primary-300 pt-4 text-lg">
                Lorem ipsum dolor sit amet, consectetur adipisicing elit. Nulla,
                quas magni? Illo, rerum! Totam molestias error quae, facere
                veritatis expedita iusto amet cum quas tempora lorem ipsum dolor
                sit lorem dolor sit lorem ipsum?
              </p>
            </div>
            <div className="bg-primary-800 h-80 w-full rounded-md">
              <PrivacyWidget1 />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-12 md:gap-24 pt-20 md:pt-28 md:grid-cols-2">
            {/* Text div is ordered first on mobile */}
            <div className="bg-primary-800 order-2 h-80 w-full rounded-md md:order-none">
              <PrivacyWidget2 />
            </div>
            <div className="order-1 md:order-none">
              <p className="text-2xl">Only upload what you choose.</p>
              <p className="text-primary-300 pt-4 text-lg">
                Lorem ipsum dolor sit amet, consectetur adipisicing elit. Nulla,
                quas magni? Illo, rerum! Totam molestias error quae, facere
                veritatis expedita iusto amet cum quas tempora lorem ipsum dolor
                sit lorem dolor sit lorem ipsum?
              </p>
            </div>

            {/* Widget div is ordered second on mobile */}
            
          </div>
        </div>
      </div>
    </div>
  );
}
