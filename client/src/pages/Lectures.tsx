import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { userAtom } from "../store";
import { IoTrashOutline, IoCloseOutline } from "react-icons/io5";

interface Lecture {
  id: string;
  title: string;
  recording_id: string;
  date: string;
  user_id: string;
  course_id: string;
  url: string;
  host: string;
  created_at: string;
  transcript_data?: any;
  formatted_text?: string;
  course_name?: string;
}

export default function Lectures() {
  const [user] = useAtom(userAtom);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [selectedTranscript, setSelectedTranscript] = useState<{lecture: Lecture, isOpen: boolean}>({
    lecture: {} as Lecture,
    isOpen: false
  });

  const API_URL = import.meta.env.VITE_API_URL;

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
      
      // Process the lecture data to add course name
      const processedLectures = data.lectures.map((lecture: Lecture) => {
        // Extract course name from course_id
        let courseName = "Unknown Class";
        if (lecture.course_id) {
          courseName = `${lecture.course_id}`;
        }
        
        return {
          ...lecture,
          course_name: courseName
        };
      });
      
      setLectures(processedLectures);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching lectures:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLectures();
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

  const deleteLecture = async (lectureId: string) => {
    try {
      setIsDeleting(lectureId);
      const token = localStorage.getItem("token");
      
      const response = await fetch(`${API_URL}/lectures/${lectureId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete lecture");
      }

      // Remove the deleted lecture from state
      setLectures(prev => prev.filter(l => l.id !== lectureId));
      
      // Close transcript view if it was open for this lecture
      if (selectedTranscript.isOpen && selectedTranscript.lecture.id === lectureId) {
        setSelectedTranscript({lecture: {} as Lecture, isOpen: false});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error deleting lecture:", err);
    } finally {
      setIsDeleting(null);
    }
  };

  const viewFullTranscript = (lecture: Lecture) => {
    setSelectedTranscript({
      lecture: lecture,
      isOpen: true
    });
  };

  return (
    <div className="h-screen max-h-screen w-full p-5 overflow-hidden">
      <div className="border-primary-700 h-full w-full rounded-xl border overflow-y-auto dashboard-box bg-primary-900 shadow-xl">
        <div className="border-primary-800 flex w-full items-center justify-between border-b p-5 bg-primary-900/60 backdrop-blur-sm sticky top-0 z-10">
          <p className="text-primary-200 font-medium">Lectures</p>
          <p className="text-primary-400 text-sm">
            {lectures.length} lecture{lectures.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="text-primary-200 p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-primary-400">Loading lectures...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              <p>{error}</p>
            </div>
          ) : lectures.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-primary-400">No lectures found. Upload some lectures with the Chrome extension.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {lectures.map((lecture) => (
                <div 
                  key={lecture.id} 
                  className="bg-primary-800/60 backdrop-blur-sm rounded-xl border border-primary-800 p-5 shadow-lg hover:shadow-xl transition-all"
                >
                  <div className="border-primary-700/50 flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 mb-3">
                    <p className="text-xl font-medium">{lecture.title || `Lecture ${lecture.recording_id?.substring(0, 8) || ""}`}</p>
                    <div className="flex items-center gap-3 mt-2 sm:mt-0">
                      <span 
                        style={{ backgroundColor: getCourseColor(lecture.course_name || "") }}
                        className="rounded-full px-4 py-1.5 text-sm shadow-sm"
                      >
                        {lecture.course_name}
                      </span>
                    </div>
                  </div>
                  
                  <div className="py-3">
                    {lecture.formatted_text ? (
                      <div className="max-h-40 overflow-y-auto text-primary-300 text-sm px-4 py-3 bg-primary-700/20 rounded-lg">
                        <p className="whitespace-pre-line">{lecture.formatted_text.substring(0, 500)}...</p>
                      </div>
                    ) : (
                      <p className="text-primary-400 italic px-4 py-3 bg-primary-700/20 rounded-lg">No transcript available</p>
                    )}
                  </div>
                  
                  <div className="flex flex-col sm:flex-row justify-between pt-3 items-center gap-3">
                    <a 
                      href={lecture.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition-colors flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                      Watch Recording
                    </a>
                    
                    <div className="flex gap-3">
                      <button 
                        className="text-red-400 hover:text-red-300 p-2 rounded-lg transition-all hover:bg-red-900/30 flex items-center gap-1"
                        onClick={() => deleteLecture(lecture.id)}
                        disabled={isDeleting === lecture.id}
                      >
                        {isDeleting === lecture.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-500"></div>
                        ) : (
                          <IoTrashOutline />
                        )}
                        <span className="text-sm">Delete</span>
                      </button>
                      
                      <button 
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg w-full sm:w-auto"
                        onClick={() => viewFullTranscript(lecture)}
                        disabled={!lecture.formatted_text}
                      >
                        Full Transcript
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Full Transcript Modal */}
      {selectedTranscript.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
          <div className="bg-primary-900 border-primary-700 border rounded-xl p-6 w-full max-w-4xl h-[80vh] shadow-2xl flex flex-col">
            <div className="flex justify-between items-center border-b border-primary-800 pb-4 mb-4">
              <div>
                <h2 className="text-xl font-medium text-primary-100">
                  {selectedTranscript.lecture.title || `Lecture Transcript`}
                </h2>
                <span 
                  style={{ backgroundColor: getCourseColor(selectedTranscript.lecture.course_name || "") }}
                  className="rounded-full px-3 py-1 text-xs shadow-sm mt-2 inline-block"
                >
                  {selectedTranscript.lecture.course_name}
                </span>
              </div>
              <button 
                onClick={() => setSelectedTranscript({...selectedTranscript, isOpen: false})}
                className="text-primary-400 hover:text-primary-200 p-1"
              >
                <IoCloseOutline size={24} />
              </button>
            </div>
            
            <div className="flex-grow overflow-y-auto bg-primary-800/40 rounded-lg p-4 text-primary-200 text-sm">
              <p className="whitespace-pre-line">{selectedTranscript.lecture.formatted_text}</p>
            </div>
            
            <div className="mt-4 pt-4 border-t border-primary-800 flex justify-end">
              <button 
                onClick={() => setSelectedTranscript({...selectedTranscript, isOpen: false})}
                className="bg-primary-700 hover:bg-primary-600 text-primary-200 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 