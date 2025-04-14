#app.py
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Set
import uuid
import time
import os
import json
import traceback
import asyncio
from datetime import datetime
from supabase_client import SupabaseClient
from auth_middleware import get_current_user

# Initialize Supabase client
supabase_client = SupabaseClient()

# Import our custom logging configuration
from logging_config import setup_logging

# Configure logging
logger = setup_logging("rag_api")

# Import our RAG implementation
from rag_system import RAGSystem

# Initialize the app
app = FastAPI(
    title="RAG API Service",
    description="API for Retrieval Augmented Generation using Local Embeddings and OpenRouter LLM",
    version="1.0.0"
)

logger.info("Starting RAG API Service")

# Add CORS middleware for browser access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize RAG system
logger.info("Initializing RAG system")
rag_system = RAGSystem()
logger.info("RAG system initialized")

# Pydantic models for request/response validation
class DocumentRequest(BaseModel):
    content: str
    title: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class DocumentResponse(BaseModel):
    document_id: str
    title: Optional[str]
    document_type: str
    content_length: int
    created_at: str

class QueryRequest(BaseModel):
    query: str
    document_ids: List[str] = Field(default_factory=list)
    document_types: Optional[List[str]] = None
    exclude_ids: Optional[List[str]] = None
    top_k: int = 5
    model: str = "meta-llama/llama-3-8b-instruct"

class QueryResponse(BaseModel):
    query: str
    response: str
    retrieved_chunks: List[str] = Field(default_factory=list)
    processing_time: float
    document_count: int
    success: bool
    error: Optional[str] = None
    timestamp: str

# Database helper functions
def get_document(document_id: str):
    """Get a document from Supabase by ID, checking relevant tables (transcripts and assignments)"""
    logger.debug(f"Fetching document: {document_id}")
    try:
        # Check transcripts table
        transcript_response = supabase_client.client.table('zoom_transcripts').select('*').eq('id', document_id).execute()
        if transcript_response.data and len(transcript_response.data) > 0:
            data = transcript_response.data[0]
            
            # Format transcript data - handle both JSON and string formats
            transcript_content = ""
            if data.get("transcript_data"):
                if isinstance(data["transcript_data"], dict):
                    # If it's already a dictionary (parsed JSON)
                    transcript_content = json.dumps(data["transcript_data"])
                elif isinstance(data["transcript_data"], str):
                    # If it's a string, use it directly
                    transcript_content = data["transcript_data"]
                else:
                    # Try to convert to string
                    transcript_content = str(data["transcript_data"])
            
            # Use formatted_text if available and transcript_data is empty/None
            if not transcript_content and data.get("formatted_text"):
                transcript_content = data["formatted_text"]
            
            return {
                "id": data["id"],
                "title": f"Transcript {data.get('recording_id', '')[:8] if data.get('recording_id') else ''}",
                "document_type": "transcript",
                "content": transcript_content,
                "content_length": len(transcript_content),
                "created_at": data.get("created_at", datetime.now().isoformat())
            }
        
        # Try assignments
        assignment_response = supabase_client.client.table('assignments').select('*').eq('id', document_id).execute()
        if assignment_response.data and len(assignment_response.data) > 0:
            data = assignment_response.data[0]
            
            # Get the description content
            description_content = data.get("description", "")
            
            # If description is empty, create a summary from other fields
            if not description_content:
                description_content = f"Assignment title: {data.get('title', '')}\n"
                description_content += f"Points: {data.get('points', '0')}\n"
                description_content += f"Due date: {data.get('due_date', 'Not specified')}\n"
                description_content += f"Status: {data.get('status', 'Not specified')}\n"
            
            return {
                "id": data["id"],
                "title": data.get("title", ""),
                "document_type": "assignment",
                "content": description_content,
                "content_length": len(description_content),
                "course_id": data.get("course_id"),
                "points": data.get("points"),
                "due_date": data.get("due_date"),
                "status": data.get("status"),
                "created_at": data.get("created_at", datetime.now().isoformat())
            }
                
        logger.warning(f"Document not found: {document_id}")
        return None
        
    except Exception as e:
        logger.error(f"Error fetching document {document_id}: {e}")
        logger.debug(traceback.format_exc())
        return None

def get_documents(document_types: Optional[Set[str]] = None, exclude_ids: Optional[Set[str]] = None):
    """
    Get all documents from Supabase
    
    Args:
        document_types: Optional set of document types to include ("transcript", "assignment")
        exclude_ids: Optional set of document IDs to exclude
    """
    logger.debug(f"Fetching documents with filters - types: {document_types}, exclude: {exclude_ids}")
    try:
        # Collect documents from all relevant tables
        all_documents = []
        
        # Set defaults if not provided
        if document_types is None:
            document_types = {"transcript", "assignment"}
        
        if exclude_ids is None:
            exclude_ids = set()
        
        # Get transcripts if requested
        if "transcript" in document_types:
            transcripts = supabase_client.get_transcripts()
            for transcript in transcripts:
                if transcript["id"] not in exclude_ids:
                    # Format transcript data
                    transcript_content = ""
                    if transcript.get("transcript_data"):
                        if isinstance(transcript["transcript_data"], dict):
                            transcript_content = json.dumps(transcript["transcript_data"])
                        elif isinstance(transcript["transcript_data"], str):
                            transcript_content = transcript["transcript_data"]
                        else:
                            transcript_content = str(transcript["transcript_data"])
                    
                    # Use formatted_text if available and transcript_data is empty/None
                    if not transcript_content and transcript.get("formatted_text"):
                        transcript_content = transcript["formatted_text"]
                    
                    all_documents.append({
                        "id": transcript["id"],
                        "title": f"Transcript {transcript.get('recording_id', '')}",
                        "document_type": "transcript",
                        "content": transcript_content,
                        "content_length": len(transcript_content),
                        "metadata": {
                            "type": "transcript",
                            "recording_id": transcript.get("recording_id", ""),
                            "url": transcript.get("url", "")
                        },
                        "created_at": transcript.get("created_at")
                    })
        
        # Get assignments if requested
        if "assignment" in document_types:
            assignments = supabase_client.get_assignments()
            for assignment in assignments:
                if assignment["id"] not in exclude_ids:
                    # Get the description content
                    description_content = assignment.get("description", "")
                    
                    # If description is empty, create a summary from other fields
                    if not description_content:
                        description_content = f"Assignment title: {assignment.get('title', '')}\n"
                        description_content += f"Points: {assignment.get('points', '0')}\n"
                        description_content += f"Due date: {assignment.get('due_date', 'Not specified')}\n"
                        description_content += f"Status: {assignment.get('status', 'Not specified')}\n"
                    
                    all_documents.append({
                        "id": assignment["id"],
                        "title": assignment["title"],
                        "document_type": "assignment",
                        "content": description_content,
                        "content_length": len(description_content),
                        "metadata": {
                            "type": "assignment",
                            "course_id": assignment.get("course_id", ""),
                            "points": assignment.get("points", 0),
                            "due_date": assignment.get("due_date", ""),
                            "status": assignment.get("status", "")
                        },
                        "created_at": assignment.get("created_at")
                    })
        
        logger.debug(f"Found {len(all_documents)} documents")
        return all_documents
        
    except Exception as e:
        logger.error(f"Error fetching documents: {e}")
        logger.debug(traceback.format_exc())
        return []

def extract_transcript_content(transcript_data):
    """
    Extract readable text content from transcript data, handling different formats
    
    Args:
        transcript_data: Transcript data which could be in different formats
        
    Returns:
        String containing the transcript text
    """
    if not transcript_data:
        return ""
    
    # If it's already a string, return it
    if isinstance(transcript_data, str):
        return transcript_data
    
    # If it's a dictionary
    if isinstance(transcript_data, dict):
        # Try common transcript JSON formats
        
        # Format 1: Array of entries with text fields
        if "transcript" in transcript_data and isinstance(transcript_data["transcript"], list):
            entries = transcript_data["transcript"]
            return "\n".join([entry.get("text", "") for entry in entries if "text" in entry])
        
        # Format 2: Directly contains text chunks with keys like "0", "1", etc.
        if all(key.isdigit() for key in transcript_data.keys() if key != "metadata"):
            return "\n".join([transcript_data.get(key, "") for key in transcript_data.keys() if key.isdigit()])
            
        # Format 3: Contains a single "text" field
        if "text" in transcript_data:
            return transcript_data["text"]
        
        # If we can't recognize the format, convert the whole dict to a string
        return json.dumps(transcript_data)
    
    # If it's a list
    if isinstance(transcript_data, list):
        # Try to extract text from each item if they're dictionaries
        if all(isinstance(item, dict) for item in transcript_data):
            return "\n".join([item.get("text", "") for item in transcript_data if "text" in item])
        
        # Otherwise, just join the items as strings
        return "\n".join([str(item) for item in transcript_data])
    
    # Default case: convert to string
    return str(transcript_data)

# Authentication test endpoints
@app.get("/auth/test")
async def test_auth(current_user: Dict = Depends(get_current_user)):
    """
    Test endpoint to verify if authentication is working correctly.
    
    This endpoint requires authentication and returns the decoded token information.
    """
    return {
        "success": True,
        "message": "Authentication successful",
        "user_id": current_user.get("sub"),
        "user_info": {
            "sub": current_user.get("sub"),
            "email": current_user.get("email"),
            "role": current_user.get("role"),
            "exp": datetime.fromtimestamp(current_user.get("exp")).isoformat() if current_user.get("exp") else None,
            "iat": datetime.fromtimestamp(current_user.get("iat")).isoformat() if current_user.get("iat") else None
        }
    }

@app.get("/auth/debug-token/{token}")
async def debug_token(token: str):
    """
    Debug endpoint to decode a JWT token without verifying the signature.
    
    Warning: This endpoint should be disabled in production.
    """
    try:
        # Get JWT secret from environment
        jwt_secret = os.getenv("JWT_SECRET")
        
        # First try to fully verify the token
        try:
            import jwt
            verified_payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
            verification_status = "Successfully verified with JWT_SECRET"
        except Exception as verify_error:
            verified_payload = None
            verification_status = f"Verification failed: {str(verify_error)}"
        
        # Now decode without verification for debugging
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        
        # Check if sub claim exists and is valid
        sub = unverified_payload.get("sub")
        has_valid_sub = bool(sub) and len(str(sub)) > 10  # Basic check for UUID-like string
        
        # Check expiration
        exp = unverified_payload.get("exp")
        is_expired = False
        expiry_time = None
        
        if exp:
            expiry_time = datetime.fromtimestamp(exp).isoformat()
            is_expired = exp < datetime.now().timestamp()
        
        return {
            "success": True,
            "token_info": {
                "verification": verification_status,
                "verified": verified_payload is not None,
                "has_valid_sub": has_valid_sub,
                "is_expired": is_expired,
                "expiry_time": expiry_time,
                "unverified_payload": unverified_payload,
                "verified_payload": verified_payload
            },
            "jwt_secret_length": len(jwt_secret) if jwt_secret else 0,
            "jwt_secret_preview": jwt_secret[:5] + "..." if jwt_secret else None
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Could not decode token"
        }

@app.get("/auth/supabase-status")
async def supabase_auth_status(current_user: Optional[Dict] = Depends(get_current_user)):
    """
    Check Supabase auth configuration status
    
    This endpoint provides information about your Supabase auth configuration.
    """
    try:
        # Basic connection test
        connection_ok = False
        connection_error = None
        try:
            # Try a simple query to test connection
            response = supabase_client.client.table('zoom_transcripts').select('id').limit(1).execute()
            connection_ok = True
        except Exception as e:
            connection_error = str(e)
        
        return {
            "success": True,
            "authentication": {
                "is_authenticated": current_user is not None,
                "user_id": current_user.get("sub") if current_user else None,
            },
            "supabase_connection": {
                "url": supabase_client.url[:20] + "..." if supabase_client.url else None,  # Preview only
                "key_type": "service_key" if "service_role" in supabase_client.key else "anon_key" if supabase_client.key else "unknown",
                "connection_ok": connection_ok,
                "connection_error": connection_error
            },
            "environment": {
                "has_jwt_secret": bool(os.getenv("JWT_SECRET")),
                "has_user_id": bool(os.getenv("USER_ID")),
                "has_supabase_url": bool(os.getenv("SUPABASE_URL")),
                "has_supabase_key": bool(os.getenv("SUPABASE_KEY")),
                "has_service_key": bool(os.getenv("SUPABASE_SERVICE_KEY"))
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to check Supabase configuration"
        }

# API routes
@app.get("/")
async def root():
    """Root endpoint providing basic service information"""
    logger.debug("Root endpoint accessed")
    embeddings_type = "local" if hasattr(rag_system, 'sentence_transformer') and rag_system.sentence_transformer else "openai"
    return {
        "message": "RAG API Service", 
        "status": "running",
        "version": "1.0.0",
        "docs": "/docs",
        "embeddings": embeddings_type
    }

@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(None),
    document_type: str = Form("transcript"),
    course_id: Optional[str] = Form(None),
    current_user: Dict = Depends(get_current_user)
):
    """
    Upload a document file (txt, md, etc.) to the system
    """
    user_id = current_user.get("sub")
    logger.info(f"File upload endpoint called: {file.filename}, type: {document_type}")
    
    try:
        # Read file content
        content = await file.read()
        logger.debug(f"File read: {file.filename}, size: {len(content)} bytes")
        
        # Try to decode with utf-8, fallback to latin-1
        try:
            text_content = content.decode("utf-8")
            logger.debug("File decoded with UTF-8")
        except UnicodeDecodeError:
            logger.debug("UTF-8 decoding failed, falling back to Latin-1")
            text_content = content.decode("latin-1")
        
        # Generate document ID
        document_id = str(uuid.uuid4())
        logger.debug(f"Generated document ID: {document_id}")
        
        # Set title
        doc_title = title or file.filename or f"Document {document_id[:8]}"
        
        # Insert into appropriate table based on document_type
        if document_type == "transcript":
            # Process as transcript
            transcript_data = {
                "id": document_id,
                "user_id": user_id,
                "transcript_data": text_content,
                "formatted_text": text_content,
                "url": "",
                "created_at": datetime.now().isoformat()
            }
            response = supabase_client.client.table('zoom_transcripts').insert(transcript_data).execute()
            table_name = "zoom_transcripts"
            
        elif document_type == "assignment":
            # Process as assignment
            assignment_data = {
                "id": document_id,
                "user_id": user_id,
                "course_id": course_id,
                "title": doc_title,
                "description": text_content,
                "points": 0,
                "due_date": "",
                "status": "active",
                "created_at": datetime.now().isoformat()
            }
            response = supabase_client.client.table('assignments').insert(assignment_data).execute()
            table_name = "assignments"
        else:
            raise HTTPException(status_code=400, detail=f"Invalid document type: {document_type}")
        
        if not response.data:
            logger.error(f"Failed to insert document into {table_name}")
            raise HTTPException(status_code=500, detail=f"Failed to create document in {table_name}")
            
        logger.info(f"File uploaded successfully: {file.filename}, document ID: {document_id}")
        return {
            "document_id": document_id,
            "title": doc_title,
            "document_type": document_type,
            "content_length": len(text_content),
            "created_at": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"Error uploading file {file.filename}: {str(e)}")
        logger.debug(f"Error traceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

@app.get("/documents", response_model=List[DocumentResponse])
async def list_documents(document_type: Optional[str] = None, course_id: Optional[str] = None):
    """
    List all documents stored in the system, optionally filtered by type and course
    """
    logger.info(f"List documents endpoint called, type: {document_type}, course: {course_id}")
    
    try:
        all_documents = []
        
        # Determine which tables to query
        tables_to_query = []
        if document_type == "transcript" or document_type is None:
            tables_to_query.append("zoom_transcripts")
        if document_type == "assignment" or document_type is None:
            tables_to_query.append("assignments")
        
        # Query each table
        for table in tables_to_query:
            query = supabase_client.client.table(table).select('*')
            
            if course_id and table == "assignments":
                query = query.eq('course_id', course_id)
                
            data = query.execute().data
            
            for item in data:
                if table == "zoom_transcripts":
                    all_documents.append({
                        "document_id": item["id"],
                        "title": f"Transcript {item.get('recording_id', '')[:8]}",
                        "document_type": "transcript",
                        "content_length": len(str(item.get("transcript_data", ""))),
                        "created_at": item.get("created_at", "")
                    })
                elif table == "assignments":
                    all_documents.append({
                        "document_id": item["id"],
                        "title": item.get("title", ""),
                        "document_type": "assignment",
                        "content_length": len(item.get("description", "")),
                        "created_at": item.get("created_at", "")
                    })
        
        logger.debug(f"Found {len(all_documents)} documents")
        return all_documents
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"Error listing documents: {str(e)}")
        logger.debug(f"Error traceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Error listing documents: {str(e)}")

@app.get("/documents/{document_id}")
async def get_document_endpoint(document_id: str):
    """
    Get a specific document by ID with detailed information
    """
    logger.info(f"Get document endpoint called: {document_id}")
    
    try:
        document = get_document(document_id)
        if not document:
            logger.warning(f"Document not found: {document_id}")
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Format response to include more details
        response = {
            "document_id": document["id"],
            "title": document["title"],
            "document_type": document["document_type"],
            "content_length": len(document["content"]),
            "content_preview": document["content"][:200] + "..." if len(document["content"]) > 200 else document["content"],
            "created_at": document["created_at"]
        }
        
        # Add type-specific fields
        if document["document_type"] == "assignment":
            response.update({
                "course_id": document.get("course_id"),
                "points": document.get("points"),
                "due_date": document.get("due_date"),
                "status": document.get("status")
            })
        
        logger.debug(f"Document retrieved: {document_id}")
        return response
    except HTTPException:
        raise
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"Error retrieving document {document_id}: {str(e)}")
        logger.debug(f"Error traceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Error retrieving document: {str(e)}")

@app.delete("/documents/{document_id}")
async def delete_document_endpoint(document_id: str, current_user: Dict = Depends(get_current_user)):
    """
    Delete a document from the system
    """
    user_id = current_user.get("sub")
    logger.info(f"Delete document endpoint called: {document_id}")
    
    try:
        # Try to delete from zoom_transcripts
        transcript_query = supabase_client.client.table('zoom_transcripts').select('user_id').eq('id', document_id).execute()
        if transcript_query.data and len(transcript_query.data) > 0:
            # Check if current user owns the document
            doc_user_id = transcript_query.data[0].get('user_id')
            if doc_user_id != user_id:
                raise HTTPException(status_code=403, detail="You don't have permission to delete this document")
                
            response = supabase_client.client.table('zoom_transcripts').delete().eq('id', document_id).execute()
            if response.data and len(response.data) > 0:
                logger.info(f"Document deleted from zoom_transcripts: {document_id}")
                return {"message": f"Document {document_id} deleted"}
        
        # Try assignments
        assignment_query = supabase_client.client.table('assignments').select('user_id').eq('id', document_id).execute()
        if assignment_query.data and len(assignment_query.data) > 0:
            # Check if current user owns the document
            doc_user_id = assignment_query.data[0].get('user_id')
            if doc_user_id != user_id:
                raise HTTPException(status_code=403, detail="You don't have permission to delete this document")
                
            response = supabase_client.client.table('assignments').delete().eq('id', document_id).execute()
            if response.data and len(response.data) > 0:
                logger.info(f"Document deleted from assignments: {document_id}")
                return {"message": f"Document {document_id} deleted"}
        
        logger.warning(f"Document not found for deletion: {document_id}")
        raise HTTPException(status_code=404, detail="Document not found")
    except HTTPException:
        raise
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"Error deleting document {document_id}: {str(e)}")
        logger.debug(f"Error traceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Error deleting document: {str(e)}")

@app.post("/query", response_model=QueryResponse)
async def query(query_request: QueryRequest):
    """
    Process a query with document filtering
    """
    logger.info("Query endpoint called")
    logger.debug(f"Query details: {query_request.dict()}")
    
    start_time = time.time()
    
    # Set up document filtering
    document_types = set(query_request.document_types) if query_request.document_types else None
    exclude_ids = set(query_request.exclude_ids) if query_request.exclude_ids else None
    
    try:
        # If no specific document IDs are provided but filters are set,
        # get document IDs based on filters
        if not query_request.document_ids and (document_types or exclude_ids):
            filtered_docs = get_documents(document_types, exclude_ids)
            document_ids = [doc["id"] for doc in filtered_docs]
        else:
            document_ids = query_request.document_ids
            
        # Log document selection info
        logger.info(f"Query will use {len(document_ids)} documents")
        
        # Get documents content
        logger.debug(f"Retrieving {len(document_ids)} documents")
        all_docs_content = ""
        retrieved_docs = []
        
        for doc_id in document_ids:
            document = get_document(doc_id)
            if document:
                logger.debug(f"Document found: {doc_id}, length: {len(document['content'])} chars")
                all_docs_content += document["content"] + "\n\n"
                retrieved_docs.append(document)
            else:
                logger.warning(f"Document not found: {doc_id}")
        
        if not all_docs_content and document_ids:
            logger.warning("No valid documents found")
            return QueryResponse(
                query=query_request.query,
                response="",
                retrieved_chunks=[],
                processing_time=time.time() - start_time,
                document_count=0,
                success=False,
                error="No valid documents found",
                timestamp=datetime.now().isoformat()
            )
        
        # Process through RAG
        logger.info(f"Processing through RAG, document length: {len(all_docs_content)} chars")
        
        result = rag_system.process_document(
            document=all_docs_content,
            query=query_request.query,
            chunks_to_retrieve=query_request.top_k
        )
        
        processing_time = time.time() - start_time
        logger.info(f"RAG processing complete in {processing_time:.2f}s, success: {result['success']}")
        
        return QueryResponse(
            query=query_request.query,
            response=result["response"] if result["success"] else "",
            retrieved_chunks=result["retrieved_chunks"] if "retrieved_chunks" in result else [],
            processing_time=processing_time,
            document_count=len(retrieved_docs),
            success=result["success"],
            error=result["error"] if not result["success"] else None,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"Error processing query: {str(e)}")
        logger.debug(f"Error traceback: {error_trace}")
        
        return QueryResponse(
            query=query_request.query,
            response="",
            retrieved_chunks=[],
            processing_time=time.time() - start_time,
            document_count=0,
            success=False,
            error=str(e),
            timestamp=datetime.now().isoformat()
        )

@app.get("/test")
async def test_endpoint():
    """Test endpoint to check if the server is working properly"""
    logger.info("Test endpoint accessed")
    
    # Return different values each time to verify it's actually executing
    import random
    test_id = random.randint(1000, 9999)
    
    return {
        "status": "ok", 
        "message": "Server is running correctly",
        "test_id": test_id,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/test/generate")
async def test_generation(request: Dict[str, str]):
    """Test just the response generation part of the pipeline"""
    query = request.get("query", "Summarize this text")
    context = request.get("context", "This is a test context.")
    model = request.get("model", "meta-llama/llama-3-8b-instruct")
    
    try:
        logger.info(f"Testing response generation with model: {model}")
        response = rag_system.generate_response(query, context, model)
        
        return {
            "success": not response.startswith("Error:"),
            "response": response,
            "query": query,
            "context_length": len(context),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error in test generation: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.post("/diagnostic/full-pipeline/{document_id}")
async def test_full_pipeline(document_id: str, query: str = "Summarize the main points"):
    """Test the complete RAG pipeline with detailed error tracking"""
    logger.info(f"Testing full RAG pipeline for document: {document_id} with query: {query}")
    
    results = {
        "document_id": document_id,
        "query": query,
        "steps": {},
        "overall_success": False,
        "timestamp": datetime.now().isoformat()
    }
    
    try:
        # Step 1: Retrieve document
        logger.debug(f"Retrieving document: {document_id}")
        document = get_document(document_id)
        if not document:
            results["error"] = f"Document {document_id} not found"
            return results
            
        document_content = document.get("content", "")
        document_type = document.get("document_type", "unknown")
        
        results["steps"]["document_retrieval"] = {
            "success": True,
            "document_type": document_type,
            "content_length": len(document_content),
            "word_count": len(document_content.split()) if document_content else 0
        }
        
        # Step 2: Chunk text
        logger.debug("Chunking document")
        try:
            chunks = rag_system.chunk_text(document_content)
            results["steps"]["chunking"] = {
                "success": True,
                "chunk_count": len(chunks),
                "chunks_sample": [c[:50] + "..." for c in chunks[:3]] if chunks else []
            }
        except Exception as e:
            logger.error(f"Chunking failed: {str(e)}")
            results["steps"]["chunking"] = {"success": False, "error": str(e)}
            results["error"] = f"Chunking failed: {str(e)}"
            return results
        
        # Step 3: Generate embeddings
        logger.debug("Generating embeddings")
        try:
            chunk_embeddings = rag_system.generate_embeddings(chunks)
            results["steps"]["embedding"] = {
                "success": True,
                "embedding_count": len(chunk_embeddings)
            }
        except Exception as e:
            logger.error(f"Embedding generation failed: {str(e)}")
            results["steps"]["embedding"] = {"success": False, "error": str(e)}
            results["error"] = f"Embedding generation failed: {str(e)}"
            return results
        
        # Step 4: Generate query embedding
        logger.debug("Generating query embedding")
        try:
            query_embedding = rag_system.generate_embeddings([query])[0]
            results["steps"]["query_embedding"] = {
                "success": True
            }
        except Exception as e:
            logger.error(f"Query embedding failed: {str(e)}")
            results["steps"]["query_embedding"] = {"success": False, "error": str(e)}
            results["error"] = f"Query embedding failed: {str(e)}"
            return results
        
        # Step 5: Retrieve relevant chunks
        logger.debug("Retrieving relevant chunks")
        try:
            indexed_chunks = list(zip(chunks, chunk_embeddings))
            relevant_chunks = rag_system.retrieve_chunks(
                query_embedding,
                indexed_chunks,
                k=5
            )
            results["steps"]["retrieval"] = {
                "success": True,
                "retrieved_count": len(relevant_chunks),
                "samples": [c[:50] + "..." for c in relevant_chunks[:2]] if relevant_chunks else []
            }
        except Exception as e:
            logger.error(f"Chunk retrieval failed: {str(e)}")
            results["steps"]["retrieval"] = {"success": False, "error": str(e)}
            results["error"] = f"Chunk retrieval failed: {str(e)}"
            return results
        
        # Step 6: Generate response
        logger.debug("Generating response")
        try:
            context = "\n\n".join(relevant_chunks)
            response = rag_system.generate_response(query, context)
            
            if response.startswith("Error:"):
                results["steps"]["response_generation"] = {
                    "success": False,
                    "error": response
                }
                results["error"] = f"Response generation failed: {response}"
            else:
                results["steps"]["response_generation"] = {
                    "success": True,
                    "context_length": len(context),
                    "response_sample": response[:100] + "..." if len(response) > 100 else response
                }
                results["response"] = response
        except Exception as e:
            logger.error(f"Response generation failed: {str(e)}")
            results["steps"]["response_generation"] = {"success": False, "error": str(e)}
            results["error"] = f"Response generation failed: {str(e)}"
            return results
        
        # Overall success
        if all(step.get("success", False) for step in results["steps"].values()):
            results["overall_success"] = True
            
        return results
        
    except Exception as e:
        logger.error(f"Full pipeline test error: {str(e)}")
        results["error"] = f"Full pipeline failed: {str(e)}"
        return results

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting server directly from app.py")
    uvicorn.run(app, host="0.0.0.0", port=8000)