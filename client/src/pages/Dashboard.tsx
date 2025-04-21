import { useAtom } from "jotai";
import { userAtom } from "../store";
import { IoFlashOutline } from "react-icons/io5";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Lecture {
  id: string;
  title: string;
  recording_id: string;
  date: string;
  user_id: string;
  course_id: string;
  url: string;
  created_at: string;
  unread?: boolean;
  color?: string;
  course_name?: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  course_id: string;
  user_id: string;
  due_date: string;
  points: number;
  status: string;
  created_at: string;
  assignment_group?: string;
  color?: string;
  course_name?: string;
  formatted_date?: string;
}

export default function Dashboard() {
  const [user] = useAtom(userAtom);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    // Set last updated timestamp
    const now = new Date();
    const formattedTime = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const formattedDate = now.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
    });
    setLastUpdated(`${formattedTime} ${formattedDate} EST`);
  }, []);

  return (
    <div className="h-screen max-h-screen w-full overflow-hidden p-5">
      <div className="border-primary-700 dashboard-box bg-primary-900 h-full w-full overflow-y-auto rounded-xl border shadow-xl">
        <div className="border-primary-800 bg-primary-900/60 sticky top-0 z-10 flex w-full items-center justify-between border-b p-5 backdrop-blur-sm">
          <p className="text-primary-200 font-medium">Dashboard</p>
          <p className="text-primary-400 text-sm">Last updated {lastUpdated}</p>
        </div>

        <div className="text-primary-200 p-6">
          <div className="mb-8 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 p-6">
            <p className="text-[32px] font-medium">
              Welcome back,{" "}
              <span className="inline-block bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                {user?.email}
              </span>
              !
            </p>
          </div>

          <div className="mb-8 w-full">
            <p className="text-primary-300 mb-4 text-lg font-medium">Classes</p>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <AssignmentsWidget />
              <LecturesWidget />
            </div>
          </div>

          <div>
            <p className="text-primary-300 mb-4 text-lg font-medium">
              Learning
            </p>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Link
                to="/dashboard/quizzes"
                className="bg-primary-800/60 border-primary-800 hover:border-primary-700 group h-64 rounded-xl border p-5 shadow-lg backdrop-blur-sm transition-all hover:shadow-xl"
              >
                <h3 className="text-xl font-medium transition-colors group-hover:text-blue-400">
                  Quizzes
                </h3>
                <p className="text-primary-400 mt-2">
                  Generate quizzes based on your lecture content using AI
                </p>
                <div className="mt-8 flex justify-end">
                  <span className="text-primary-300 transition-colors group-hover:text-blue-400">
                    Get started →
                  </span>
                </div>
              </Link>

              <Link
                to="/dashboard/notecards"
                className="bg-primary-800/60 border-primary-800 hover:border-primary-700 group h-64 rounded-xl border p-5 shadow-lg backdrop-blur-sm transition-all hover:shadow-xl"
              >
                <h3 className="text-xl font-medium transition-colors group-hover:text-blue-400">
                  Notecards
                </h3>
                <p className="text-primary-400 mt-2">
                  Create flashcards from your lecture transcripts
                </p>
                <div className="mt-8 flex justify-end">
                  <span className="text-primary-300 transition-colors group-hover:text-blue-400">
                    Get started →
                  </span>
                </div>
              </Link>

              <Link to={"/dashboard/guide"}>
                <div className="bg-primary-800/60 border-primary-800 hover:border-primary-700 group h-64 rounded-xl border p-5 shadow-lg backdrop-blur-sm transition-all hover:shadow-xl">
                  <h3 className="text-primary-300 text-xl font-medium">
                    Getting Started Guide
                  </h3>
                  <p className="text-primary-400 mt-2">
                    Learn everything you need to get started.
                  </p>
                  <div className="mt-8 flex justify-end">
                    <span className="text-primary-300 transition-colors group-hover:text-blue-400">
                      Get started →
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const AssignmentsWidget: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user] = useAtom(userAtom);

  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        const token = localStorage.getItem("token");

        const response = await fetch(`${API_URL}/assignments/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch assignments");
        }

        const data = await response.json();

        // Process the assignment data
        const processedAssignments = data.assignments.map(
          (assignment: Assignment) => {
            // Extract course name from course_id
            const courseName = assignment.course_id || "Unknown Class";

            // Get color based on course ID
            const color = getCourseColor(courseName);

            return {
              ...assignment,
              course_name: courseName,
              color,
            };
          },
        );

        // Limit to 5 assignments
        const limitedAssignments = processedAssignments.slice(0, 5);

        setAssignments(limitedAssignments);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        console.error("Error fetching assignments:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignments();
  }, [user, API_URL]);

  return (
    <div className="bg-primary-800/60 border-primary-800 rounded-xl border p-5 shadow-lg backdrop-blur-sm transition-all hover:shadow-xl">
      <div className="border-primary-700/50 mb-3 flex items-center justify-between border-b pb-3">
        <p className="text-xl font-medium">Assignments</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-lg">
          {assignments.length}
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-primary-400 mt-2">Loading assignments...</p>
        </div>
      ) : error ? (
        <div className="py-4 text-center text-red-500">
          <p>{error}</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-primary-400 py-8 text-center">
          <p>No assignments found</p>
          <Link
            to="/dashboard/assignments"
            className="mt-2 inline-block text-blue-400 transition-colors hover:text-blue-300"
          >
            View All Assignments
          </Link>
        </div>
      ) : (
        <>
          <div className="max-h-[264px] overflow-hidden">
            {assignments.map((assignment) => (
              <div
                className="border-primary-700/30 hover:bg-primary-700/20 grid grid-cols-12 border-b py-3 text-sm transition-colors"
                key={assignment.id}
              >
                <div className="col-span-12 flex items-center gap-4">
                  <span
                    style={{ backgroundColor: assignment.color }}
                    className="rounded-full px-4 py-1.5 whitespace-nowrap shadow-sm"
                  >
                    {assignment.course_name}
                  </span>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    {assignment.title}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 text-right">
            <Link
              to="/dashboard/assignments"
              className="inline-flex items-center text-blue-400 transition-colors hover:text-blue-300"
            >
              See More <span className="ml-1">→</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
};

const LecturesWidget: React.FC = () => {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [user] = useAtom(userAtom);

  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const fetchLectures = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        const token = localStorage.getItem("token");

        const response = await fetch(`${API_URL}/lectures/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch lectures");
        }

        const data = await response.json();

        // Process the lecture data to add some computed properties
        const processedLectures = data.lectures.map(
          (lecture: Lecture, index: number) => {
            // Extract a formatted date
            const date = new Date(lecture.created_at);
            const formattedDate = date.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            });

            // Extract course name from course_id
            let courseName = "Unknown Class";
            if (lecture.course_id) {
              courseName = `${lecture.course_id}`;
            }

            // Get color based on course ID
            const color = getCourseColor(courseName);

            // Mark three most recent lectures as unread (for demo)
            const unread = index < 3;

            return {
              ...lecture,
              date: formattedDate,
              course_name: courseName,
              color,
              unread,
            };
          },
        );

        // Sort by date (most recent first)
        processedLectures.sort((a, b) => {
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });

        // Limit to 4 lectures
        const limitedLectures = processedLectures.slice(0, 4);

        // Count unread
        const unreadLectures = limitedLectures.filter(
          (lecture) => lecture.unread,
        );

        setLectures(limitedLectures);
        setUnreadCount(unreadLectures.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        console.error("Error fetching lectures:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLectures();
  }, [user, API_URL]);

  return (
    <div className="bg-primary-800/60 border-primary-800 rounded-xl border p-5 shadow-lg backdrop-blur-sm transition-all hover:shadow-xl">
      <div className="border-primary-700/50 mb-3 flex items-center justify-between border-b pb-3">
        <p className="text-xl font-medium">Lectures</p>
        <p className="text-primary-300 bg-primary-700/30 flex gap-3 rounded-full px-3 py-1 text-sm">
          <span className="text-blue-400">{unreadCount} Unread</span>{" "}
          <span>{lectures.length} total</span>
        </p>
      </div>

      {isLoading ? (
        <div className="py-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-primary-400 mt-2">Loading lectures...</p>
        </div>
      ) : error ? (
        <div className="py-4 text-center text-red-500">
          <p>{error}</p>
        </div>
      ) : lectures.length === 0 ? (
        <div className="text-primary-400 py-8 text-center">
          <p>No lectures found</p>
          <Link
            to="/dashboard/lectures"
            className="mt-2 inline-block text-blue-400 transition-colors hover:text-blue-300"
          >
            View All Lectures
          </Link>
        </div>
      ) : (
        <>
          <div className="h-full max-h-[264px] overflow-hidden">
            {lectures.map((lecture) => (
              <div
                className="border-primary-700/30 hover:bg-primary-700/20 grid grid-cols-12 border-b py-3 text-sm transition-colors"
                key={lecture.id}
              >
                <div className="col-span-8 flex items-center gap-4">
                  <span
                    style={{ backgroundColor: lecture.color }}
                    className="rounded-full px-4 py-1.5 whitespace-nowrap shadow-sm"
                  >
                    {lecture.course_name}
                  </span>
                  <span className="overflow-hidden whitespace-nowrap">
                    {lecture.date}
                  </span>
                </div>
                {lecture.unread && (
                  <div className="col-span-4 flex items-center justify-end">
                    <span className="flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-blue-400">
                      <IoFlashOutline />
                      Unread
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-4 text-right">
            <Link
              to="/dashboard/lectures"
              className="inline-flex items-center text-blue-400 transition-colors hover:text-blue-300"
            >
              See More <span className="ml-1">→</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
};

// Utility function to generate consistent colors based on course name
const getCourseColor = (courseName: string) => {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
  }

  // List of color options
  const colors = [
    "#1E3A8A",
    "#581C87",
    "#7F1D1D",
    "#064E3B",
    "#1E40AF",
    "#831843",
  ];

  // Use the hash to select a color
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
};
