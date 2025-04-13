# supabase_client.py
import os
from supabase import create_client, Client
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
import uuid
from datetime import datetime

# Load environment variables
load_dotenv()

class SupabaseClient:
    def __init__(self):
        """Initialize Supabase client with environment variables"""
        self.url = os.environ.get("SUPABASE_URL")
        self.key = os.environ.get("SUPABASE_KEY")
        
        # Check if service role key is available (bypasses RLS)
        service_key = os.environ.get("SUPABASE_SERVICE_KEY")
        if service_key:
            self.key = service_key
            
        if not self.url or not self.key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment variables")
            
        self.client = create_client(self.url, self.key)
    
    def get_transcript(self, transcript_id: str) -> Optional[Dict[str, Any]]:
        """Get a transcript from zoom_transcripts table by ID"""
        response = self.client.table('zoom_transcripts').select('*').eq('id', transcript_id).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    
    def get_transcripts(self, user_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Get all transcripts, optionally filtered by user_id"""
        query = self.client.table('zoom_transcripts').select('*')
        
        if user_id:
            query = query.eq('user_id', user_id)
            
        query = query.limit(limit)
        response = query.execute()
        return response.data
    
    def get_assignment(self, assignment_id: str) -> Optional[Dict[str, Any]]:
        """Get an assignment from assignments table by ID"""
        response = self.client.table('assignments').select('*').eq('id', assignment_id).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    
    def get_assignments(self, course_id: Optional[str] = None, user_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Get all assignments, optionally filtered by course_id or user_id"""
        query = self.client.table('assignments').select('*')
        
        if course_id:
            query = query.eq('course_id', course_id)
            
        if user_id:
            query = query.eq('user_id', user_id)
            
        query = query.limit(limit)
        response = query.execute()
        return response.data
    
    def count_documents(self) -> Dict[str, int]:
        """Count documents by type in Supabase"""
        try:
            transcripts_count = len(self.client.table('zoom_transcripts').select('id').execute().data)
            assignments_count = len(self.client.table('assignments').select('id').execute().data)
            
            return {
                "transcripts": transcripts_count,
                "assignments": assignments_count,
                "total": transcripts_count + assignments_count
            }
        except Exception as e:
            print(f"Error counting documents: {e}")
            return {"transcripts": 0, "assignments": 0, "total": 0}
    
    def add_transcript(self, 
                      content: str, 
                      title: Optional[str] = None, 
                      user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Add a transcript to the zoom_transcripts table
        
        Args:
            content: The transcript text
            title: Optional title for the transcript
            user_id: Optional user ID who owns the transcript
        
        Returns:
            Dictionary with details of the created transcript
        """
        document_id = str(uuid.uuid4())
        
        transcript_data = {
            "id": document_id,
            "user_id": user_id,
            "transcript_data": content,
            "formatted_text": content,
            "created_at": datetime.now().isoformat()
        }
        
        response = self.client.table('zoom_transcripts').insert(transcript_data).execute()
        
        if not response.data:
            raise Exception("Failed to insert transcript into Supabase")
            
        return {
            "id": document_id,
            "title": title or f"Transcript {document_id[:8]}",
            "content_length": len(content),
            "created_at": datetime.now().isoformat()
        }
    
    def add_assignment(self, 
                      title: str,
                      description: str,
                      course_id: Optional[str] = None,
                      user_id: Optional[str] = None,
                      due_date: Optional[str] = None,
                      points: int = 0) -> Dict[str, Any]:
        """
        Add an assignment to the assignments table
        
        Args:
            title: Title of the assignment
            description: Assignment description/content
            course_id: Optional course ID
            user_id: Optional user ID who owns the assignment
            due_date: Optional due date
            points: Optional points value
        
        Returns:
            Dictionary with details of the created assignment
        """
        document_id = str(uuid.uuid4())
        
        assignment_data = {
            "id": document_id,
            "user_id": user_id,
            "course_id": course_id,
            "title": title,
            "description": description,
            "due_date": due_date or "",
            "points": points,
            "status": "active",
            "created_at": datetime.now().isoformat()
        }
        
        response = self.client.table('assignments').insert(assignment_data).execute()
        
        if not response.data:
            raise Exception("Failed to insert assignment into Supabase")
            
        return {
            "id": document_id,
            "title": title,
            "content_length": len(description),
            "created_at": datetime.now().isoformat()
        }
    
    def delete_document(self, document_id: str, user_id: Optional[str] = None) -> bool:
        """
        Delete a document (transcript or assignment)
        
        Args:
            document_id: The ID of the document to delete
            user_id: Optional user ID for permission checking
        
        Returns:
            True if document was deleted, False otherwise
        """
        # Try to find and delete from transcripts
        transcript_query = self.client.table('zoom_transcripts')
        
        # Add user check if provided
        if user_id:
            transcript_query = transcript_query.eq('user_id', user_id)
            
        transcript_response = transcript_query.delete().eq('id', document_id).execute()
        
        if transcript_response.data and len(transcript_response.data) > 0:
            return True
            
        # Try to find and delete from assignments
        assignment_query = self.client.table('assignments')
        
        # Add user check if provided
        if user_id:
            assignment_query = assignment_query.eq('user_id', user_id)
            
        assignment_response = assignment_query.delete().eq('id', document_id).execute()
        
        if assignment_response.data and len(assignment_response.data) > 0:
            return True
            
        # Not found in either table
        return False