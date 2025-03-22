import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useSignInOut from "../hooks/useSignInOut";
import SignInUpBox from "../components/ui/SignInUpBox";
import Gridlines from "../components/ui/Gridlines";
import Footer from "../components/Footer";

export default function Login() {
  return (
    <>
      <Gridlines />
      <div className="relative flex min-h-screen w-full flex-col justify-between gap-16">
        <div className="mx-auto mt-32 flex w-full max-w-[575px] justify-center sm:mt-40">
          <SignInUpBox>
            <LoginMenu />
          </SignInUpBox>
        </div>
        <Footer />
      </div>
    </>
  );
}

const LoginMenu: React.FC = () => {
  return (
    <div className="border-primary-700 flex flex-col items-center rounded-sm p-3 sm:border sm:p-6">
      <figure>
        <img src="/images/nav-logo.png" alt="" className="max-w-32" />
      </figure>
      <p className="text-primary-200 pt-4 text-2xl">Login to FaciliGator</p>
      <Form />
    </div>
  );
};

const Form: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [isValid, setIsValid] = useState<boolean>(false);
  const { loginWithRedirect } = useSignInOut();

  useEffect(() => {
    if (email.length > 0 && password.length > 0) {
      setIsValid(true);
    } else {
      setIsValid(false);
    }
  }, [email, password]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    await loginWithRedirect(email, password);
    setLoading(false);
  };

  return (
    <form className="mt-6 flex w-full flex-col gap-5" onSubmit={handleSubmit}>
      <div className="text-primary-200 flex flex-col gap-2.5">
        <label htmlFor="email">Email:</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          placeholder="email@email.com"
          id="email"
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
          id="password"
          className="bg-primary-800 border-primary-700 focus:border-primary-500 w-full rounded-sm border px-4 py-2 focus:outline-none"
        />
      </div>
      <div>
        <button
          className={`w-full rounded-sm bg-blue-500 py-2 ${isValid && !loading ? "cursor-pointer" : "cursor-not-allowed opacity-20"} transition-all`}
          disabled={!isValid || loading}
        >
          Login
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
