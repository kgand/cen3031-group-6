import { useAtom } from "jotai";
import { userAtom } from "../store";

export default function Dashboard() {
  const [user] = useAtom(userAtom);
  return (
    <div className="max-h-screen h-screen w-full p-5 ">
      <div className="border-primary-700 h-full w-full border rounded-xl">
        <div className="p-4 w-full border-b border-primary-700">
          <p className="text-primary-200">Dashboard</p>
        </div>
        <div className="p-4 text-primary-200">
          <p className="text-[32px] font-medium">Welcome back, {user?.email}!</p>
        </div>
      </div>
    </div>
  );
}
