import { useAtom } from "jotai";
import { userAtom } from "../store";
import { IoFlashOutline } from "react-icons/io5";

export default function Dashboard() {
  const [user] = useAtom(userAtom);
  return (
    <div className="h-screen max-h-screen w-full p-5">
      <div className="border-primary-700 h-full w-full rounded-xl border overflow-y-auto dashboard-box">
        <div className="border-primary-700 flex w-full items-center justify-between border-b p-4">
          <p className="text-primary-200">Dashboard</p>
          <p className="text-primary-400 text-sm">
            Last updated 11:36 PM 3/21 EST
          </p>{" "}
        </div>
        <div className="text-primary-200 p-4">
          <p className="text-[32px] font-medium">
            Welcome back, {user?.email}!
          </p>
          <div className="w-full pt-6">
            <p className="text-primary-300">Classes</p>
            <div className="grid grid-cols-2 gap-5 pt-4">
              <AssignmentsWidget />
              <LecturesWidget />
            </div>
          </div>
          <div className="pt-6">
            <p className="text-primary-300">Learning</p>
            <div className="pt-4 grid grid-cols-3 gap-5">
              <div className="h-64 bg-primary-800 rounded-lg border border-primary-700"></div>
              <div className="h-64 bg-primary-800 rounded-lg border border-primary-700"></div>
              <div className="h-64 bg-primary-800 rounded-lg border border-primary-700"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const AssignmentsWidget: React.FC = () => {
  type Assignment = {
    class: string;
    name: string;
    date: string;
    color: string;
  };

  const assignments: Assignment[] = [
    {
      class: "CEN3101",
      name: "Module 11: Sprint 11 Presentation",
      date: "3/21 11:59 PM",
      color: "#1E3A8A",
    },
    {
      class: "CDA3101",
      name: "Homework 12",
      date: "3/21 11:59 PM",
      color: "#581C87",
    },
    {
      class: "MAN3025",
      name: "Chapter 10 Quiz",
      date: "3/21 11:59 PM",
      color: "#7F1D1D",
    },
    {
      class: "COP3530",
      name: "Exam 1",
      date: "3/21 11:59 PM",
      color: "#064E3B",
    },
    {
      class: "CEN3101",
      name: "Module 9: Daily Scrum Weekly Report (Sp...)",
      date: "3/21 11:59 PM",
      color: "#1E3A8A",
    },
  ];

  return (
    <div className="bg-primary-800 border-primary-700 rounded-lg border p-4">
      <div className="border-primary-600 flex items-center justify-between border-b pb-2">
        <p className="text-2xl font-medium">Upcoming Assignments</p>
        <p className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-lg">
          8
        </p>
      </div>
      <div className="overflow-hidden max-h-[264px]">
        {assignments.map((ass) => (
          <div
            className="border-primary-700 grid grid-cols-12 border-b py-3 text-sm"
            key={ass.name}
          >
            <div className="col-span-8 flex items-center gap-4">
              <span
                style={{ backgroundColor: ass.color }}
                className="rounded-full px-4 py-1"
              >
                {" "}
                {ass.class}
              </span>
              <span className="overflow-hidden whitespace-nowrap">
                {ass.name}
              </span>
            </div>
            <div className="col-span-4 flex items-center justify-end">
              {ass.date}
            </div>
          </div>
        ))}
      </div>
      <div className="border-primary-600 flex justify-end border-t pt-4">
        <p>See More →</p>
      </div>
    </div>
  );
};

const LecturesWidget: React.FC = () => {
  type Lecture = {
    class: string;
    date: string;
    unread: boolean;
    color: string;
  };

  const lectures: Lecture[] = [
    {
      class: "CEN3101",
      date: "Friday, March 14",
      unread: true,
      color: "#1E3A8A",
    },
    {
      class: "CDA3101",
      date: "Wednesday, March 12",
      unread: true,
      color: "#581C87",
    },
    {
      class: "MAN3025",
      date: "Thursday, March 13",
      unread: true,
      color: "#7F1D1D",
    },
    {
      class: "COP3530",
      date: "Friday, March 14",
      unread: false,
      color: "#064E3B",
    },
  ];

  return (
    <div className="bg-primary-800 border-primary-700 rounded-lg border p-4">
      <div className="border-primary-600 flex items-center justify-between border-b pb-2">
        <p className="text-2xl font-medium">Lectures</p>
        <p className="text-primary-300 flex gap-2 text-sm">
          <span>4 Unread</span> <span>21 total</span>
        </p>
      </div>
      <div className="overflow-hidden h-full max-h-[264px]">
        {lectures.map((lecture) => (
          <div
            className="border-primary-700 grid grid-cols-12 border-b py-3 text-sm"
            key={lecture.class}
          >
            <div className="col-span-8 flex items-center gap-4">
              <span
                style={{ backgroundColor: lecture.color }}
                className="rounded-full px-4 py-1"
              >
                {" "}
                {lecture.class}
              </span>
              <span className="overflow-hidden whitespace-nowrap">
                {lecture.date}
              </span>
            </div>
            {lecture.unread && (
              <div className="col-span-4 flex items-center justify-end">
                <span className="flex items-center gap-2">
                  <IoFlashOutline />
                  Unread
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="border-primary-600 flex justify-end border-t pt-4">
        <p>See More →</p>
      </div>
    </div>
  );
};
