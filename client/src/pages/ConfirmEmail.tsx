import { useAtom } from "jotai";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { userAtom } from "../store";


const ConfirmEmail: React.FC = () => {
  const navigate = useNavigate();

  const [user] = useAtom(userAtom)

  useEffect(() => {
    if(user) {
      navigate("/dashboard")
    }
  },[user])

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
