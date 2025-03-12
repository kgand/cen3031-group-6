import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";

const API_URL = import.meta.env.VITE_API_URL;

const checkEmailConfirmed = async (): Promise<boolean> => {
  const token = localStorage.getItem("token");
  if (!token) return false;

  const response = await fetch(`${API_URL}/auth/me`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return false;
  }

  const user = await response.json();
  console.log(user);

  return Boolean(user.email_confirmed_at);
};

const ConfirmEmail: React.FC = () => {
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const intervalId = setInterval(async () => {
      const isConfirmed = await checkEmailConfirmed();
      console.log(isConfirmed);
      if (isConfirmed) {
        setConfirmed(true);
        clearInterval(intervalId);

        navigate("/login");
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [navigate]);

  return (
    <>
      <div className="mx-auto mt-36 flex max-w-4xl flex-col items-center px-8">
        <h1 className="text-center text-3xl leading-tight font-semibold tracking-tight">
          We sent you an email with a confirmation link. Once you verify your
          email, refresh this page to sign in.
        </h1>
        <figure className="my-32">
          <img
            src="/images/confirm-email/email.svg"
            alt=""
            className="max-w-88"
          />
        </figure>
      </div>
    </>
  );
};

export default ConfirmEmail;
