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
    const formattedTime = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
    const formattedDate = now.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric'
    });
    setLastUpdated(`${formattedTime} ${formattedDate} EST`);
  }, []);

  return (
    <div className="h-screen max-h-screen w-full p-5 overflow-hidden">
      <div className="border-primary-700 h-full w-full rounded-xl border overflow-y-auto dashboard-box bg-primary-900 shadow-xl">
        <div className="border-primary-800 flex w-full items-center justify-between border-b p-5 bg-primary-900/60 backdrop-blur-sm sticky top-0 z-10">
          <p className="text-primary-200 font-medium">Dashboard</p>
          <p className="text-primary-400 text-sm">
            Last updated {lastUpdated}
          </p>
        </div>
        
        <div className="text-primary-200 p-6">
          <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 p-6 rounded-xl mb-8">
          <p className="text-[32px] font-medium">
              Welcome back, <span className="bg-gradient-to-r from-blue-400 to-indigo-400 inline-block text-transparent bg-clip-text">{user?.email}</span>!
            </p>
          </div>
          
          <div className="w-full mb-8">
            <p className="text-primary-300 text-lg font-medium mb-4">Classes</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AssignmentsWidget />
              <LecturesWidget />
            </div>
          </div>
          
          <div>
            <p className="text-primary-300 text-lg font-medium mb-4">Learning</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link 
                to="/dashboard/quizzes"
                className="h-64 bg-primary-800/60 backdrop-blur-sm rounded-xl border border-primary-800 p-5 hover:border-primary-700 transition-all group shadow-lg hover:shadow-xl"
              >
                <h3 className="text-xl font-medium group-hover:text-blue-400 transition-colors">Quizzes</h3>
                <p className="text-primary-400 mt-2">
                  Generate quizzes based on your lecture content using AI
                </p>
                <div className="flex justify-end mt-8">
                  <span className="text-primary-300 group-hover:text-blue-400 transition-colors">
                    Get started →
                  </span>
                </div>
              </Link>
              
              <Link 
                to="/dashboard/notecards"
                className="h-64 bg-primary-800/60 backdrop-blur-sm rounded-xl border border-primary-800 p-5 hover:border-primary-700 transition-all group shadow-lg hover:shadow-xl"
              >
                <h3 className="text-xl font-medium group-hover:text-blue-400 transition-colors">Notecards</h3>
                <p className="text-primary-400 mt-2">
                  Create flashcards from your lecture transcripts
                </p>
                <div className="flex justify-end mt-8">
                  <span className="text-primary-300 group-hover:text-blue-400 transition-colors">
                    Get started →
                  </span>
                </div>
              </Link>
              
              <div className="h-64 bg-primary-800/60 backdrop-blur-sm rounded-xl border border-primary-800 p-5 shadow-lg">
                <h3 className="text-xl font-medium text-primary-300">More Coming Soon</h3>
                <p className="text-primary-400 mt-2">
                  Additional learning tools will be available soon
                </p>
              </div>
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
        const processedAssignments = data.assignments.map((assignment: Assignment) => {
          // Extract course name from course_id
          const courseName = assignment.course_id || "Unknown Class";
          
          // Get color based on course ID
          const color = getCourseColor(courseName);
          
          return {
            ...assignment,
            course_name: courseName,
            color
          };
        });
        
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
    <div className="bg-primary-800/60 backdrop-blur-sm rounded-xl border border-primary-800 p-5 shadow-lg hover:shadow-xl transition-all">
      <div className="border-primary-700/50 flex items-center justify-between border-b pb-3 mb-3">
        <p className="text-xl font-medium">Assignments</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-lg">
          {assignments.length}
        </div>
      </div>
      
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-primary-400">Loading assignments...</p>
        </div>
      ) : error ? (
        <div className="text-center py-4 text-red-500">
          <p>{error}</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-8 text-primary-400">
          <p>No assignments found</p>
          <Link to="/dashboard/assignments" className="text-blue-400 mt-2 inline-block hover:text-blue-300 transition-colors">
            View All Assignments
          </Link>
        </div>
      ) : (
        <>
      <div className="overflow-hidden max-h-[264px]">
            {assignments.map((assignment) => (
              <div
                className="border-primary-700/30 grid grid-cols-12 border-b py-3 text-sm hover:bg-primary-700/20 transition-colors"
                key={assignment.id}
              >
                <div className="col-span-12 flex items-center gap-4">
                  <span
                    style={{ backgroundColor: assignment.color }}
                    className="rounded-full px-4 py-1.5 whitespace-nowrap shadow-sm"
                  >
                    {assignment.course_name}
              </span>
                  <span className="overflow-hidden whitespace-nowrap text-ellipsis">
                    {assignment.title}
              </span>
            </div>
          </div>
        ))}
      </div>
          
          <div className="pt-4 text-right">
            <Link to="/dashboard/assignments" className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center">
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
        const processedLectures = data.lectures.map((lecture: Lecture, index: number) => {
          // Extract a formatted date
          const date = new Date(lecture.created_at);
          const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
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
            unread
          };
        });
        
        // Sort by date (most recent first)
        processedLectures.sort((a, b) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        
        // Limit to 4 lectures
        const limitedLectures = processedLectures.slice(0, 4);
        
        // Count unread
        const unreadLectures = limitedLectures.filter(lecture => lecture.unread);
        
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
    <div className="bg-primary-800/60 backdrop-blur-sm rounded-xl border border-primary-800 p-5 shadow-lg hover:shadow-xl transition-all">
      <div className="border-primary-700/50 flex items-center justify-between border-b pb-3 mb-3">
        <p className="text-xl font-medium">Lectures</p>
        <p className="text-primary-300 flex gap-3 text-sm bg-primary-700/30 px-3 py-1 rounded-full">
          <span className="text-blue-400">{unreadCount} Unread</span> <span>{lectures.length} total</span>
        </p>
      </div>
      
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-primary-400">Loading lectures...</p>
        </div>
      ) : error ? (
        <div className="text-center py-4 text-red-500">
          <p>{error}</p>
        </div>
      ) : lectures.length === 0 ? (
        <div className="text-center py-8 text-primary-400">
          <p>No lectures found</p>
          <Link to="/dashboard/lectures" className="text-blue-400 mt-2 inline-block hover:text-blue-300 transition-colors">
            View All Lectures
          </Link>
        </div>
      ) : (
        <>
      <div className="overflow-hidden h-full max-h-[264px]">
        {lectures.map((lecture) => (
          <div
                className="border-primary-700/30 grid grid-cols-12 border-b py-3 text-sm hover:bg-primary-700/20 transition-colors"
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
                    <span className="flex items-center gap-2 text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full">
                  <IoFlashOutline />
                  Unread
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
          
          <div className="pt-4 text-right">
            <Link to="/dashboard/lectures" className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center">
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
  const colors = ["#1E3A8A", "#581C87", "#7F1D1D", "#064E3B", "#1E40AF", "#831843"];
  
  // Use the hash to select a color
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
};
