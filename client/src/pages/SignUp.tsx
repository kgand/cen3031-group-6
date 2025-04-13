import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SignInUpBox from "../components/ui/SignInUpBox";
import useSignUp from "../hooks/useSignUp";
import Footer from "../components/Footer";
import Gridlines from "../components/ui/Gridlines";

export default function SignUp() {
  return (
    <>
    <Gridlines/>
      <div className="flex min-h-screen flex-col justify-between w-full gap-16 relative">
        <div className="mx-auto mt-32 sm:mt-40 flex max-w-[575px] justify-center w-full">
          <SignInUpBox>
            <SignUpMenu />
          </SignInUpBox>
        </div>
        <Footer />
      </div>
    </>
  );
}

const SignUpMenu: React.FC = () => {
  return (
    <div className="border-primary-700 flex flex-col items-center rounded-sm sm:border p-3 sm:p-6 relative">
      <figure>
        <img src="/images/nav-logo.png" alt="" className="max-w-32" />
      </figure>
      <p className="text-primary-200 pt-4 text-2xl">Create an Account</p>
      <Form />
    </div>
  );
};

const Form: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [fullName,setFullName] = useState<string>("")
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [isValid, setIsValid] = useState<boolean>(false);

  const { signUp, loading } = useSignUp();

  useEffect(() => {
    if (email.length > 0 && password.length > 0 && confirmPassword.length > 0 && fullName.length > 0) {
      setIsValid(true);
    } else {
      setIsValid(false);
    }
  }, [email, password, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading || password != confirmPassword || !isValid) return;
    await signUp(email, password, fullName);
  };

  return (
    <form className="mt-6 flex w-full flex-col gap-5" onSubmit={handleSubmit}>
      <div className="text-primary-200 flex flex-col gap-2.5">
        <label htmlFor="name">Email:</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          type="text"
          required
          placeholder="John Doe"
          id="name"
          className="bg-primary-800 border-primary-700 focus:border-primary-500 w-full rounded-sm border px-4 py-2 focus:outline-none"
        />
      </div>
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
          placeholder="Secure Password"
          id="password"
          className="bg-primary-800 border-primary-700 focus:border-primary-500 w-full rounded-sm border px-4 py-2 focus:outline-none"
        />
      </div>
      <div className="text-primary-200 flex flex-col gap-2.5">
        <label htmlFor="confirm-password">Confirm Password:</label>
        <input
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          type="password"
          required
          placeholder="Re-enter Password"
          id="confirm-password"
          className="bg-primary-800 border-primary-700 focus:border-primary-500 w-full rounded-sm border px-4 py-2 focus:outline-none"
        />
      </div>
      <div>
        <button
          className={`w-full rounded-sm bg-blue-500 py-2 ${isValid && !loading ? "cursor-pointer" : "cursor-not-allowed opacity-20"} transition-all`}
          disabled={!isValid || loading}
        >
          Sign Up
        </button>
        <div className="text-primary-200 flex justify-end pt-4 text-sm">
          <p>
            Already have an account?{" "}
            <Link to={"/login"} className="text-blue-500">
              Login
            </Link>
          </p>
        </div>
      </div>
    </form>
  );
};
