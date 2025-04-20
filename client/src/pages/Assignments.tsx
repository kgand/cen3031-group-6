import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { userAtom } from "../store";
import { IoTrashOutline } from "react-icons/io5";

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
  rubric?: any[];
  course_name?: string;
  formatted_date?: string;
}

export default function Assignments() {
  const [user] = useAtom(userAtom);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL;

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
        
        return {
          ...assignment,
          course_name: courseName
        };
      });
      
      setAssignments(processedAssignments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching assignments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [user, API_URL]);

  // Generate a color based on the course name
  const getCourseColor = (courseName: string) => {
    // Simple hash function to generate consistent colors for the same course
    let hash = 0;
    for (let i = 0; i < courseName.length; i++) {
      hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // List of color options (same as in Dashboard.tsx)
    const colors = ["#1E3A8A", "#581C87", "#7F1D1D", "#064E3B", "#1E40AF", "#831843"];
    
    // Use the hash to select a color
    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
  };

  const deleteAssignment = async (assignmentId: string) => {
    try {
      setIsDeleting(assignmentId);
      const token = localStorage.getItem("token");
      
      const response = await fetch(`${API_URL}/assignments/${assignmentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete assignment");
      }

      // Remove the deleted assignment from state
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error deleting assignment:", err);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="h-screen max-h-screen w-full p-5 overflow-hidden">
      <div className="border-primary-700 h-full w-full rounded-xl border overflow-y-auto dashboard-box bg-primary-900 shadow-xl">
        <div className="border-primary-800 flex w-full items-center justify-between border-b p-5 bg-primary-900/60 backdrop-blur-sm sticky top-0 z-10">
          <p className="text-primary-200 font-medium">Assignments</p>
          <div className="flex items-center gap-2">
            <p className="text-primary-400 text-sm">
              {assignments.length} assignment{assignments.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        <div className="text-primary-200 p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-primary-400">Loading assignments...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              <p>{error}</p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-primary-400">No assignments found. Upload some assignments with the Chrome extension.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <div 
                  key={assignment.id} 
                  className="bg-primary-800/60 backdrop-blur-sm rounded-xl border border-primary-800 p-4 shadow-lg hover:shadow-xl transition-all"
                >
                  <div className="flex items-center gap-4">
                    <span
                      style={{ backgroundColor: getCourseColor(assignment.course_name || "") }}
                      className="rounded-full px-4 py-1.5 text-sm shadow-sm"
                    >
                      {assignment.course_name}
                    </span>
                    <h3 className="font-medium text-primary-100">
                      {assignment.title}
                    </h3>
                  </div>
                  
                  {assignment.description && (
                    <div className="mt-3 text-primary-300 text-sm px-4 py-3 bg-primary-700/20 rounded-lg">
                      <p className="line-clamp-2">{assignment.description}</p>
                    </div>
                  )}
                  
                  <div className="mt-3 flex justify-between items-center">
                    {assignment.points ? (
                      <span className="text-primary-300 text-sm">
                        Points: {assignment.points}
                      </span>
                    ) : (
                      <span></span>
                    )}
                    
                    <div className="flex gap-3">
                      <button 
                        className="text-red-400 hover:text-red-300 p-2 rounded-lg transition-all hover:bg-red-900/30 flex items-center gap-1"
                        onClick={() => deleteAssignment(assignment.id)}
                        disabled={isDeleting === assignment.id}
                      >
                        {isDeleting === assignment.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-500"></div>
                        ) : (
                          <IoTrashOutline />
                        )}
                        <span className="text-sm">Delete</span>
                      </button>
                      
                      <button 
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg"
                        onClick={() => {
                          // View assignment details functionality
                          alert("View assignment details functionality coming soon");
                        }}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 