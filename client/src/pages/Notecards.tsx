import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import { userAtom } from "../store";

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
  transcript_data?: Record<string, any>;
  formatted_text?: string;
  course_name?: string;
  selected?: boolean;
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
  course_name?: string;
  selected?: boolean;
}

interface Notecard {
  id: string;
  front: string;
  back: string;
}

interface DeckSource {
  id: string;
  title: string;
  type: "lecture" | "assignment";
  course_id: string;
}

interface Deck {
  id: string;
  title: string;
  sources: DeckSource[];
  date: string;
  cards: Notecard[];
}

export default function Notecards() {
  const [user] = useAtom(userAtom);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [showCardBack, setShowCardBack] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'lectures' | 'assignments'>('lectures');
  const [cardsPerSource, setCardsPerSource] = useState(5);

  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const fetchLectures = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const token = localStorage.getItem("token");
        
        // Fetch lectures to generate notecards from
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
        const processedLectures = data.lectures.map((lecture: Lecture) => {
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
          
          return {
            ...lecture,
            date: formattedDate,
            course_name: courseName,
            selected: false
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

    const fetchAssignments = async () => {
      if (!user) return;
      
      try {
        setIsLoadingAssignments(true);
        const token = localStorage.getItem("token");
        
        // Fetch assignments to generate notecards from
        const response = await fetch(`${API_URL}/assignments/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch assignments");
        }

        const data = await response.json();
        
        // Process the assignment data to add some computed properties
        const processedAssignments = data.assignments.map((assignment: Assignment) => {
          // Extract course name from course_id
          const courseName = assignment.course_id || "Unknown Class";
          
          return {
            ...assignment,
            course_name: courseName,
            selected: false
          };
        });
        
        setAssignments(processedAssignments);
      } catch (err) {
        console.error("Error fetching assignments:", err);
      } finally {
        setIsLoadingAssignments(false);
      }
    };

    fetchLectures();
    fetchAssignments();
  }, [user, API_URL]);

  // Generate notecards for the selected lectures and assignments using RAG
  const generateNotecards = async () => {
    const selectedLectures = lectures.filter(lecture => lecture.selected);
    const selectedAssignments = assignments.filter(assignment => assignment.selected);
    
    if (selectedLectures.length === 0 && selectedAssignments.length === 0) {
      setError("Please select at least one lecture or assignment to generate notecards");
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const token = localStorage.getItem("token");
      
      const response = await fetch(`${API_URL}/generate/notecards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cards_per_source: cardsPerSource,
          content_selection: {
            lecture_ids: selectedLectures.map(lecture => lecture.id),
            assignment_ids: selectedAssignments.map(assignment => assignment.id)
          }
        })
      });
      
      if (!response.ok) {
        throw new Error("Failed to generate notecards");
      }
      
      const data = await response.json();
      
      if (data.status === "error") {
        throw new Error(data.message);
      }
      
      // Transform the API response into our deck format
      const combinedSources = [
        ...selectedLectures.map(lecture => ({
          id: lecture.id,
          title: lecture.title || `Lecture ${lecture.recording_id?.substring(0, 8) || ""}`,
          type: "lecture" as const,
          course_id: lecture.course_id
        })),
        ...selectedAssignments.map(assignment => ({
          id: assignment.id,
          title: assignment.title,
          type: "assignment" as const,
          course_id: assignment.course_id
        }))
      ];
      
      // Create a new deck with all cards from all sources
      const allCards = data.notecards.flatMap(source => source.cards);
      
      const newDeck: Deck = {
        id: `deck_${Date.now()}`,
        title: `Notecards from ${combinedSources.length} source${combinedSources.length !== 1 ? 's' : ''}`,
        sources: combinedSources,
        date: new Date().toISOString(),
        cards: allCards
      };
      
      setDecks(prev => [...prev, newDeck]);
      setActiveDeck(newDeck);
      setActiveCardIndex(0);
      setShowCardBack(false);
      setShowModal(false);
      
      // Reset selections
      setLectures(prev => prev.map(lecture => ({...lecture, selected: false})));
      setAssignments(prev => prev.map(assignment => ({...assignment, selected: false})));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error generating notecards:", err);
    } finally {
      setIsGenerating(false);
    }
  };

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

  const handleNextCard = () => {
    if (!activeDeck) return;
    
    if (activeCardIndex < activeDeck.cards.length - 1) {
      setActiveCardIndex(prev => prev + 1);
      setShowCardBack(false);
    }
  };

  const handlePrevCard = () => {
    if (activeCardIndex > 0) {
      setActiveCardIndex(prev => prev - 1);
      setShowCardBack(false);
    }
  };

  const toggleCardFlip = () => {
    setShowCardBack(!showCardBack);
  };
  
  const deleteDeck = (deckId: string) => {
    // Filter out the deck to be deleted
    setDecks(prevDecks => prevDecks.filter(deck => deck.id !== deckId));
    
    // If active deck is deleted, close it
    if (activeDeck && activeDeck.id === deckId) {
      setActiveDeck(null);
    }
  };
  
  const toggleLectureSelection = (id: string) => {
    setLectures(prev => 
      prev.map(lecture => 
        lecture.id === id 
          ? {...lecture, selected: !lecture.selected} 
          : lecture
      )
    );
  };
  
  const toggleAssignmentSelection = (id: string) => {
    setAssignments(prev => 
      prev.map(assignment => 
        assignment.id === id 
          ? {...assignment, selected: !assignment.selected} 
          : assignment
      )
    );
  };
  
  const getSelectedCount = () => {
    const lectureCount = lectures.filter(l => l.selected).length;
    const assignmentCount = assignments.filter(a => a.selected).length;
    return lectureCount + assignmentCount;
  };

  return (
    <div className="h-screen max-h-screen w-full p-5 overflow-hidden">
      <div className="border-primary-700 h-full w-full rounded-xl border overflow-y-auto dashboard-box bg-primary-900 shadow-xl">
        <div className="border-primary-800 flex w-full items-center justify-between border-b p-5 bg-primary-900/60 backdrop-blur-sm sticky top-0 z-10">
          <p className="text-primary-200 font-medium">Notecards</p>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg"
          >
            Create New Deck
          </button>
        </div>
        
        <div className="text-primary-200 p-6">
          {isLoading && isLoadingAssignments ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-primary-400">Loading data...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              <p>{error}</p>
            </div>
          ) : activeDeck ? (
            <div className="bg-primary-800/60 backdrop-blur-sm rounded-xl border border-primary-800 p-6 shadow-lg">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
                <div>
                  <h2 className="text-xl font-medium text-primary-100">{activeDeck.title}</h2>
                  <p className="text-primary-400 text-sm mt-1">
                    Card {activeCardIndex + 1} of {activeDeck.cards.length}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {activeDeck.sources.slice(0, 3).map(source => (
                    <span 
                      key={source.id}
                      style={{ backgroundColor: getCourseColor(source.course_id) }}
                      className="rounded-full px-4 py-1.5 text-sm shadow-sm"
                    >
                      {source.course_id}
                    </span>
                  ))}
                  {activeDeck.sources.length > 3 && (
                    <span className="text-primary-300 text-sm">
                      +{activeDeck.sources.length - 3} more
                    </span>
                  )}
                </div>
              </div>
              
              {activeDeck.cards[activeCardIndex] && (
                <div>
                  <div 
                    className="min-h-[300px] flex items-center justify-center p-8 mb-6 bg-primary-700/30 rounded-lg cursor-pointer transition-all shadow-inner hover:shadow-md"
                    onClick={toggleCardFlip}
                  >
                    <p className="text-xl text-primary-100 text-center">
                      {showCardBack ? activeDeck.cards[activeCardIndex].back : activeDeck.cards[activeCardIndex].front}
                    </p>
                  </div>
                  
                  <div className="flex justify-between">
                    <button
                      onClick={handlePrevCard}
                      disabled={activeCardIndex === 0}
                      className={`px-4 py-2 rounded-lg text-sm transition-all ${
                        activeCardIndex === 0
                          ? 'bg-primary-700/50 text-primary-400 cursor-not-allowed'
                          : 'bg-primary-700/70 hover:bg-primary-600 text-primary-200 hover:shadow-md'
                      }`}
                    >
                      Previous Card
                    </button>
                    
                    <button
                      onClick={() => setActiveDeck(null)}
                      className="bg-primary-700/70 hover:bg-primary-600 text-primary-200 px-4 py-2 rounded-lg text-sm transition-all hover:shadow-md"
                    >
                      Back to Decks
                    </button>
                    
                    <button
                      onClick={handleNextCard}
                      disabled={activeCardIndex === activeDeck.cards.length - 1}
                      className={`px-4 py-2 rounded-lg text-sm transition-all ${
                        activeCardIndex === activeDeck.cards.length - 1
                          ? 'bg-primary-700/50 text-primary-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg'
                      }`}
                    >
                      Next Card
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : decks.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {decks.map(deck => (
                <div 
                  key={deck.id}
                  className="bg-primary-800/60 backdrop-blur-sm rounded-xl border border-primary-800 p-5 hover:border-primary-600 transition-all shadow-lg hover:shadow-xl"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-primary-100">{deck.title}</h3>
                    <div className="flex gap-2">
                      {deck.sources.slice(0, 2).map(source => (
                        <span 
                          key={source.id}
                          style={{ backgroundColor: getCourseColor(source.course_id) }}
                          className="rounded-full px-3 py-1 text-xs shadow-sm"
                        >
                          {source.course_id}
                        </span>
                      ))}
                      {deck.sources.length > 2 && (
                        <span className="text-primary-400 text-xs">
                          +{deck.sources.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-primary-400 text-sm mt-2">{deck.cards.length} cards from {deck.sources.length} source{deck.sources.length !== 1 ? 's' : ''}</p>
                  <div className="mt-4 flex justify-between">
                    <button 
                      className="text-red-400 hover:text-red-300 p-2 rounded-lg transition-all hover:bg-red-900/30 flex items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDeck(deck.id);
                      }}
                    >
                      <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                      <span className="text-sm">Delete</span>
                    </button>
                    
                    <button 
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg"
                      onClick={() => {
                        setActiveDeck(deck);
                        setActiveCardIndex(0);
                        setShowCardBack(false);
                      }}
                    >
                      Study
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-xl mb-2 text-primary-100">No Notecard Decks Yet</h3>
              <p className="text-primary-400 mb-6">Create notecards from your lecture content</p>
              <button 
                onClick={() => setShowModal(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-all shadow-md hover:shadow-lg"
              >
                Create Notecards
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Modal for creating new notecards */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
          <div className="bg-primary-900 border-primary-700 border rounded-xl p-6 w-full max-w-3xl h-[80vh] shadow-2xl flex flex-col">
            <h2 className="text-xl font-medium mb-4 text-primary-100">Create New Notecard Deck</h2>
            
            {isGenerating ? (
              <div className="text-center py-8 flex-grow flex flex-col items-center justify-center">
                <p className="mb-4 text-primary-300">Generating notecards from selected content...</p>
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-primary-400 text-sm">This may take a moment</p>
              </div>
            ) : (
              <>
                <div className="flex border-b border-primary-800 mb-4">
                  <button 
                    className={`px-4 py-2 ${activeTab === 'lectures' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-primary-400 hover:text-primary-300'}`}
                    onClick={() => setActiveTab('lectures')}
                  >
                    Lectures ({lectures.filter(l => l.selected).length} selected)
                  </button>
                  <button 
                    className={`px-4 py-2 ${activeTab === 'assignments' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-primary-400 hover:text-primary-300'}`}
                    onClick={() => setActiveTab('assignments')}
                  >
                    Assignments ({assignments.filter(a => a.selected).length} selected)
                  </button>
                </div>
                
                <div className="flex-grow overflow-y-auto pr-2 mb-4">
                  {activeTab === 'lectures' ? (
                    lectures.length === 0 ? (
                      <p className="text-primary-400 text-center py-4">
                        No lectures found. Add lectures with the Chrome extension.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {lectures.map(lecture => (
                          <div 
                            key={lecture.id}
                            onClick={() => toggleLectureSelection(lecture.id)}
                            className={`p-3 rounded-lg cursor-pointer transition-all ${
                              lecture.selected
                                ? 'bg-primary-700/80 border-blue-500 border shadow-md'
                                : 'bg-primary-800/60 border-primary-700 border hover:bg-primary-700/60 hover:shadow-md'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <p className="font-medium text-primary-100">
                                {lecture.title || `Lecture ${lecture.recording_id?.substring(0, 8) || ""}`}
                              </p>
                              <span 
                                style={{ backgroundColor: getCourseColor(lecture.course_name || "") }}
                                className="rounded-full px-3 py-1 text-xs shadow-sm"
                              >
                                {lecture.course_name}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-primary-400 text-xs">
                                {lecture.formatted_text ? `${Math.round(lecture.formatted_text.length / 100)} paragraphs` : "No transcript"}
                              </p>
                              <div className="flex items-center text-xs font-medium">
                                <div className={`w-4 h-4 rounded-sm border mr-2 flex items-center justify-center ${lecture.selected ? 'bg-blue-500 border-blue-600' : 'border-primary-600'}`}>
                                  {lecture.selected && (
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                    </svg>
                                  )}
                                </div>
                                {lecture.selected ? "Selected" : "Select"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    assignments.length === 0 ? (
                      <p className="text-primary-400 text-center py-4">
                        No assignments found. Add assignments with the Chrome extension.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {assignments.map(assignment => (
                          <div 
                            key={assignment.id}
                            onClick={() => toggleAssignmentSelection(assignment.id)}
                            className={`p-3 rounded-lg cursor-pointer transition-all ${
                              assignment.selected
                                ? 'bg-primary-700/80 border-blue-500 border shadow-md'
                                : 'bg-primary-800/60 border-primary-700 border hover:bg-primary-700/60 hover:shadow-md'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <p className="font-medium text-primary-100">
                                {assignment.title}
                              </p>
                              <span 
                                style={{ backgroundColor: getCourseColor(assignment.course_name || "") }}
                                className="rounded-full px-3 py-1 text-xs shadow-sm"
                              >
                                {assignment.course_name}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-primary-400 text-xs">
                                {assignment.description ? `${Math.min(100, Math.round(assignment.description.length / 10))} words` : "No description"}
                              </p>
                              <div className="flex items-center text-xs font-medium">
                                <div className={`w-4 h-4 rounded-sm border mr-2 flex items-center justify-center ${assignment.selected ? 'bg-blue-500 border-blue-600' : 'border-primary-600'}`}>
                                  {assignment.selected && (
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                    </svg>
                                  )}
                                </div>
                                {assignment.selected ? "Selected" : "Select"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
                
                <div className="border-t border-primary-800 pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <label htmlFor="cardsPerSource" className="text-primary-300 text-sm mr-2">
                        Cards per source:
                      </label>
                      <input 
                        id="cardsPerSource"
                        type="number" 
                        min="1" 
                        max="20" 
                        value={cardsPerSource} 
                        onChange={(e) => setCardsPerSource(Number(e.target.value))}
                        className="bg-primary-800 border border-primary-700 rounded px-2 py-1 text-sm w-16 text-primary-200"
                      />
                    </div>
                    <div className="text-primary-300 text-sm">
                      {getSelectedCount()} source{getSelectedCount() !== 1 ? 's' : ''} selected
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button 
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 rounded-lg text-sm bg-primary-700/70 hover:bg-primary-600 text-primary-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={generateNotecards}
                      disabled={getSelectedCount() === 0}
                      className={`px-4 py-2 rounded-lg text-sm transition-all ${
                        getSelectedCount() === 0
                          ? 'bg-primary-700/50 text-primary-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg'
                      }`}
                    >
                      Generate {getSelectedCount() > 0 ? `(${getSelectedCount() * cardsPerSource} cards)` : ''}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 