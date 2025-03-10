import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Login() {
  return (
    <div className="mx-auto mt-40 flex max-w-[600px] justify-center">
      <Box>
        <LoginMenu />
      </Box>
    </div>
  );
}

const Form: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isValid, setIsValid] = useState<boolean>(false);

  useEffect(() => {
    if (email.length > 0 && password.length > 0) {
      setIsValid(true);
    } else {
      setIsValid(false);
    }
  }, [email, password]);

  useEffect;
  return (
    <form className="mt-8 flex w-full flex-col gap-5">
      <div className="text-primary-200 flex flex-col gap-2.5">
        <label htmlFor="email">Email:</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          placeholder="email@email.com"
          id="#email"
          className="bg-primary-800 border-primary-700 focus:border-primary-500 w-full rounded-sm border px-4 py-2 focus:outline-none"
        />
      </div>
      <div className="text-primary-200 flex flex-col gap-2.5">
        <label htmlFor="password">Password:</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
          placeholder="Your Password"
          id="#password"
          className="bg-primary-800 border-primary-700 focus:border-primary-500 w-full rounded-sm border px-4 py-2 focus:outline-none"
        />
      </div>
      <div>
        <button
          className={`w-full rounded-sm bg-blue-500 py-2 ${isValid ? "cursor-pointer" : "opacity-30 cursor-not-allowed"} transition-all`}
          disabled={isValid}
        >
          Sign Up
        </button>
        <div className="text-primary-200 flex justify-end pt-4 text-sm">
          <p>
            Don't have an account?{" "}
            <Link to={"/signup"} className="text-blue-500">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </form>
  );
};

const LoginMenu: React.FC = () => {
  return (
    <div className="border-primary-600 flex flex-col items-center rounded-sm border p-6">
      <figure>
        <img src="/images/nav-logo.png" alt="" className="max-w-40" />
      </figure>
      <p className="text-primary-200 pt-5 text-2xl">Login to FaciliGator</p>
      <Form />
    </div>
  );
};

interface BoxProps {
  children: ReactNode;
}

const Box: React.FC<BoxProps> = ({ children }) => {
  return (
    <div className="flex w-full flex-col items-center">
      <div className="text-primary-600 flex w-full items-center justify-between gap-2">
        <p className="mb-1 text-2xl">+</p>
        <div className="bg-primary-600 h-px w-full" />
        <p className="mb-1 text-2xl">+</p>
      </div>
      <div className="w-full px-1.5">
        <div className="border-primary-600 w-full border-x px-8 py-4">
          {children}
        </div>
      </div>
      <div className="text-primary-600 flex w-full items-center justify-between gap-2">
        <p className="mb-1 text-2xl">+</p>
        <div className="bg-primary-600 h-px w-full" />
        <p className="mb-1 text-2xl">+</p>
      </div>
    </div>
  );
};
