import { ReactNode } from "react";

interface BoxProps {
  children: ReactNode;
}

const SignInUpBox: React.FC<BoxProps> = ({ children }) => {
  return (
    <div className="flex w-full flex-col items-center">
      <div className="text-primary-500 flex w-full items-center justify-between gap-2">
        <p className="mb-1 text-2xl">+</p>
        <div className="bg-primary-700 h-px w-full" />
        <p className="mb-1 text-2xl">+</p>
      </div>
      <div className="w-full px-1.5">
        <div className="border-primary-700 w-full border-x px-6 py-4">
          {children}
        </div>
      </div>
      <div className="text-primary-500 flex w-full items-center justify-between gap-2">
        <p className="mb-1 text-2xl">+</p>
        <div className="bg-primary-700 h-px w-full" />
        <p className="mb-1 text-2xl">+</p>
      </div>
    </div>
  );
};

export default SignInUpBox;
