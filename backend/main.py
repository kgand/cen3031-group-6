from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Union
import os
from dotenv import load_dotenv
from supabase import create_client, Client
import jwt
from datetime import datetime, timedelta
import importlib
import logging
import uuid
import json
import time
import random
import requests
import re  # Add at the top with other imports

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="FaciliGator API", description="Backend API for FaciliGator Chrome Extension")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
JWT_SECRET = os.getenv("JWT_SECRET")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize service role client for admin operations
try:
    supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    logger.info("Supabase admin client initialized successfully")
except Exception as e:
    logger.warning(f"Failed to initialize Supabase admin client: {str(e)}")
    supabase_admin = supabase  # Fallback to regular client if admin fails

# Models
class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    email: str
    email_confirmation_required: Optional[bool] = None

class Assignment(BaseModel):
    title: str
    url: str
    dueDate: Optional[str] = None
    description: Optional[str] = None
    rubric: Optional[list] = None
    courseId: str
    assignmentGroup: Optional[str] = "Uncategorized"
    points: float = 0  # Default to 0 points
    status: str = "Not Started"  # Default status

class AssignmentSubmission(BaseModel):
    courseId: str
    assignments: list[Assignment]
    upload_batch_id: Optional[str] = None  # Batch ID to group assignments by upload session

class ZoomRecording(BaseModel):
    title: str
    url: str
    date: Optional[str] = None
    host: Optional[str] = None
    courseId: str

class ZoomRecordingSubmission(BaseModel):
    courseId: str
    recordings: list[ZoomRecording]
    upload_batch_id: Optional[str] = None  # Batch ID to group recordings by upload session

class ZoomTranscript(BaseModel):
    recording_id: str
    transcript_data: List[Dict]
    formatted_text: Optional[str] = ""
    url: Optional[str] = None
    segment_count: Optional[int] = None

class ContentSelection(BaseModel):
    lecture_ids: List[str] = []
    assignment_ids: List[str] = []

class NotecardGeneration(BaseModel):
    title: Optional[str] = "Generated Notecards"
    content_selection: ContentSelection
    cards_per_source: int = 10

class QuizGeneration(BaseModel):
    content_selection: ContentSelection
    questions_per_source: int = 5
    difficulty: str = "medium"  # easy, medium, hard

# Helper functions
def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")
    return encoded_jwt

async def get_current_user(request: Request):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise credentials_exception
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    return {"user_id": user_id, "email": payload.get("email")}

async def get_current_user_id(current_user: dict = Depends(get_current_user)) -> str:
    """Extract user_id from the current user dict"""
    return current_user["user_id"]

# Routes
@app.get("/", response_class=HTMLResponse)
async def root():
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>FaciliGator API</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                background: #f8f9fa;
                color: #333;
                text-align: center;
                padding: 40px 20px;
                line-height: 1.6;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                border-radius: 8px;
                padding: 30px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            h1 {
                color: #1a73e8;
                margin-bottom: 20px;
            }
            .logo {
                font-size: 48px;
                color: #1a73e8;
                margin-bottom: 20px;
            }
            p {
                margin-bottom: 20px;
                color: #555;
            }
            .button {
                display: inline-block;
                background-color: #1a73e8;
                color: white;
                text-decoration: none;
                padding: 12px 24px;
                border-radius: 4px;
                font-weight: 500;
                margin-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">🐊</div>
            <h1>FaciliGator API</h1>
            <p>Welcome to the FaciliGator API server. This is the backend for the FaciliGator Chrome Extension.</p>
            <p>If you're seeing this page after confirming your email, please return to the extension to log in.</p>
        </div>
    </body>
    </html>
    """
    return html_content

@app.get("/ping")
async def ping():
    """Simple ping endpoint for checking if the API is running"""
    return {"status": "ok", "message": "API is running"}

@app.post("/auth/signup", response_model=Token)
async def signup(user: UserCreate):
    try:
        # Log the signup attempt for debugging
        logger.info(f"Signup attempt for email: {user.email}")
        
        # Check if user already exists before attempting to create
        try:
            # Try to get user by email
            user_response = supabase.auth.admin.list_users()
            existing_users = [u for u in user_response.users if u.email == user.email]
            
            if existing_users:
                logger.warning(f"Signup attempt with existing email: {user.email}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A user with this email already exists. Please use a different email or try logging in."
                )
        except Exception as check_error:
            # If we can't check (e.g., admin API not available), continue with signup
            # Supabase will still return an error if the user exists
            logger.warning(f"Could not pre-check user existence: {str(check_error)}")
        
        # Create user in Supabase
        response = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password,
        })
        
        # Log the response for debugging
        logger.info(f"Supabase signup response: {response}")
        
        if not response.user:
            logger.error("Supabase returned no user object")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user"
            )
        
        # Store additional user data if needed
        if user.full_name:
            try:
                supabase.table("profiles").insert({
                    "id": response.user.id,
                    "full_name": user.full_name,
                    "email": user.email
                }).execute()
            except Exception as profile_error:
                logger.error(f"Error storing profile data: {str(profile_error)}")
                # Continue with the signup process even if profile storage fails
        
        # Check if email confirmation is required
        if not response.user.email_confirmed_at:
            logger.info(f"Email confirmation required for user: {user.email}")
            # Create a token but indicate email confirmation is required
            access_token = create_access_token(
                data={"sub": response.user.id, "email": user.email}
            )
            
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "user_id": response.user.id,
                "email": user.email,
                "email_confirmation_required": True
            }
        
        # Create access token
        access_token = create_access_token(
            data={"sub": response.user.id, "email": user.email}
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": response.user.id,
            "email": user.email
        }
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions
        logger.error(f"HTTP Exception during signup: {http_ex.detail}")
        raise
    except Exception as e:
        # Log the error for debugging
        error_msg = str(e)
        logger.error(f"Signup error: {error_msg}")
        
        # Check if the error is related to an existing user
        if "User already registered" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists. Please use a different email or try logging in."
            )
        elif not error_msg or error_msg == "{}":
            # Handle the case where Supabase returns an empty error but still sends confirmation email
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account created, but there was an issue with the registration process. Please check your email for a confirmation link."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Registration failed: {error_msg}"
            )

@app.post("/auth/login", response_model=Token)
async def login(user: UserLogin):
    try:
        # Log the login attempt for debugging
        logger.info(f"Login attempt for email: {user.email}")
        
        # Sign in user with Supabase
        response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
        
        # Log the response for debugging
        logger.info(f"Supabase login response: {response}")
        
        if not response.user:
            logger.error("Supabase returned no user object")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        
        # Check if email is confirmed
        if not response.user.email_confirmed_at:
            logger.warning(f"Login attempt with unconfirmed email: {user.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not confirmed. Please check your inbox and confirm your email before logging in."
            )
        
        # Create access token
        access_token = create_access_token(
            data={"sub": response.user.id, "email": user.email}
        )
        
        logger.info(f"Successful login for user: {user.email}")
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": response.user.id,
            "email": user.email
        }
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions to preserve their status code and detail
        logger.error(f"HTTP Exception during login: {http_ex.detail}")
        raise
    except Exception as e:
        # Log the error for debugging
        error_msg = str(e)
        logger.error(f"Login error: {error_msg}")
        
        # Check if the error message indicates an unconfirmed email
        if "Email not confirmed" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not confirmed. Please check your inbox and confirm your email before logging in."
            )
        elif "Invalid login credentials" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )

@app.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@app.post("/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    # Note: JWT tokens can't be invalidated server-side
    # Client should remove the token from storage
    return {"message": "Successfully logged out"}

@app.post("/assignments/store")
async def store_assignments(submission: AssignmentSubmission, current_user: dict = Depends(get_current_user)):
    try:
        # Get user ID from the authenticated user
        user_id = current_user["user_id"]
        
        # Generate a batch ID if not provided
        upload_batch_id = submission.upload_batch_id
        if not upload_batch_id:
            upload_batch_id = str(uuid.uuid4())
            logger.info(f"Generated new upload batch ID: {upload_batch_id}")
        
        # Format data for insertion
        assignments_data = []
        for assignment in submission.assignments:
            assignments_data.append({
                "user_id": user_id,
                "course_id": submission.courseId,
                "title": assignment.title,
                "url": assignment.url,
                "due_date": assignment.dueDate,
                "description": assignment.description,
                "rubric": assignment.rubric,
                "assignment_group": assignment.assignmentGroup or "Uncategorized",
                "points": assignment.points if hasattr(assignment, 'points') else 0,
                "status": assignment.status if hasattr(assignment, 'status') else "Not Started",
                "upload_batch_id": upload_batch_id,  # Add the batch ID to each assignment
                "created_at": datetime.utcnow().isoformat()
            })
        
        # Insert data into Supabase
        response = supabase.table("assignments").insert(assignments_data).execute()
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Supabase error: {response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to store assignments: {response.error}")
        
        # Return success with the batch ID for client reference
        return {
            "status": "success", 
            "message": f"Successfully stored {len(assignments_data)} assignments",
            "upload_batch_id": upload_batch_id,
            "count": len(assignments_data)
        }
    
    except Exception as e:
        logger.error(f"Error storing assignments: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to store assignments: {str(e)}")

@app.get("/assignments/batch/{batch_id}")
async def get_assignments_by_batch(batch_id: str, current_user: dict = Depends(get_current_user)):
    try:
        # Get user ID from the authenticated user
        user_id = current_user["user_id"]
        
        # Query assignments by batch ID and user ID
        response = supabase.table("assignments").select("*").eq("upload_batch_id", batch_id).eq("user_id", user_id).execute()
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Supabase error: {response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve assignments: {response.error}")
        
        # Get the assignments from the response
        assignments = response.data
        
        if not assignments:
            return {
                "status": "success",
                "message": "No assignments found for this batch ID",
                "assignments": []
            }
        
        # Return the assignments
        return {
            "status": "success",
            "message": f"Found {len(assignments)} assignments for batch ID {batch_id}",
            "assignments": assignments,
            "upload_batch_id": batch_id
        }
    
    except Exception as e:
        logger.error(f"Error retrieving assignments by batch: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve assignments: {str(e)}")

@app.get("/assignments/user")
async def get_user_assignments(current_user: dict = Depends(get_current_user)):
    """Get all assignments for the current user"""
    try:
        # Get user ID from the authenticated user
        user_id = current_user["user_id"]
        
        # Query all assignments for the user
        response = supabase.table("assignments").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Supabase error: {response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve assignments: {response.error}")
        
        # Get the assignments from the response
        assignments = response.data
        
        # Return the assignments
        return {
            "status": "success",
            "message": f"Found {len(assignments)} assignments",
            "assignments": assignments
        }
    
    except Exception as e:
        logger.error(f"Error retrieving assignments: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve assignments: {str(e)}")

# ==================== ZOOM TRANSCRIPT RELATED MODELS AND ENDPOINTS ====================

@app.post("/dev/sql")
async def run_sql(sql_or_request: Union[str, Dict], current_user: dict = Depends(get_current_user)):
    """DEVELOPMENT ONLY: Run a SQL query directly via the exec_sql RPC function"""
    try:
        # Handle both string SQL and request body with sql field
        if isinstance(sql_or_request, dict):
            sql = sql_or_request.get("sql")
        else:
            sql = sql_or_request  # Direct string SQL
            
        logger.warning(f"DEVELOPMENT: Attempting to run SQL via exec_sql RPC: {sql[:200]}...")
        
        # Directly try calling the exec_sql RPC function
        sql_result = supabase.rpc("exec_sql", {"sql": sql}).execute()
        logger.info(f"exec_sql RPC executed. Response: {sql_result}")
        
        # Check for errors in the Supabase response itself
        if hasattr(sql_result, 'error') and sql_result.error:
             logger.error(f"Supabase RPC error object: {sql_result.error}")
             raise Exception(f"Supabase RPC Error: {sql_result.error}")
        
        return {
            "status": "success",
            "message": "SQL executed successfully via RPC",
            "result": sql_result.data if hasattr(sql_result, 'data') else None # Return data if available
        }
    except Exception as e:
        error_type = type(e).__name__
        error_repr = repr(e)
        logger.error(f"Failed to run SQL via RPC. Type: {error_type}, Repr: {error_repr}")
        raise HTTPException(status_code=500, detail=f"Failed to run SQL via RPC: {error_type} - {error_repr}")

@app.post("/dev/create-tables")
async def create_tables(current_user: dict = Depends(get_current_user)):
    """DEVELOPMENT ONLY: Create required tables if they don't exist"""
    try:
        logger.warning("DEVELOPMENT: Creating tables if they don't exist")
        
        # SQL to create the zoom_recordings table if it doesn't exist
        create_recordings_table_sql = """
        CREATE TABLE IF NOT EXISTS zoom_recordings (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id uuid NOT NULL,
            course_id text NOT NULL,
            title text NOT NULL,
            url text NOT NULL,
            date text,
            host text,
            upload_batch_id text,
            transcript_processed boolean DEFAULT false,
            transcript_error text,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone
        );
        
        -- Ensure RLS is disabled for development
        ALTER TABLE zoom_recordings DISABLE ROW LEVEL SECURITY;
        
        -- Create policy that allows all operations for the same user_id
        DROP POLICY IF EXISTS allow_user_access ON zoom_recordings;
        CREATE POLICY allow_user_access ON zoom_recordings
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid());
        """
        
        # SQL to create the zoom_transcripts table if it doesn't exist
        create_transcripts_table_sql = """
        CREATE TABLE IF NOT EXISTS zoom_transcripts (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            recording_id uuid REFERENCES zoom_recordings(id),
            user_id uuid NOT NULL,
            transcript_data jsonb NOT NULL,
            formatted_text text NOT NULL,
            segment_count integer NOT NULL,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone
        );
        
        -- Ensure RLS is disabled for development
        ALTER TABLE zoom_transcripts DISABLE ROW LEVEL SECURITY;
        
        -- Create policy that allows all operations for the same user_id
        DROP POLICY IF EXISTS allow_user_access ON zoom_transcripts;
        CREATE POLICY allow_user_access ON zoom_transcripts
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid());
        """
        
        # Execute the SQL to create the tables
        recordings_result = await run_sql(create_recordings_table_sql, current_user)
        logger.info(f"Recordings table creation result: {recordings_result}")
        
        transcripts_result = await run_sql(create_transcripts_table_sql, current_user)
        logger.info(f"Transcripts table creation result: {transcripts_result}")
        
        return {
            "status": "success",
            "message": "Tables created or already exist",
            "recordings_result": recordings_result,
            "transcripts_result": transcripts_result
        }
    except Exception as e:
        logger.error(f"Failed to create tables: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create tables: {str(e)}")

@app.post("/zoom/store")
async def store_recordings(submission: ZoomRecordingSubmission, current_user: dict = Depends(get_current_user)):
    """Store Zoom recordings information from extension"""
    try:
        # Get user ID from the authenticated user
        user_id = current_user["user_id"]
        logger.info(f"User {user_id} is attempting to store {len(submission.recordings)} recordings")
        
        # Generate a batch ID if not provided
        upload_batch_id = submission.upload_batch_id
        if not upload_batch_id:
            upload_batch_id = str(uuid.uuid4())
            logger.info(f"Generated new Zoom upload batch ID: {upload_batch_id}")
        
        # Format data for insertion
        recordings_data = []
        for recording in submission.recordings:
            recordings_data.append({
                "user_id": user_id,
                "course_id": submission.courseId,
                "title": recording.title,
                "url": recording.url,
                "date": recording.date,
                "host": recording.host,
                "upload_batch_id": upload_batch_id,
                "transcript_processed": False,
                "created_at": datetime.utcnow().isoformat()
            })
        
        logger.info(f"Inserting {len(recordings_data)} recordings directly")
        
        # Insert the data using the standard client
        response = supabase.table("zoom_recordings").insert(recordings_data).execute()
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Supabase error: {response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to store recordings: {response.error}")
        
        # Get the inserted recordings with their IDs
        inserted_recordings = response.data
        
        # Return success with the batch ID for client reference
        return {
            "status": "success", 
            "message": f"Successfully stored {len(recordings_data)} recordings",
            "upload_batch_id": upload_batch_id,
            "recordings": inserted_recordings,
            "count": len(recordings_data)
        }
        
    except Exception as e:
        logger.error(f"Error storing recordings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to store recordings: {str(e)}")

@app.get("/zoom/recordings")
async def get_recordings(current_user: dict = Depends(get_current_user)):
    """Get all Zoom recordings for the current user"""
    try:
        # Get user ID from the authenticated user
        user_id = current_user["user_id"]
        
        # Query all recordings for the user
        response = supabase.table("zoom_recordings").select("*").eq("user_id", user_id).order("created_at", ascending=False).execute()
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Supabase error: {response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve recordings: {response.error}")
        
        # Get the recordings from the response
        recordings = response.data
        
        # Return the recordings
        return {
            "status": "success",
            "message": f"Found {len(recordings)} recordings",
            "recordings": recordings
        }
    
    except Exception as e:
        logger.error(f"Error retrieving recordings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve recordings: {str(e)}")

@app.get("/zoom/batch/{batch_id}")
async def get_recordings_by_batch(batch_id: str, current_user: dict = Depends(get_current_user)):
    """Get Zoom recordings by batch ID"""
    try:
        # Get user ID from the authenticated user
        user_id = current_user["user_id"]
        
        # Query recordings by batch ID and user ID
        response = supabase.table("zoom_recordings").select("*").eq("upload_batch_id", batch_id).eq("user_id", user_id).execute()
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Supabase error: {response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve recordings: {response.error}")
        
        # Get the recordings from the response
        recordings = response.data
        
        if not recordings:
            return {
                "status": "success",
                "message": "No recordings found for this batch ID",
                "recordings": []
            }
        
        # Return the recordings
        return {
            "status": "success",
            "message": f"Found {len(recordings)} recordings for batch ID {batch_id}",
            "recordings": recordings,
            "upload_batch_id": batch_id
        }
    
    except Exception as e:
        logger.error(f"Error retrieving recordings by batch: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve recordings: {str(e)}")

@app.get("/lectures/user")
async def get_user_lectures(current_user: dict = Depends(get_current_user)):
    """Get all lectures (zoom recordings with transcripts) for the current user"""
    try:
        # Get user ID from the authenticated user
        user_id = current_user["user_id"]
        
        # Query all zoom recordings for the user
        recordings_response = supabase.table("zoom_recordings").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        
        if hasattr(recordings_response, 'error') and recordings_response.error:
            logger.error(f"Supabase error: {recordings_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve lectures: {recordings_response.error}")
        
        # Get the recordings from the response
        recordings = recordings_response.data
        
        # For each recording, check if it has a transcript
        lectures = []
        for recording in recordings:
            recording_id = recording.get("id")
            lecture = recording.copy()
            
            # Check if transcript exists
            transcript_response = supabase.table("zoom_transcripts").select("*").eq("recording_id", recording_id).limit(1).execute()
            if transcript_response.data and len(transcript_response.data) > 0:
                # Add transcript data to the lecture
                transcript = transcript_response.data[0]
                lecture["transcript_data"] = transcript.get("transcript_data")
                lecture["formatted_text"] = transcript.get("formatted_text")
            
            lectures.append(lecture)
        
        # Return the lectures
        return {
            "status": "success",
            "message": f"Found {len(lectures)} lectures",
            "lectures": lectures
        }
    
    except Exception as e:
        logger.error(f"Error retrieving lectures: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve lectures: {str(e)}")

@app.post("/zoom/extract-transcript")
async def extract_transcript(recording: ZoomRecording, current_user: dict = Depends(get_current_user)):
    """Extract transcript from a Zoom recording"""
    try:
        # Import here to avoid loading heavy dependencies when not needed
        from zoom_transcript_scraper import scrape_zoom_transcript
        
        # Get user ID from the authenticated user
        user_id = current_user["user_id"]
        
        # Query the recording to verify it exists and belongs to the user
        recording_response = supabase.table("zoom_recordings").select("*").eq("url", recording.url).eq("user_id", user_id).execute()
        
        if hasattr(recording_response, 'error') and recording_response.error:
            logger.error(f"Supabase error: {recording_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to verify recording: {recording_response.error}")
        
        recordings = recording_response.data
        
        if not recordings:
            raise HTTPException(status_code=404, detail="Recording not found or does not belong to the current user")
        
        recording_id = recordings[0]["id"]
        
        # Extract transcript from Zoom recording
        logger.info(f"Extracting transcript from URL: {recording.url}")
        result = scrape_zoom_transcript(recording.url)
        
        if not result["success"]:
            logger.error(f"Failed to extract transcript: {result.get('error', 'Unknown error')}")
            
            # Update the recording to mark it as processed with error
            update_response = supabase.table("zoom_recordings").update({
                "transcript_processed": True,
                "transcript_error": result.get("error", "Unknown error"),
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", recording_id).execute()
            
            raise HTTPException(status_code=500, detail=f"Failed to extract transcript: {result.get('error', 'Unknown error')}")
        
        # Store the transcript in the database - MINIMAL DEBUG VERSION
        transcript_data = {
            "recording_id": recording_id,
            "user_id": user_id,
            # "transcript_data": transcript.transcript_data, # DEBUG: Removed
            # "formatted_text": transcript.formatted_text, # DEBUG: Removed
            # "segment_count": len(transcript.transcript_data), # DEBUG: Removed
            "created_at": datetime.utcnow().isoformat()
        }
        
        logger.info(f"DEBUG: Inserting MINIMAL transcript data: {transcript_data}")
        transcript_response = supabase.table("zoom_transcripts").insert(transcript_data).execute()
        
        # Log the full response from Supabase insert
        logger.info(f"Supabase insert transcript response object (minimal): {transcript_response}")
        
        if hasattr(transcript_response, 'error') and transcript_response.error:
            logger.error(f"Supabase error storing transcript: {transcript_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to store transcript: {transcript_response.error}")
        
        logger.info(f"Transcript stored successfully (based on Supabase response), updating recording status")
        
        # Update the recording to mark it as processed
        update_response = supabase.table("zoom_recordings").update({
            "transcript_processed": True,
            "transcript_error": None,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", recording_id).execute()
        logger.info(f"Updated recording {recording_id} status to processed")
        
        # Return the transcript data
        return {
            "status": "success",
            "message": f"Successfully extracted transcript with {result['segment_count']} segments",
            "recording_id": recording_id,
            "transcript": result
        }
    
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error extracting transcript: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to extract transcript: {str(e)}")

@app.post("/zoom/batch-extract")
async def batch_extract_transcripts(submission: ZoomRecordingSubmission, current_user: dict = Depends(get_current_user)):
    """Extract transcripts from multiple Zoom recordings"""
    try:
        # Import here to avoid loading heavy dependencies when not needed
        from zoom_transcript_scraper import scrape_zoom_transcript
        
        # Get user ID from the authenticated user
        user_id = current_user["user_id"]
        
        results = []
        for recording in submission.recordings:
            try:
                # Query the recording to verify it exists and belongs to the user
                recording_response = supabase.table("zoom_recordings").select("*").eq("url", recording.url).eq("user_id", user_id).execute()
                
                if hasattr(recording_response, 'error') and recording_response.error:
                    results.append({
                        "url": recording.url,
                        "success": False,
                        "error": f"Database error: {recording_response.error}"
                    })
                    continue
                
                recordings = recording_response.data
                
                if not recordings:
                    results.append({
                        "url": recording.url,
                        "success": False,
                        "error": "Recording not found or does not belong to the current user"
                    })
                    continue
                
                recording_id = recordings[0]["id"]
                
                # Extract transcript from Zoom recording
                logger.info(f"Extracting transcript from URL: {recording.url}")
                result = scrape_zoom_transcript(recording.url)
                
                if not result["success"]:
                    # Update the recording to mark it as processed with error
                    update_response = supabase.table("zoom_recordings").update({
                        "transcript_processed": True,
                        "transcript_error": result.get("error", "Unknown error"),
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("id", recording_id).execute()
                    
                    results.append({
                        "url": recording.url,
                        "recording_id": recording_id,
                        "success": False,
                        "error": result.get("error", "Unknown error")
                    })
                    continue
                
                # Store the transcript in the database
                transcript_data = {
                    "recording_id": recording_id,
                    "user_id": user_id,
                    "transcript_data": result["transcript_data"],
                    "formatted_text": result["formatted_text"],
                    "segment_count": result["segment_count"],
                    "created_at": datetime.utcnow().isoformat()
                }
                
                logger.info(f"Inserting transcript with {len(result['transcript_data'])} segments")
                transcript_response = supabase.table("zoom_transcripts").insert(transcript_data).execute()
                
                if hasattr(transcript_response, 'error') and transcript_response.error:
                    results.append({
                        "url": recording.url,
                        "recording_id": recording_id,
                        "success": False,
                        "error": f"Failed to store transcript: {transcript_response.error}"
                    })
                    continue
                
                # Update the recording to mark it as processed
                update_response = supabase.table("zoom_recordings").update({
                    "transcript_processed": True,
                    "transcript_error": None,
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", recording_id).execute()
                
                # Add successful result
                results.append({
                    "url": recording.url,
                    "recording_id": recording_id,
                    "success": True,
                    "segment_count": result["segment_count"]
                })
                
            except Exception as e:
                logger.error(f"Error processing recording {recording.url}: {str(e)}")
                results.append({
                    "url": recording.url,
                    "success": False,
                    "error": str(e)
                })
        
        # Count successes and failures
        successes = sum(1 for r in results if r["success"])
        failures = len(results) - successes
        
        # Return the results
        return {
            "status": "success",
            "message": f"Processed {len(results)} recordings: {successes} successful, {failures} failed",
            "results": results
        }
    
    except Exception as e:
        logger.error(f"Error in batch transcript extraction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process batch: {str(e)}")

@app.get("/zoom/transcript/{recording_id}")
async def get_transcript(recording_id: str, current_user: dict = Depends(get_current_user)):
    """Get transcript for a specific recording"""
    try:
        # Get user ID from the authenticated user
        user_id = current_user["user_id"]
        
        # Query the transcript
        response = supabase.table("zoom_transcripts").select("*").eq("recording_id", recording_id).eq("user_id", user_id).execute()
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Supabase error: {response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve transcript: {response.error}")
        
        transcripts = response.data
        
        if not transcripts:
            # Check if the recording exists but has no transcript
            recording_response = supabase.table("zoom_recordings").select("*").eq("id", recording_id).eq("user_id", user_id).execute()
            
            if hasattr(recording_response, 'error') and recording_response.error:
                logger.error(f"Supabase error: {recording_response.error}")
                raise HTTPException(status_code=500, detail=f"Failed to check recording: {recording_response.error}")
            
            recordings = recording_response.data
            
            if not recordings:
                raise HTTPException(status_code=404, detail="Recording not found or does not belong to the current user")
            
            return {
                "status": "not_found",
                "message": "No transcript found for this recording",
                "recording": recordings[0],
                "transcript": None
            }
        
        # Return the transcript
        return {
            "status": "success",
            "message": "Transcript found",
            "transcript": transcripts[0]
        }
    
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error retrieving transcript: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve transcript: {str(e)}")

@app.post("/zoom/store-transcript")
async def store_transcript(transcript: ZoomTranscript, current_user: dict = Depends(get_current_user)):
    """Store a transcript for a Zoom recording"""
    try:
        # Get user ID from the authenticated user
        user_id = current_user["user_id"]
        logger.info(f"User {user_id} storing transcript for recording {transcript.recording_id}")
        
        # Log detailed information about the received transcript data
        transcript_data_type = type(transcript.transcript_data).__name__
        transcript_data_length = len(transcript.transcript_data) if transcript.transcript_data else 0
        logger.info(f"Received transcript data: type={transcript_data_type}, length={transcript_data_length}")
        
        # Validate transcript data
        if not transcript.transcript_data or not isinstance(transcript.transcript_data, list) or len(transcript.transcript_data) == 0:
            logger.warning(f"Invalid transcript_data received. Type: {transcript_data_type}, Length: {transcript_data_length}")
            raise HTTPException(status_code=400, detail="Invalid transcript data: must be a non-empty list")
            
        # Check the first item structure
        if transcript_data_length > 0:
            first_item = transcript.transcript_data[0]
            logger.info(f"First transcript item: {first_item}")
            
            if not isinstance(first_item, dict):
                logger.warning(f"Invalid transcript item format. Expected dict, got {type(first_item).__name__}")
                raise HTTPException(status_code=400, detail="Invalid transcript data format: items must be dictionaries")
            
            # Check if it has the expected keys
            required_keys = ["text", "timestamp"]
            missing_keys = [key for key in required_keys if key not in first_item]
            if missing_keys:
                logger.warning(f"Transcript item missing required keys: {missing_keys}")
        
        # Ensure the recording exists and belongs to the user
        recording_response = supabase.table("zoom_recordings").select("*").eq("id", transcript.recording_id).eq("user_id", user_id).execute()
        if hasattr(recording_response, 'error') and recording_response.error:
            logger.error(f"Supabase error verifying recording: {recording_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to verify recording: {recording_response.error}")
        
        recordings = recording_response.data
        if not recordings:
            logger.warning(f"Recording {transcript.recording_id} not found or does not belong to user {user_id}")
            raise HTTPException(status_code=404, detail="Recording not found or does not belong to the current user")
        
        recording_id = recordings[0]["id"]
        logger.info(f"Verified recording with ID {recording_id}")
        
        # Convert nested dicts in transcript_data to ensure JSON compatibility
        cleaned_transcript_data = []
        for item in transcript.transcript_data:
            if isinstance(item, dict):
                # Convert any non-serializable values to strings
                cleaned_item = {}
                for k, v in item.items():
                    if isinstance(v, (str, int, float, bool, type(None))):
                        cleaned_item[k] = v
                    else:
                        cleaned_item[k] = str(v)
                cleaned_transcript_data.append(cleaned_item)
            else:
                # If item is not a dict, convert to a dict with a text field
                cleaned_transcript_data.append({"text": str(item)})
        
        # Calculate segment count
        segment_count = transcript.segment_count if transcript.segment_count is not None else len(cleaned_transcript_data)
        logger.info(f"Final segment count: {segment_count}")
        
        # Log sanitized data for debugging
        logger.info(f"Prepared cleaned transcript data with {len(cleaned_transcript_data)} items")
        if cleaned_transcript_data:
            logger.info(f"Sample items (first 2): {cleaned_transcript_data[:2]}")
        
        # Prepare final data for insert
        transcript_data_to_store = {
            "recording_id": recording_id,
            "user_id": user_id,
            "transcript_data": cleaned_transcript_data,
            "formatted_text": transcript.formatted_text or "",
            "segment_count": segment_count,
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Insert using Supabase client
        logger.info(f"Executing Supabase insert for transcript with {segment_count} segments")
        transcript_response = supabase.table("zoom_transcripts").insert(transcript_data_to_store).execute()
        
        if hasattr(transcript_response, 'error') and transcript_response.error:
            logger.error(f"Supabase error storing transcript: {transcript_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to store transcript: {transcript_response.error}")
        
        # Log response for debugging
        if hasattr(transcript_response, 'data') and transcript_response.data:
            logger.info(f"Transcript insert successful, got ID: {transcript_response.data[0].get('id')}")
        else:
            logger.warning("Transcript insert successful but no data returned")
        
        # Update the recording to mark it as processed
        update_response = supabase.table("zoom_recordings").update({
            "transcript_processed": True,
            "transcript_error": None,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", recording_id).execute()
        logger.info(f"Updated recording {recording_id} status to processed")
        
        # Return success response
        return {
            "status": "success",
            "message": "Transcript stored successfully",
            "recording_id": recording_id,
            "segment_count": segment_count
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        error_type = type(e).__name__
        error_repr = repr(e)
        logger.error(f"Error storing transcript. Type: {error_type}, Repr: {error_repr}")
        raise HTTPException(status_code=500, detail=f"Failed to store transcript: {error_type} - {error_repr}")

# ==================== END ZOOM TRANSCRIPT RELATED MODELS AND ENDPOINTS ====================

# ==================== DEVELOPMENT ENDPOINTS ====================

@app.post("/dev/rls/disable/{table}")
async def disable_rls_dev(table: str, current_user: dict = Depends(get_current_user)):
    """DEVELOPMENT ONLY: Disable RLS for a table to allow for testing"""
    # This endpoint should be disabled in production
    if os.getenv("ENVIRONMENT", "development") == "production":
        raise HTTPException(status_code=403, detail="This endpoint is disabled in production")
    
    try:
        logger.warning(f"DEVELOPMENT: Disabling RLS for table {table}")
        
        # Execute raw SQL to disable RLS
        sql = f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;"
        
        response = supabase_admin.rpc(
            "disable_rls", 
            {"table_name": table}
        ).execute()
        
        return {
            "status": "success",
            "message": f"RLS disabled for table {table}",
            "response": response
        }
    except Exception as e:
        logger.error(f"Failed to disable RLS: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to disable RLS: {str(e)}")

@app.post("/dev/rls/enable/{table}")
async def enable_rls_dev(table: str, current_user: dict = Depends(get_current_user)):
    """DEVELOPMENT ONLY: Enable RLS for a table after testing"""
    # This endpoint should be disabled in production
    if os.getenv("ENVIRONMENT", "development") == "production":
        raise HTTPException(status_code=403, detail="This endpoint is disabled in production")
    
    try:
        logger.warning(f"DEVELOPMENT: Enabling RLS for table {table}")
        
        # Execute raw SQL to enable RLS
        sql = f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;"
        
        response = supabase_admin.rpc(
            "enable_rls", 
            {"table_name": table}
        ).execute()
        
        return {
            "status": "success",
            "message": f"RLS enabled for table {table}",
            "response": response
        }
    except Exception as e:
        logger.error(f"Failed to enable RLS: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to enable RLS: {str(e)}")

# Add a development endpoint to get the raw transcript data by ID
@app.get("/dev/transcript/{transcript_id}")
async def get_raw_transcript(transcript_id: str, current_user: dict = Depends(get_current_user)):
    """DEVELOPMENT ONLY: Get the raw transcript data by ID for debugging"""
    # This endpoint should be disabled in production
    if os.getenv("ENVIRONMENT", "development") == "production":
        raise HTTPException(status_code=403, detail="This endpoint is disabled in production")
    
    try:
        logger.warning(f"DEVELOPMENT: Getting raw transcript data for transcript ID {transcript_id}")
        
        # Query the transcript
        response = supabase.table("zoom_transcripts").select("*").eq("id", transcript_id).execute()
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Supabase error: {response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve transcript: {response.error}")
        
        transcripts = response.data
        
        if not transcripts:
            raise HTTPException(status_code=404, detail="Transcript not found")
        
        transcript = transcripts[0]
        
        # Check if transcript_data exists and is not empty
        has_data = transcript.get("transcript_data") is not None
        data_length = len(transcript.get("transcript_data", [])) if has_data else 0
        logger.info(f"Transcript {transcript_id} has data: {has_data}, data length: {data_length}")
        
        if data_length > 0:
            # Log sample of the data
            sample = transcript["transcript_data"][:2] if data_length > 0 else []
            logger.info(f"Sample of transcript data: {sample}")
        
        return {
            "status": "success",
            "transcript": transcript,
            "has_data": has_data,
            "data_length": data_length
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error retrieving raw transcript: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve raw transcript: {str(e)}")

@app.delete("/lectures/{recording_id}")
async def delete_lecture(recording_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a lecture (zoom recording) and its associated transcript"""
    try:
        # Get user ID from the authenticated user
        user_id = current_user["user_id"]
        
        # First check if the recording exists and belongs to the user
        recording_response = supabase.table("zoom_recordings").select("*").eq("id", recording_id).eq("user_id", user_id).execute()
        
        if hasattr(recording_response, 'error') and recording_response.error:
            logger.error(f"Supabase error: {recording_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve recording: {recording_response.error}")
            
        if not recording_response.data or len(recording_response.data) == 0:
            raise HTTPException(status_code=404, detail="Recording not found or does not belong to the current user")
        
        # Delete any associated transcript
        transcript_response = supabase.table("zoom_transcripts").delete().eq("recording_id", recording_id).execute()
        
        if hasattr(transcript_response, 'error') and transcript_response.error:
            logger.error(f"Supabase error deleting transcript: {transcript_response.error}")
            # Continue with deletion of recording even if transcript deletion fails
        
        # Delete the recording
        recording_delete_response = supabase.table("zoom_recordings").delete().eq("id", recording_id).eq("user_id", user_id).execute()
        
        if hasattr(recording_delete_response, 'error') and recording_delete_response.error:
            logger.error(f"Supabase error deleting recording: {recording_delete_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to delete recording: {recording_delete_response.error}")
        
        # Check if the recording was actually deleted
        if not recording_delete_response.data or len(recording_delete_response.data) == 0:
            raise HTTPException(status_code=404, detail="Recording not found or could not be deleted")
        
        # Return success
        return {
            "status": "success",
            "message": f"Lecture with ID {recording_id} deleted successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting lecture: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete lecture: {str(e)}")

@app.delete("/assignments/{assignment_id}")
async def delete_assignment(assignment_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an assignment"""
    try:
        # Get user ID from the authenticated user
        user_id = current_user["user_id"]
        
        # Check if the assignment exists and belongs to the user
        assignment_response = supabase.table("assignments").select("*").eq("id", assignment_id).eq("user_id", user_id).execute()
        
        if hasattr(assignment_response, 'error') and assignment_response.error:
            logger.error(f"Supabase error: {assignment_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve assignment: {assignment_response.error}")
            
        if not assignment_response.data or len(assignment_response.data) == 0:
            raise HTTPException(status_code=404, detail="Assignment not found or does not belong to the current user")
        
        # Delete the assignment
        delete_response = supabase.table("assignments").delete().eq("id", assignment_id).eq("user_id", user_id).execute()
        
        if hasattr(delete_response, 'error') and delete_response.error:
            logger.error(f"Supabase error: {delete_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to delete assignment: {delete_response.error}")
        
        # Check if the assignment was actually deleted
        if not delete_response.data or len(delete_response.data) == 0:
            raise HTTPException(status_code=404, detail="Assignment not found or could not be deleted")
        
        # Return success
        return {
            "status": "success",
            "message": f"Assignment with ID {assignment_id} deleted successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting assignment: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete assignment: {str(e)}")

# ==================== END DEVELOPMENT ENDPOINTS ====================

# Import and include the render module
if importlib.util.find_spec("render"):
    import render
    app.include_router(render.router)

# Import and include the confirmation module
if importlib.util.find_spec("confirmation"):
    import confirmation
    app.include_router(confirmation.router)

# Helper function to sanitize content and ensure it's usable
def sanitize_content(content_obj):
    """Clean and validate content to ensure it's usable for generation"""
    content = content_obj.get("content", "")
    title = content_obj.get("title", "Untitled")
    
    # If content is too short or empty, create a minimal content with metadata
    if not content or len(content.strip()) < 20:
        logging.warning(f"Content for '{title}' is too short or empty, using metadata")
        content = f"Title: {title}\n"
        
        # Add other available metadata
        for key, value in content_obj.items():
            if key not in ["content", "title", "id"] and value:
                content += f"{key.replace('_', ' ').title()}: {value}\n"
    
    # Remove any problematic characters that might cause issues
    content = content.replace('\x00', ' ')  # Remove null bytes
    
    # Ensure content has reasonable length
    if len(content) > 100000:  # Limit content to 100K chars to prevent processing issues
        logging.warning(f"Content for '{title}' truncated from {len(content)} to 100K chars")
        content = content[:100000] + "...[truncated]"
    
    # Update the content in the object
    content_obj["content"] = content
    return content_obj

# Simple in-memory cache for generation results
# Format: {"cache_key": {"timestamp": timestamp, "result": result}}
generation_cache = {}
CACHE_EXPIRY_SECONDS = 3600  # Cache items expire after 1 hour

def get_cache_key(content_id, num_items, item_type, difficulty=None):
    """Generate a cache key for storing generation results"""
    if difficulty:
        return f"{content_id}_{num_items}_{item_type}_{difficulty}"
    return f"{content_id}_{num_items}_{item_type}"

def get_from_cache(content_id, num_items, item_type, difficulty=None):
    """Retrieve cached generation results if available and not expired"""
    cache_key = get_cache_key(content_id, num_items, item_type, difficulty)
    cached_item = generation_cache.get(cache_key)
    
    if not cached_item:
        return None
    
    # Check if cache item has expired
    now = time.time()
    if now - cached_item["timestamp"] > CACHE_EXPIRY_SECONDS:
        # Remove expired item
        del generation_cache[cache_key]
        return None
    
    return cached_item["result"]

def store_in_cache(content_id, num_items, item_type, result, difficulty=None):
    """Store generation results in cache"""
    cache_key = get_cache_key(content_id, num_items, item_type, difficulty)
    generation_cache[cache_key] = {
        "timestamp": time.time(),
        "result": result
    }
    
    # Clean up cache if it gets too large (keep it under 1000 items)
    if len(generation_cache) > 1000:
        # Remove oldest items
        oldest_keys = sorted(generation_cache.keys(), 
                            key=lambda k: generation_cache[k]["timestamp"])[:100]
        for key in oldest_keys:
            if key in generation_cache:
                del generation_cache[key]

@app.post("/generate/notecards")
async def generate_notecards(request: NotecardGeneration, user_id: str = Depends(get_current_user_id)):
    """Generate notecards from selected lectures and assignments"""
    try:
        # Get lectures content
        lecture_contents = []
        for lecture_id in request.content_selection.lecture_ids:
            # Get lecture from database
            lecture_result = supabase.table("zoom_recordings").select("*").eq("id", lecture_id).eq("user_id", user_id).execute()
            
            if len(lecture_result.data) == 0:
                continue
                
            lecture = lecture_result.data[0]
            
            # First check if this lecture has a transcript in the zoom_transcripts table
            transcript_result = supabase.table("zoom_transcripts").select("*").eq("recording_id", lecture_id).limit(1).execute()
            
            # Get content from the lecture - first try to get the transcript content
            content = ""
            if transcript_result.data and len(transcript_result.data) > 0:
                transcript = transcript_result.data[0]
                raw_content = transcript.get("formatted_text", "")
                # Clean the transcript text before using it
                content = clean_transcript_text(raw_content)
                logging.info(f"Found and cleaned transcript for lecture {lecture_id} with {len(content)} characters")
            
            # If no transcript content, try the formatted_text directly from the recording
            if not content:
                raw_content = lecture.get("formatted_text", "")
                content = clean_transcript_text(raw_content)
                logging.info(f"Using cleaned recording formatted_text for lecture {lecture_id}")
            
            # Only use metadata as a last resort
            if not content or len(content.strip()) < 50:  # If content is too short or empty
                logging.warning(f"No substantial transcript found for lecture {lecture_id}, using metadata fallback")
                content = f"Lecture title: {lecture.get('title', '')}\n"
                content += f"Date: {lecture.get('date', '')}\n"
                content += f"Host: {lecture.get('host', '')}\n"
                content += f"URL: {lecture.get('url', '')}\n"
                
            lecture_contents.append({
                "id": lecture["id"],
                "title": lecture.get("title", f"Lecture {lecture.get('recording_id', '')[:8] if lecture.get('recording_id') else ''}"),
                "content": content,
                "type": "lecture",
                "course_id": lecture.get("course_id", "Unknown")
            })
            
        # Get assignments content
        assignment_contents = []
        for assignment_id in request.content_selection.assignment_ids:
            # Get assignment from database
            assignment_result = supabase.table("assignments").select("*").eq("id", assignment_id).eq("user_id", user_id).execute()
            
            if len(assignment_result.data) == 0:
                continue
                
            assignment = assignment_result.data[0]
            
            # Get content from the assignment - use whatever is available
            content = assignment.get("description", "")
            if not content:
                # Instead of using placeholder text, use any available information from the assignment
                content = f"Assignment title: {assignment.get('title', '')}\n"
                content += f"Points: {assignment.get('points', '0')}\n"
                content += f"Due date: {assignment.get('due_date', 'Not specified')}\n"
                content += f"Status: {assignment.get('status', 'Not specified')}\n"
                
            assignment_contents.append({
                "id": assignment["id"],
                "title": assignment.get("title", "Assignment"),
                "content": content,
                "type": "assignment",
                "course_id": assignment.get("course_id", "Unknown")
            })
        
        # Combine all content sources
        all_contents = lecture_contents + assignment_contents
        
        if not all_contents:
            # If there are no valid sources at all, return error
            return {"status": "error", "message": "No content found in selected sources"}
        
        # Sanitize all content before processing
        all_contents = [sanitize_content(content) for content in all_contents]
        
        # Process each content source to generate notecards
        source_notecards = []
        rag_url = os.environ.get("RAG_API_URL", "http://localhost:8001")
        rag_available = False
        
        # Check if RAG API is available (only check once)
        try:
            # Test if the RAG API is actually available
            test_response = requests.get(
                f"{rag_url}/test",
                timeout=5  # Quick timeout for just checking if it's up
            )
            rag_available = test_response.status_code == 200
            logging.info(f"RAG API availability check: {'Available' if rag_available else 'Unavailable'}")
        except Exception as e:
            logging.warning(f"RAG API unavailable, will use fallback generation: {str(e)}")
            rag_available = False
        
        for content in all_contents:
            num_cards = min(request.cards_per_source, 5)  # Cap at 5 cards per source
            
            # Check cache first
            cached_cards = get_from_cache(content["id"], num_cards, "notecards")
            if cached_cards:
                logging.info(f"Using cached notecards for content {content['id']}")
                source_notecards.append({
                    "source": {
                        "id": content["id"],
                        "title": content["title"],
                        "type": content["type"],
                        "course_id": content["course_id"]
                    },
                    "cards": cached_cards
                })
                continue
            
            cards = []
            
            # Try the RAG API only if it's available
            if rag_available:
                try:
                    # Create a prompt that will generate proper flashcards
                    prompt = f"""
                    Create {num_cards} high-quality educational flashcards based on the following lecture content.
                    
                    CRITICAL INSTRUCTIONS:
                    - First perform a careful ANALYSIS of the lecture content to identify the SPECIFIC ACADEMIC TOPICS being taught
                    - Extract the SPECIFIC SUBJECT MATTER and KEY CONCEPTS that represent the core educational content
                    - Determine the 3-5 most important topics or concepts covered in this content
                    - Focus EXCLUSIVELY on these specific subject matter topics when creating flashcards
                    - If the content seems to contain irrelevant text or artifacts, IGNORE those completely
                    - Your flashcards should represent the ACTUAL EDUCATIONAL CONCEPTS in the domain being taught
                    - If you're unsure what the main topics are, focus on technical terms, definitions, and formulas you can identify
                    
                    PROCESS:
                    1. Read and analyze the entire content to identify the specific academic subject and topics
                    2. List the 3-5 primary educational concepts or topics being taught
                    3. Create flashcards ONLY about these specific concepts (not about the lecture itself)
                    4. If you can't identify clear topics, default to general concepts in the apparent subject domain
                    
                    The flashcards should:
                    - Cover SPECIFIC technical concepts, theories, methodologies, or frameworks presented
                    - Include precise definitions, examples, and explanations from the domain
                    - Be written as proper educational material that would appear in a textbook
                    - Contain academically accurate information about the subject matter
                    
                    For each flashcard:
                    - Front: Ask a clear, focused question about a SPECIFIC academic concept identified in the content
                    - Back: Provide a complete, well-structured explanation that would match what appears in a textbook
                    
                    Example of BAD flashcard (DO NOT create like this):
                    FRONT: Define or explain the concept of here is a particular absence
                    BACK: If there is a particular absence, there will be penalty for that.
                    
                    Example of GOOD flashcard:
                    FRONT: What are the key characteristics of microservices architecture?
                    BACK: Microservices architecture is characterized by: 1) Small, independent services focused on single responsibilities, 2) Loose coupling between services, 3) Independent deployment capabilities, and 4) Service-specific databases and UI management code.
                    
                    Content: {content["content"]}
                    
                    Format each flashcard as:
                    FRONT: [specific educational question about a key concept]
                    BACK: [complete, textbook-quality explanation of the concept]
                    """
                    
                    rag_response = requests.post(
                        f"{rag_url}/query",
                        json={
                            "query": prompt,
                            "document_ids": [],  # We're passing content directly
                            "top_k": 10,
                            "model": "meta-llama/llama-3-8b-instruct"
                        },
                        timeout=60  # Increase timeout for content generation
                    )
                    
                    if rag_response.status_code == 200:
                        rag_data = rag_response.json()
                        generated_text = rag_data.get("response", "")
                        
                        # Parse the generated flashcards
                        card_blocks = generated_text.split("FRONT:")
                        
                        # Skip the first element if it's empty (usually is)
                        if card_blocks and not card_blocks[0].strip():
                            card_blocks = card_blocks[1:]
                        
                        for i, block in enumerate(card_blocks[:num_cards]):
                            # Split block into front and back
                            parts = block.split("BACK:")
                            
                            if len(parts) == 2:
                                front = parts[0].strip()
                                back = parts[1].strip()
                                
                                # Clean up any remaining sections
                                if "FRONT:" in back:
                                    back = back.split("FRONT:")[0].strip()
                                    
                                cards.append({
                                    "id": f"card_{content['id']}_{i}",
                                    "front": front,
                                    "back": back
                                })
                            else:
                                # If we can't parse it properly, create a simple version
                                cards.append({
                                    "id": f"card_{content['id']}_{i}",
                                    "front": f"Concept {i+1} from {content['title']}",
                                    "back": block.strip()
                                })
                                
                        # If we didn't get enough cards, fill in with backup method
                        if len(cards) < num_cards:
                            # Let's process the entire response differently
                            paragraphs = [p for p in generated_text.split("\n\n") if p.strip()]
                            
                            for i in range(len(cards), min(len(paragraphs), num_cards)):
                                paragraph = paragraphs[i].strip()
                                # Try to extract a question from the paragraph
                                if "?" in paragraph:
                                    question_part = paragraph.split("?")[0] + "?"
                                    answer_part = paragraph[len(question_part):].strip()
                
                                    cards.append({
                                        "id": f"card_{content['id']}_{i}",
                                        "front": question_part,
                                        "back": answer_part if answer_part else "See content for details"
                                    })
                                else:
                                    # Split the paragraph roughly in half for a concept and explanation
                                    words = paragraph.split()
                                    midpoint = len(words) // 3
                                    
                                    concept = " ".join(words[:midpoint]) + "..."
                                    explanation = paragraph
                                    
                                    cards.append({
                                        "id": f"card_{content['id']}_{i}",
                                        "front": f"Explain: {concept}",
                                        "back": explanation
                                    })
                    else:
                        # API call failed with an error status code
                        logging.error(f"RAG API returned status code: {rag_response.status_code}")
                except Exception as rag_error:
                    logging.error(f"RAG API error during generation, using fallback: {str(rag_error)}")
                    # Will use fallback since cards list is still empty
            
            # If RAG API is unavailable or failed, use the fallback generation
            if not cards:
                logging.info(f"Using fallback card generation for content {content['id']}")
                
                # Extract educational content from cleaned transcript
                paragraphs = content["content"].split("\n\n")
                paragraphs = [p for p in paragraphs if len(p) > 30]  # Filter out tiny paragraphs
                
                if not paragraphs:
                    # If no good paragraphs, split by newlines
                    paragraphs = [p for p in content["content"].split("\n") if len(p) > 30]
                
                if not paragraphs:
                    # If still no good paragraphs, use the whole content as one paragraph
                    paragraphs = [content["content"]]
                
                # Extract key technical terms and concepts that might be important educational content
                # This helps identify what the lecture is actually teaching about
                all_text = " ".join(paragraphs)
                
                # Advanced key term extraction - look for domain-specific terms and concepts
                # Look for capitalized terms that might be important concepts
                capitalized_terms = re.findall(r'\b[A-Z][a-z]{2,}\b', all_text)
                capitalized_terms = [term for term in capitalized_terms if len(term) > 3 and term not in 
                                   ["The", "This", "That", "These", "Those", "There", "Their", "They", "When", "Where", "What"]]
                
                # Extract technical terms using improved patterns
                technical_terms = re.findall(r'\b[A-Za-z][a-z]{2,}(?:[A-Z][a-z]*)+\b', all_text)  # CamelCase terms
                technical_terms += re.findall(r'\b[a-z]+[-_][a-z]+\b', all_text)  # hyphenated or underscored terms
                
                # Look for defined terms with patterns like "X is defined as", "X refers to", "X is a"
                definition_patterns = [
                    r'([A-Za-z\s]{3,30})\s+is defined as\s+',
                    r'([A-Za-z\s]{3,30})\s+refers to\s+',
                    r'([A-Za-z\s]{3,30})\s+is a\s+',
                    r'([A-Za-z\s]{3,30})\s+means\s+',
                    r'([A-Za-z\s]{3,30})\s+is considered\s+',
                    r'the term\s+([A-Za-z\s]{3,30})'
                ]
                
                defined_terms = []
                for pattern in definition_patterns:
                    found_terms = re.findall(pattern, all_text, re.IGNORECASE)
                    defined_terms.extend([term.strip() for term in found_terms if len(term.strip()) > 3])
                
                # Count word frequency for additional domain-specific terms
                words = all_text.split()
                word_freq = {}
                
                # Identify potentially important technical terms by frequency and characteristics
                for word in words:
                    word = word.strip(".,;:()[]{}").lower()
                    if len(word) > 5 and word not in [
                        "about", "these", "those", "their", "there", "would", "should", 
                        "could", "which", "where", "when", "what", "that", "this", "because",
                        "there", "their", "they", "have", "been", "being", "other", "another"
                    ]:
                        word_freq[word] = word_freq.get(word, 0) + 1
                
                # Get most frequent technical terms
                frequent_terms = [w for w, c in sorted(word_freq.items(), key=lambda x: x[1], reverse=True) 
                                if c > 1 and len(w) > 5][:15]
                
                # Combine all discovered terms, prioritizing defined terms
                potential_topics = list(set(defined_terms + capitalized_terms + technical_terms + frequent_terms))
                potential_topics = [t for t in potential_topics if len(t) > 3][:20]  # Take up to 20 unique terms
                
                # Find educational concept categories in content
                tech_subjects = {
                    "architecture": ["design", "pattern", "structure", "layer", "component", "architecture", "framework"],
                    "microservices": ["service", "api", "container", "docker", "orchestration", "choreography", "microservice"],
                    "database": ["data", "sql", "nosql", "schema", "query", "storage", "database", "table", "record"],
                    "software development": ["agile", "scrum", "sprint", "development", "coding", "programming", "software"],
                    "web technologies": ["http", "rest", "api", "client", "server", "request", "response", "web", "frontend"],
                    "algorithms": ["algorithm", "complexity", "sorting", "searching", "optimization", "efficient"],
                    "artificial intelligence": ["ai", "machine learning", "neural", "deep learning", "model", "training"],
                    "mathematics": ["equation", "formula", "calculation", "theorem", "proof", "mathematical"],
                    "biology": ["cell", "organism", "species", "gene", "protein", "dna", "biological"],
                    "chemistry": ["reaction", "molecule", "compound", "element", "bond", "atomic"],
                    "physics": ["force", "energy", "motion", "particle", "quantum", "relativity"],
                    "economics": ["market", "supply", "demand", "price", "economic", "inflation", "fiscal"]
                }
                
                # Determine what educational topics are covered - improved detection
                key_topics = []
                for topic, related_terms in tech_subjects.items():
                    relevance_score = sum(1 for term in related_terms if term.lower() in all_text.lower())
                    if relevance_score >= 2:  # At least 2 related terms should appear
                        key_topics.append(topic)
                
                # If no general topics found, use specific terms
                if not key_topics and potential_topics:
                    key_topics = potential_topics[:3]  # Use top specific terms as topics
                
                # Create cards around the identified topics
                cards = []
                
                # First, create cards from defined terms (highest quality)
                for term in defined_terms[:min(num_cards, len(defined_terms))]:
                    # Validate term format (don't use terms that are nonsensical fragments)
                    term = term.strip()
                    # Skip terms that contain partial words or don't make grammatical sense
                    if (len(term.split()) > 5 or  # Skip terms that are too long (likely sentence fragments)
                        len(term) < 4 or  # Skip terms that are too short 
                        term.lower().startswith(('and', 'or', 'but', 'if', 'to', 'be', 'as', 'in', 'on', 'at', 'with', 'by', 'for')) or
                        not all(len(word) > 1 for word in term.split())): # Skip terms with single-letter words
                        continue
                    
                    # Find the full definition sentence
                    definition_sentence = ""
                    for paragraph in paragraphs:
                        if term in paragraph:
                            sentences = paragraph.split('.')
                            for sentence in sentences:
                                if term in sentence:
                                    definition_sentence = sentence.strip() + "."
                                    break
                            if definition_sentence:
                                break
                
                    if definition_sentence and len(definition_sentence) > 20:
                        cards.append({
                            "id": f"card_{content['id']}_{len(cards)}",
                            "front": f"What is {term}? Define this concept.",
                            "back": definition_sentence if len(definition_sentence) > 20 else f"A key concept related to {key_topics[0] if key_topics else 'the subject'}."
                        })
                
                # Create a list of validated, high-quality topics
                validated_topics = []
                for topic in key_topics:
                    if len(topic) > 3 and not topic.lower().startswith(('and', 'or', 'but', 'if', 'to', 'be', 'as')):
                        # Look for evidence this is really a topic in the content
                        topic_found = False
                        for paragraph in paragraphs:
                            if topic.lower() in paragraph.lower():
                                topic_found = True
                        break
                        if topic_found:
                            validated_topics.append(topic)
                
                # Then create cards based on validated key topics
                for topic in validated_topics[:min(num_cards - len(cards), len(validated_topics))]:
                    # Find a relevant paragraph that mentions this topic
                    relevant_paragraph = ""
                    topic_lower = topic.lower()
                    for paragraph in paragraphs:
                        if topic_lower in paragraph.lower():
                            relevant_paragraph = paragraph
                            break
                    
                    if not relevant_paragraph and paragraphs:
                        # Fall back to first paragraph if no specific mention
                        relevant_paragraph = paragraphs[0]
                            
                    cards.append({
                        "id": f"card_{content['id']}_{len(cards)}",
                        "front": f"Explain the key concepts and principles of {topic}:",
                        "back": relevant_paragraph if relevant_paragraph else f"A fundamental concept in the subject material."
                    })
                
                # Finally, add cards for any remaining specific terms that are of high quality
                remaining_slots = num_cards - len(cards)
                if remaining_slots > 0 and potential_topics:
                    # Filter potential topics to ensure they're proper terms
                    validated_terms = []
                    for term in potential_topics:
                        # Basic validation to ensure term is an actual meaningful term
                        if (isinstance(term, str) and 
                            len(term) >= 4 and 
                            not term.lower().startswith(('and', 'or', 'but', 'if', 'to', 'be', 'as', 'the', 'in', 'on', 'at')) and
                            not term.lower().endswith(('and', 'or', 'but', 'if', 'to', 'be', 'as', 'the')) and
                            not any(frag in term.lower() for frag in ['ontinue', ' to be ', ' while ', ' that ', ' which ', ' then ']) and
                            not re.search(r'^[a-z]+ [a-z]+ [a-z]+ [a-z]+$', term)): # Avoid sentence fragments
                            # Look for evidence this is a real term in the content
                            term_found = False
                            for paragraph in paragraphs:
                                if term.lower() in paragraph.lower():
                                    term_found = True
                                break
                            if term_found:
                                validated_terms.append(term)
                    
                    for term in validated_terms[:remaining_slots]:
                        # Find relevant content for this term
                        relevant_text = ""
                        for paragraph in paragraphs:
                            if term.lower() in paragraph.lower():
                                relevant_text = paragraph
                            break
                            
                        if not relevant_text and paragraphs:
                            # Only use a random paragraph as a last resort, and only if it's high quality
                            if len(paragraphs) > 0 and any(len(p) > 200 for p in paragraphs):
                                # Select the longest paragraph as it likely has most content
                                relevant_text = max(paragraphs, key=len)
                            
                        if relevant_text and len(relevant_text) > 50:
                            cards.append({
                                "id": f"card_{content['id']}_{len(cards)}",
                                "front": f"What is the significance of {term} in this subject?",
                                "back": relevant_text
                            })
                
                # If still no good cards, create some based on sentences with educational keywords
                if len(cards) < 2:
                    # Look for sentences that contain educational keywords
                    educational_keywords = ['defined', 'concept', 'principle', 'theory', 'method', 
                                          'important', 'significant', 'key', 'fundamental', 
                                          'framework', 'approach', 'technique', 'model']
                    educational_sentences = []
                    
                    for paragraph in paragraphs:
                        sentences = [s.strip() + '.' for s in paragraph.split('.') if len(s.strip()) > 30]
                        for sentence in sentences:
                            for keyword in educational_keywords:
                                if keyword in sentence.lower():
                                    educational_sentences.append(sentence)
                                    break
                    
                    # Select the top educational sentences
                    educational_sentences = list(set(educational_sentences))  # Remove duplicates
                    for i, sentence in enumerate(educational_sentences[:min(num_cards - len(cards), len(educational_sentences))]):
                        # Extract a potential topic from the sentence
                        words = sentence.split()
                        topic_phrase = ""
                        
                        # Look for capitalized terms or first sentence components
                        for j, word in enumerate(words[:10]):  # Check first 10 words
                            if word and word[0].isupper() and len(word) > 3:
                                if j < len(words) - 1:  # If not the last word
                                    topic_phrase = f"{word} {words[j+1]}"
                                else:
                                    topic_phrase = word
                                break
                        
                        # If no capitalized term, use a generic question
                        if not topic_phrase:
                            if sentence.lower().startswith('the '):
                                topic_phrase = ' '.join(words[1:min(4, len(words))])
                            else:
                                topic_phrase = ' '.join(words[:min(3, len(words))])
                            
                        cards.append({
                            "id": f"card_{content['id']}_{len(cards)}",
                            "front": f"Explain this key concept from the material: '{topic_phrase}'",
                            "back": sentence
                        })
                
                # Ensure we have at least one card
                if not cards and paragraphs:
                    # Find the best paragraph - the one with most educational content
                    best_paragraph = ""
                    max_score = 0
                    
                    for paragraph in paragraphs:
                        if len(paragraph) < 50:
                            continue
                            
                        score = 0
                        # Score based on educational terms
                        educational_terms = ['defined', 'concept', 'principle', 'theory', 'method', 
                                           'important', 'significant', 'key', 'fundamental']
                        for term in educational_terms:
                            if term in paragraph.lower():
                                score += 2
                        
                        # Score based on paragraph length (but not too long)
                        if 100 <= len(paragraph) <= 500:
                            score += 3
                        
                        # Score based on sentence structure
                        sentences = [s for s in paragraph.split('.') if len(s.strip()) > 0]
                        if 2 <= len(sentences) <= 5:  # Good paragraph size
                            score += 2
                            
                        if score > max_score:
                            max_score = score
                            best_paragraph = paragraph
                    
                    if best_paragraph:
                        cards.append({
                            "id": f"card_{content['id']}_0",
                            "front": "What are the key concepts covered in this material?",
                            "back": best_paragraph
                        })
                    else:
                        # Last resort - create a generic card
                        cards.append({
                            "id": f"card_{content['id']}_0",
                            "front": "Summarize the main points from this material:",
                            "back": "This material covers important concepts in " + 
                                  (key_topics[0] if key_topics else "the subject area") + "."
                        })
            
            # Store cards in cache for future requests
            store_in_cache(content["id"], num_cards, "notecards", cards)
            
            source_notecards.append({
                "source": {
                    "id": content["id"],
                    "title": content["title"],
                    "type": content["type"],
                    "course_id": content["course_id"]
                },
                "cards": cards
            })
        
        return {
            "status": "success", 
            "notecards": source_notecards,
            "title": request.title,
            "sources": [{
                "id": content["id"],
                "title": content["title"],
                "type": content["type"],
                "course_id": content["course_id"]
            } for content in all_contents]
        }
        
    except Exception as e:
        logging.error(f"Error generating notecards: {str(e)}")
        return {"status": "error", "message": str(e)}

@app.post("/generate/quiz")
async def generate_quiz(request: QuizGeneration, user_id: str = Depends(get_current_user_id)):
    """Generate a quiz from selected lectures and assignments"""
    try:
        # Get lectures content
        lecture_contents = []
        for lecture_id in request.content_selection.lecture_ids:
            # Get lecture from database
            lecture_result = supabase.table("zoom_recordings").select("*").eq("id", lecture_id).eq("user_id", user_id).execute()
            
            if len(lecture_result.data) == 0:
                continue
                
            lecture = lecture_result.data[0]
            
            # First check if this lecture has a transcript in the zoom_transcripts table
            transcript_result = supabase.table("zoom_transcripts").select("*").eq("recording_id", lecture_id).limit(1).execute()
            
            # Get content from the lecture - first try to get the transcript content
            content = ""
            if transcript_result.data and len(transcript_result.data) > 0:
                transcript = transcript_result.data[0]
                raw_content = transcript.get("formatted_text", "")
                # Clean the transcript text before using it
                content = clean_transcript_text(raw_content)
                logging.info(f"Found and cleaned transcript for lecture {lecture_id} with {len(content)} characters for quiz generation")
            
            # If no transcript content, try the formatted_text directly from the recording
            if not content:
                raw_content = lecture.get("formatted_text", "")
                content = clean_transcript_text(raw_content)
                logging.info(f"Using cleaned recording formatted_text for lecture {lecture_id} in quiz generation")
            
            # Only use metadata as a last resort
            if not content or len(content.strip()) < 50:  # If content is too short or empty
                logging.warning(f"No substantial transcript found for lecture {lecture_id}, using metadata fallback for quiz")
                content = f"Lecture title: {lecture.get('title', '')}\n"
                content += f"Date: {lecture.get('date', '')}\n"
                content += f"Host: {lecture.get('host', '')}\n"
                content += f"URL: {lecture.get('url', '')}\n"
                
            lecture_contents.append({
                "id": lecture["id"],
                "title": lecture.get("title", f"Lecture {lecture.get('recording_id', '')[:8] if lecture.get('recording_id') else ''}"),
                "content": content,
                "type": "lecture",
                "course_id": lecture.get("course_id", "Unknown")
            })
            
        # Get assignments content
        assignment_contents = []
        for assignment_id in request.content_selection.assignment_ids:
            # Get assignment from database
            assignment_result = supabase.table("assignments").select("*").eq("id", assignment_id).eq("user_id", user_id).execute()
            
            if len(assignment_result.data) == 0:
                continue
                
            assignment = assignment_result.data[0]
            
            # Get content from the assignment - use whatever is available
            content = assignment.get("description", "")
            if not content:
                # Instead of using placeholder text, use any available information from the assignment
                content = f"Assignment title: {assignment.get('title', '')}\n"
                content += f"Points: {assignment.get('points', '0')}\n"
                content += f"Due date: {assignment.get('due_date', 'Not specified')}\n"
                content += f"Status: {assignment.get('status', 'Not specified')}\n"
                
            assignment_contents.append({
                "id": assignment["id"],
                "title": assignment.get("title", "Assignment"),
                "content": content,
                "type": "assignment",
                "course_id": assignment.get("course_id", "Unknown")
            })
        
        # Combine all content sources
        all_contents = lecture_contents + assignment_contents
        
        if not all_contents:
            # If there are no valid sources at all, return error
            return {"status": "error", "message": "No content found in selected sources"}
        
        # Sanitize all content before processing
        all_contents = [sanitize_content(content) for content in all_contents]
        
        # Generate quizzes
        source_quizzes = []
        rag_url = os.environ.get("RAG_API_URL", "http://localhost:8001")
        rag_available = False
        
        # Check if RAG API is available (only check once)
        try:
            # Test if the RAG API is actually available
            test_response = requests.get(
                f"{rag_url}/test",
                timeout=5  # Quick timeout for just checking if it's up
            )
            rag_available = test_response.status_code == 200
            logging.info(f"RAG API availability check: {'Available' if rag_available else 'Unavailable'}")
        except Exception as e:
            logging.warning(f"RAG API unavailable, will use fallback generation: {str(e)}")
            rag_available = False
        
        for content in all_contents:
            num_questions = min(request.questions_per_source, 10)  # Cap at 10 questions per source
            
            # Check cache first
            cached_questions = get_from_cache(content["id"], num_questions, "quiz", request.difficulty)
            if cached_questions:
                logging.info(f"Using cached quiz questions for content {content['id']}")
                source_quizzes.append({
                    "source": {
                        "id": content["id"],
                        "title": content["title"],
                        "type": content["type"],
                        "course_id": content["course_id"]
                    },
                    "questions": cached_questions
                })
                continue
                
            questions = []
            
            # Only try RAG API if it's available
            if rag_available:
                try:
                    # Prepare difficulty description
                    difficulty_desc = ""
                    if request.difficulty == "easy":
                        difficulty_desc = "These should be basic, factual questions testing fundamental understanding."
                    elif request.difficulty == "medium":
                        difficulty_desc = "These should be moderate difficulty questions requiring application of concepts."
                    else:  # hard
                        difficulty_desc = "These should be challenging questions requiring deep analysis and synthesis of multiple concepts."
                    
                    # Create a comprehensive prompt for quiz generation
                    prompt = f"""
                    Create {num_questions} high-quality multiple-choice quiz questions based on the educational concepts in the following lecture content.
                    Difficulty level: {request.difficulty.upper()}. {difficulty_desc}
                    
                    CRITICAL INSTRUCTIONS:
                    - First perform a careful ANALYSIS of the content to identify the SPECIFIC ACADEMIC TOPICS being taught
                    - Extract the SPECIFIC SUBJECT MATTER and KEY CONCEPTS that represent the core educational content
                    - Determine the 3-5 most important topics or concepts covered in this content
                    - Focus EXCLUSIVELY on these specific subject matter topics when creating quiz questions
                    - If the content seems to contain irrelevant text or artifacts, IGNORE those completely
                    - Your quiz questions should test understanding of ACTUAL EDUCATIONAL CONCEPTS in the domain
                    - If you're unsure what the main topics are, focus on technical terms, definitions, and formulas you can identify
                    
                    PROCESS:
                    1. Read and analyze the entire content to identify the specific academic subject and topics
                    2. List the 3-5 primary educational concepts or topics being taught
                    3. Create quiz questions ONLY about these specific concepts (not about the lecture itself)
                    4. If you can't identify clear topics, default to general concepts in the apparent subject domain
                    
                    The quiz questions should:
                    - Assess understanding of SPECIFIC technical concepts, theories, methodologies, or frameworks
                    - Test knowledge of precise definitions and applications from the identified domain
                    - Be written as proper educational assessment items that would appear in a formal course exam
                    - Contain academically accurate information about the subject matter
                    
                    For each question:
                    - Create a clear, focused question about a SPECIFIC academic concept identified in the content
                    - Provide exactly 4 options (A, B, C, D) with only one correct answer
                    - Ensure distractors (wrong answers) are plausible but clearly incorrect for experts in the field
                    - All options should be of similar length and detail level
                    
                    Example of BAD question (DO NOT create like this):
                    QUESTION: Which statement about the lecture format is correct?
                    A: The lecture had timestamps
                    B: The professor mentioned deadlines multiple times
                    C: The lecture was structured around administrative topics
                    D: The lecture contained artifacts from the transcript
                    
                    Example of GOOD question:
                    QUESTION: Which characteristic best defines microservices architecture?
                    A: Services with tightly coupled dependencies
                    B: Services with individual responsibilities and independent deployment
                    C: Centralized databases shared by all services
                    D: Services that must be deployed simultaneously
                    
                    Content: {content["content"]}
                    
                    Format each question as:
                    QUESTION: [clear educational question about a specific concept]
                    A: [option A]
                    B: [option B]
                    C: [option C]
                    D: [option D]
                    CORRECT: [letter of correct answer: A, B, C, or D]
                    """
                    
                    rag_response = requests.post(
                        f"{rag_url}/query",
                        json={
                            "query": prompt,
                            "document_ids": [],  # We're passing content directly
                            "top_k": 10,
                            "model": "meta-llama/llama-3-8b-instruct"
                        },
                        timeout=60  # Increase timeout for content generation
                    )
                    
                    if rag_response.status_code == 200:
                        rag_data = rag_response.json()
                        generated_text = rag_data.get("response", "")
                        
                        # Parse the generated quiz questions
                        question_blocks = generated_text.split("QUESTION:")
                        
                        # Skip the first element if it's empty
                        if question_blocks and not question_blocks[0].strip():
                            question_blocks = question_blocks[1:]
                        
                        for i, block in enumerate(question_blocks[:num_questions]):
                            # Extract question text
                            question_text = block.split("A:")[0].strip() if "A:" in block else block.strip()
                            
                            # Extract options
                            options = []
                            option_parts = {"A:": "B:", "B:": "C:", "C:": "D:", "D:": "CORRECT:"}
                            
                            for start_tag, end_tag in option_parts.items():
                                if start_tag in block:
                                    start_idx = block.index(start_tag) + len(start_tag)
                                    end_idx = block.index(end_tag) if end_tag in block else len(block)
                                    option_text = block[start_idx:end_idx].strip()
                                    options.append(option_text)
                            
                            # If we don't have exactly 4 options, create placeholders
                            while len(options) < 4:
                                options.append(f"Option {len(options)+1} for question {i+1}")
                            
                            # Extract correct answer
                            correct_idx = 0  # Default to A
                            if "CORRECT:" in block:
                                correct_part = block.split("CORRECT:")[1].strip().upper()
                                if correct_part.startswith('A'):
                                    correct_idx = 0
                                elif correct_part.startswith('B'):
                                    correct_idx = 1
                                elif correct_part.startswith('C'):
                                    correct_idx = 2
                                elif correct_part.startswith('D'):
                                    correct_idx = 3
                            
                            questions.append({
                                "question": question_text,
                                "options": options[:4],  # Ensure we have exactly 4 options
                                "correctIndex": correct_idx
                            })
                            
                        # If we didn't get enough questions, fill in with backup method
                        if len(questions) < num_questions:
                            # Create questions from the content directly
                            sentences = [s.strip() for s in content["content"].replace('\n', ' ').split('.') if len(s.strip()) > 20]
                            
                            for i in range(len(questions), min(len(sentences), num_questions)):
                                sentence = sentences[i]
                                words = sentence.split()
                                blank_idx = min(len(words) - 1, max(3, len(words) // 3))
                                
                                correct_word = words[blank_idx] if blank_idx < len(words) else "answer"
                                question_text = ' '.join(words[:blank_idx] + ['_____'] + words[blank_idx+1:]) if blank_idx < len(words) else sentence
                                
                                options = [correct_word]
                                # Generate 3 alternative options
                                for j in range(3):
                                    alt_idx = (blank_idx + (j+1)*3) % max(1, len(words))
                                    alt_word = words[alt_idx] if alt_idx < len(words) else f"Option {j+1}"
                                    if alt_word not in options:
                                        options.append(alt_word)
                                    else:
                                        options.append(f"Alternative {j+1}")
                                
                                # Shuffle options
                                import random
                                random.shuffle(options)
                                correct_idx = options.index(correct_word)
                                
                                questions.append({
                                    "question": f"Complete the following: {question_text}",
                                    "options": options,
                                    "correctIndex": correct_idx
                                })
                    else:
                        # API call failed with an error status code
                        raise Exception(f"RAG API returned status code: {rag_response.status_code}")
                except Exception as rag_error:
                    logging.error(f"RAG API error during generation, using fallback: {str(rag_error)}")
                    # Will use fallback since questions list is still empty
            
            # If RAG API is unavailable or failed, use the fallback generation
            if not questions:
                logging.info(f"Using fallback quiz generation for content {content['id']}")
                
                # Extract educational content from cleaned transcript
                paragraphs = content["content"].split("\n\n")
                paragraphs = [p for p in paragraphs if len(p) > 30]  # Filter out tiny paragraphs
                
                if not paragraphs:
                    # If no good paragraphs, split by newlines
                    paragraphs = [p for p in content["content"].split("\n") if len(p) > 30]
                
                if not paragraphs:
                    # If still no good paragraphs, use the whole content as one paragraph
                    paragraphs = [content["content"]]
                
                # Advanced key term extraction - look for domain-specific terms and concepts
                all_text = " ".join(paragraphs)
                
                # Look for capitalized terms that might be important concepts
                capitalized_terms = re.findall(r'\b[A-Z][a-z]{2,}\b', all_text)
                capitalized_terms = [term for term in capitalized_terms if len(term) > 3 and term not in 
                                   ["The", "This", "That", "These", "Those", "There", "Their", "They", "When", "Where", "What"]]
                
                # Extract technical terms using improved patterns
                technical_terms = re.findall(r'\b[A-Za-z][a-z]{2,}(?:[A-Z][a-z]*)+\b', all_text)  # CamelCase terms
                technical_terms += re.findall(r'\b[a-z]+[-_][a-z]+\b', all_text)  # hyphenated or underscored terms
                
                # Look for defined terms with patterns like "X is defined as", "X refers to", "X is a"
                definition_patterns = [
                    r'([A-Za-z\s]{3,30})\s+is defined as\s+',
                    r'([A-Za-z\s]{3,30})\s+refers to\s+',
                    r'([A-Za-z\s]{3,30})\s+is a\s+',
                    r'([A-Za-z\s]{3,30})\s+means\s+',
                    r'([A-Za-z\s]{3,30})\s+is considered\s+',
                    r'the term\s+([A-Za-z\s]{3,30})'
                ]
                
                defined_terms = []
                for pattern in definition_patterns:
                    found_terms = re.findall(pattern, all_text, re.IGNORECASE)
                    defined_terms.extend([term.strip() for term in found_terms if len(term.strip()) > 3])
                
                # Count word frequency for additional domain-specific terms
                words = all_text.split()
                word_freq = {}
                
                # Identify potentially important technical terms by frequency and characteristics
                for word in words:
                    word = word.strip(".,;:()[]{}").lower()
                    if len(word) > 5 and word not in [
                        "about", "these", "those", "their", "there", "would", "should", 
                        "could", "which", "where", "when", "what", "that", "this", "because",
                        "there", "their", "they", "have", "been", "being", "other", "another"
                    ]:
                        word_freq[word] = word_freq.get(word, 0) + 1
                
                # Get most frequent technical terms
                frequent_terms = [w for w, c in sorted(word_freq.items(), key=lambda x: x[1], reverse=True) 
                                if c > 1 and len(w) > 5][:15]
                
                # Combine all discovered terms, prioritizing defined terms
                potential_topics = list(set(defined_terms + capitalized_terms + technical_terms + frequent_terms))
                potential_topics = [t for t in potential_topics if len(t) > 3][:20]  # Take up to 20 unique terms
                
                # Find educational concept categories in content
                tech_subjects = {
                    "architecture": ["design", "pattern", "structure", "layer", "component", "architecture", "framework"],
                    "microservices": ["service", "api", "container", "docker", "orchestration", "choreography", "microservice"],
                    "database": ["data", "sql", "nosql", "schema", "query", "storage", "database", "table", "record"],
                    "software development": ["agile", "scrum", "sprint", "development", "coding", "programming", "software"],
                    "web technologies": ["http", "rest", "api", "client", "server", "request", "response", "web", "frontend"],
                    "algorithms": ["algorithm", "complexity", "sorting", "searching", "optimization", "efficient"],
                    "artificial intelligence": ["ai", "machine learning", "neural", "deep learning", "model", "training"],
                    "mathematics": ["equation", "formula", "calculation", "theorem", "proof", "mathematical"],
                    "biology": ["cell", "organism", "species", "gene", "protein", "dna", "biological"],
                    "chemistry": ["reaction", "molecule", "compound", "element", "bond", "atomic"],
                    "physics": ["force", "energy", "motion", "particle", "quantum", "relativity"],
                    "economics": ["market", "supply", "demand", "price", "economic", "inflation", "fiscal"]
                }
                
                # Determine what educational topics are covered - improved detection
                key_topics = []
                for topic, related_terms in tech_subjects.items():
                    relevance_score = sum(1 for term in related_terms if term.lower() in all_text.lower())
                    if relevance_score >= 2:  # At least 2 related terms should appear
                        key_topics.append(topic)
                
                # If no general topics found, use specific terms
                if not key_topics and potential_topics:
                    key_topics = potential_topics[:3]  # Use top specific terms as topics
                
                # Generate quiz questions based on identified topics and terms
                questions = []
                
                # First, create questions from defined terms (highest quality)
                for term in defined_terms[:min(num_questions // 2, len(defined_terms))]:
                    # Validate term format (avoid nonsensical fragments)
                    term = term.strip()
                    # Skip terms that contain partial words or don't make grammatical sense
                    if (len(term.split()) > 5 or  # Skip terms that are too long (likely sentence fragments)
                        len(term) < 4 or  # Skip terms that are too short 
                        term.lower().startswith(('and', 'or', 'but', 'if', 'to', 'be', 'as', 'in', 'on', 'at', 'with', 'by', 'for')) or
                        not all(len(word) > 1 for word in term.split())): # Skip terms with single-letter words
                        continue
                    
                    # Find the full definition sentence
                    definition_sentence = ""
                    for paragraph in paragraphs:
                        if term in paragraph:
                            sentences = paragraph.split('.')
                            for sentence in sentences:
                                if term in sentence:
                                    definition_sentence = sentence.strip() + "."
                                    break
                            if definition_sentence:
                                break
                    
                    if definition_sentence and len(definition_sentence) > 20:
                        # Create a multiple choice question about the definition
                        options = []
                        
                        # The correct answer is the actual definition
                        correct_option = definition_sentence
                        options.append(correct_option)
                        
                        # Generate plausible but incorrect alternatives
                        # Option 1: Take a different sentence from the same paragraph
                        alternative_sentences = [s for s in paragraphs[0].split('.') if len(s) > 25 and s.strip() != definition_sentence]
                        if alternative_sentences and len(alternative_sentences) > 0:
                            options.append(alternative_sentences[0].strip() + ".")
                        else:
                            # Fallback - invert some meaning
                            inverted = definition_sentence.replace("is", "is not").replace("can", "cannot")
                            if inverted == definition_sentence:  # If no change, be more creative
                                inverted = "This is unrelated to the subject matter."
                            options.append(inverted)
                            
                        # Option 2: Create a definition for a different term
                        other_term = None
                        for t in defined_terms:
                            if t != term:
                                other_term = t
                                break
                        if other_term:
                            options.append(f"{other_term} is a key concept in this domain.")
                        else:
                            options.append(f"None of these concepts are relevant to {term}.")
                            
                        # Option 3: Complete distractor
                        if key_topics:
                            options.append(f"This relates to an entirely different field of {key_topics[0] if key_topics[0] != topic else 'study'}.")
                        else:
                            options.append("This concept is from a different subject area entirely.")
                        
                        # Shuffle options and determine correct index
                        import random
                        correct_idx = 0  # Correct answer is the first one before shuffling
                        correct_answer = options[correct_idx]
                        random.shuffle(options)
                        correct_idx = options.index(correct_answer)
                        
                        question_text = f"Which of the following correctly describes {term}?"
                        if request.difficulty == "hard":
                            question_text = f"Which of the following best characterizes the concept of {term} as used in this context?"
                        elif request.difficulty == "easy":
                            question_text = f"What is {term}?"
                        
                        questions.append({
                            "question": question_text,
                            "options": options,
                            "correctIndex": correct_idx
                        })
                
                # Create a list of validated, high-quality topics
                validated_topics = []
                for topic in key_topics:
                    if len(topic) > 3 and not topic.lower().startswith(('and', 'or', 'but', 'if', 'to', 'be', 'as')):
                        # Look for evidence this is really a topic in the content
                        topic_found = False
                        for paragraph in paragraphs:
                            if topic.lower() in paragraph.lower():
                                topic_found = True
                                break
                        if topic_found:
                            validated_topics.append(topic)
                
                # Then create questions about validated key topics/concepts
                for topic in validated_topics[:min(num_questions - len(questions), len(validated_topics))]:
                    # Find relevant paragraphs for this topic
                    relevant_paragraphs = []
                    for paragraph in paragraphs:
                        if topic.lower() in paragraph.lower():
                            relevant_paragraphs.append(paragraph)
                    
                    if not relevant_paragraphs and paragraphs:
                        continue  # Skip if no relevant paragraphs - don't default to random
                    
                    if relevant_paragraphs:
                        # Create a question about this topic
                        if request.difficulty == "easy":
                            question_text = f"Which of the following relates to {topic}?"
                        elif request.difficulty == "medium":
                            question_text = f"Which statement correctly describes a key aspect of {topic}?"
                        else:  # hard
                            question_text = f"Which of the following best represents an advanced principle of {topic}?"
                    
                        # Create options - the first one is correct
                        options = []
                    
                        # Extract or create a correct statement about the topic
                        topic_sentences = []
                        for para in relevant_paragraphs:
                            sentences = [s.strip() + "." for s in para.split('.') if len(s.strip()) > 20 and topic.lower() in s.lower()]
                            topic_sentences.extend(sentences)
                        
                        if topic_sentences:
                            correct_option = topic_sentences[0]
                        else:
                            # Fall back to first sentence of relevant paragraph
                            correct_option = relevant_paragraphs[0].split('.')[0] + "."
                            
                        if len(correct_option) < 20 or len(correct_option) > 200:  # If too short or too long
                            continue  # Skip this topic
                        
                        options.append(correct_option)
                        
                        # Generate plausible but incorrect alternatives
                        # Option 1: Take content from a different topic if available
                        other_content = ""
                        for other_topic in validated_topics:
                            if other_topic != topic:
                                for paragraph in paragraphs:
                                    if other_topic.lower() in paragraph.lower() and len(paragraph) > 30:
                                        sentences = [s.strip() + "." for s in paragraph.split('.') if len(s.strip()) > 20]
                                        if sentences:
                                            other_content = sentences[0]
                                            break
                                if other_content:
                                    break
                        
                        if other_content:
                            options.append(other_content)
                        else:
                            # Fallback - create a statement that reverses meaning
                            reversed_meaning = correct_option.replace("is", "is not").replace("should", "should not")
                            if reversed_meaning == correct_option:  # If no change
                                reversed_meaning = f"This topic is unrelated to {topic}."
                            options.append(reversed_meaning)
                        
                        # Option 2 & 3: More challenging distractors
                        options.append(f"The concept of {topic} is primarily used in fields unrelated to this subject matter.")
                        options.append(f"None of the material contains substantive information about {topic}.")
                        
                        # Shuffle options and track correct answer
                        import random
                        correct_idx = 0  # Correct answer is the first one
                        correct_answer = options[correct_idx]
                        random.shuffle(options)
                        correct_idx = options.index(correct_answer)
                        
                        questions.append({
                            "question": question_text,
                            "options": options,
                            "correctIndex": correct_idx
                        })
                
                # If we still need more questions, create high-quality fill-in-the-blank questions
                attempts = 0
                while len(questions) < num_questions and paragraphs and attempts < 10:
                    attempts += 1
                    
                    # Select a paragraph with sufficient educational content
                    candidate_paragraphs = []
                    for paragraph in paragraphs:
                        # Basic quality check
                        if len(paragraph) < 100 or len(paragraph) > 1000:
                            continue
                        
                        # Check for educational terms
                        educational_terms = ['concept', 'principle', 'theory', 'method', 'important', 'key']
                        education_score = sum(1 for term in educational_terms if term in paragraph.lower())
                        
                        if education_score > 0:
                            candidate_paragraphs.append(paragraph)
                    
                    if not candidate_paragraphs:
                        candidate_paragraphs = [p for p in paragraphs if len(p) >= 100]
                    
                    if not candidate_paragraphs:
                        break  # No suitable paragraphs found
                        
                    import random
                    paragraph = random.choice(candidate_paragraphs)
                    sentences = [s.strip() for s in paragraph.split('.') if len(s.strip()) > 30]
                    
                    if not sentences:
                        continue
                    
                    # Select the longest sentence which likely has more content
                    sentence = max(sentences, key=len)
                    words = sentence.split()
                    
                    if len(words) < 8:  # Skip very short sentences
                        continue
                    
                    # Choose a word to blank out - prefer nouns or technical terms
                    candidate_positions = []
                    for i, word in enumerate(words):
                        # Skip first and last few words
                        if i < 2 or i > len(words) - 3:
                            continue
                        # Skip common words and very short words
                        if word.lower() in ["the", "and", "or", "but", "for", "with", "that", "this", "were", "was", "had", "has"] or len(word) < 4:
                            continue
                        # Prioritize capitalized words and technical terms
                        priority = 1
                        if word[0].isupper():
                            priority += 2
                        if word.lower() in [t.lower() for t in potential_topics]:
                            priority += 3
                        # Favor words in middle of sentence
                        middle_position_score = 1 - abs((i / len(words)) - 0.5)  # 0.5 is middle, score higher near middle
                        priority += middle_position_score * 2
                        
                        candidate_positions.append((i, priority))
                    
                    # If no good candidates, skip this sentence
                    if not candidate_positions:
                        continue
                    
                    # Sort by priority
                    candidate_positions.sort(key=lambda x: x[1], reverse=True)
                    blank_idx = candidate_positions[0][0]
                    
                    # Create the question
                    correct_word = words[blank_idx]
                    # Skip very short words or common words after additional validation
                    if len(correct_word) < 4 or correct_word.lower() in ["from", "that", "with", "have", "this", "what", "when", "where", "which"]:
                        continue
                        
                    words[blank_idx] = "_____"
                    question_text = "Complete the following statement: " + ' '.join(words)
                    
                    # Create options - correct answer + 3 distractors
                    options = [correct_word]
                    
                    # Add distractor options - use other words from the text
                    distractors = []
                    for word in all_text.split():
                        word = word.strip(".,;:()[]{}").lower()
                        # Look for similar words for more challenging distractors
                        if (len(word) >= len(correct_word) - 2 and 
                            len(word) <= len(correct_word) + 2 and 
                            word != correct_word.lower() and
                            word not in ["from", "that", "with", "have", "this", "what", "when", "where", "which"] and
                            len(word) >= 4):
                            distractors.append(word)
                    
                    # If we have enough distractors, use them; otherwise create some
                    if len(distractors) >= 3:
                        import random
                        random.shuffle(distractors)
                        options.extend(distractors[:3])
                    else:
                        # Add some generic alternatives based on the correct word
                        if correct_word.endswith("ing"):
                            options.append(correct_word.replace("ing", "ed"))
                        else:
                            options.append(correct_word + "ed")
                            
                        if correct_word.endswith("s"):
                            options.append(correct_word[:-1])
                        else:
                            options.append(correct_word + "s")
                            
                        options.append("none of these")
                    
                    # Ensure we have exactly 4 options
                    options = options[:4]
                    while len(options) < 4:
                        options.append(f"Option {len(options)+1}")
                    
                    # Ensure options are unique
                    if len(set(options)) < 4:
                        continue  # Skip if we can't generate 4 unique options
                    
                    # Shuffle options and track the correct answer
                    correct_idx = 0  # The first option is the correct one
                    correct_answer = options[correct_idx]
                    
                    import random
                    random.shuffle(options)
                    correct_idx = options.index(correct_answer)
                    
                    questions.append({
                        "question": question_text,
                        "options": options,
                        "correctIndex": correct_idx
                    })
                
                # Ensure we have at least one question
                if not questions and paragraphs:
                    # Create a high-quality conceptual question about the material
                    educational_sentences = []
                    
                    # Look for sentences containing educational terms
                    educational_keywords = ['concept', 'principle', 'theory', 'method', 'important', 'key', 'fundamental']
                    
                    for paragraph in paragraphs:
                        if len(paragraph) < 50:
                            continue
                            
                        sentences = [s.strip() + "." for s in paragraph.split('.') if len(s.strip()) > 30]
                        for sentence in sentences:
                            for keyword in educational_keywords:
                                if keyword in sentence.lower():
                                    educational_sentences.append(sentence)
                                    break
                    
                    main_topic = key_topics[0] if key_topics else "the subject"
                    
                    if educational_sentences:
                        # Use a good educational sentence as the correct answer
                        options = [
                            educational_sentences[0],
                            f"This material contains no substantive information about {main_topic}.",
                            f"The content is primarily focused on administrative matters rather than {main_topic}.",
                            "None of the provided statements accurately reflect the content."
                        ]
                    else:
                        # Generic options as fallback
                        options = [
                            f"The material focuses primarily on {main_topic}.",
                            "The content does not contain any educational material.",
                            "This material is entirely unrelated to the subject matter.",
                            "None of the statements correctly describe the content."
                        ]
                    
                    correct_idx = 0  # The first option is the correct one
                    
                    questions.append({
                        "question": "Which statement best characterizes the educational content of this material?",
                        "options": options,
                        "correctIndex": correct_idx
                    })
            
            # Store questions in cache for future requests
            store_in_cache(content["id"], num_questions, "quiz", questions, request.difficulty)
            
            source_quizzes.append({
                "source": {
                    "id": content["id"],
                    "title": content["title"],
                    "type": content["type"],
                    "course_id": content["course_id"]
                },
                "questions": questions
            })
        
        return {
            "status": "success",
            "quizzes": source_quizzes,
            "sources": [{
                "id": content["id"],
                "title": content["title"],
                "type": content["type"],
                "course_id": content["course_id"]
            } for content in all_contents]
        }
        
    except Exception as e:
        logging.error(f"Error generating quiz: {str(e)}")
        return {"status": "error", "message": str(e)}

@app.get("/api/rag/status")
async def check_rag_status(current_user: dict = Depends(get_current_user)):
    """Check if the RAG API is available and return its status"""
    try:
        rag_url = os.environ.get("RAG_API_URL", "http://localhost:8001")
        
        # Try to connect to the RAG API
        try:
            response = requests.get(f"{rag_url}/test", timeout=5)
            is_available = response.status_code == 200
            status_message = "Available" if is_available else f"Error: Status code {response.status_code}"
            
            # Get additional info if available
            version = None
            if is_available:
                try:
                    root_response = requests.get(f"{rag_url}/", timeout=5)
                    if root_response.status_code == 200:
                        if "version" in root_response.json():
                            version = root_response.json()["version"]
                except Exception:
                    pass
            
            return {
                "status": "success",
                "rag_available": is_available,
                "rag_url": rag_url,
                "message": status_message,
                "version": version
            }
        except requests.exceptions.RequestException as e:
            return {
                "status": "success",
                "rag_available": False,
                "rag_url": rag_url,
                "message": f"Connection error: {str(e)}"
            }
    except Exception as e:
        logging.error(f"Error checking RAG status: {str(e)}")
        return {"status": "error", "message": str(e)}

@app.post("/api/generation/cache/clear")
async def clear_generation_cache(current_user: dict = Depends(get_current_user)):
    """Clear the generation cache"""
    try:
        global generation_cache
        cache_size = len(generation_cache)
        generation_cache = {}
        
        return {
            "status": "success",
            "message": f"Cache cleared successfully. Removed {cache_size} items."
        }
    except Exception as e:
        logging.error(f"Error clearing generation cache: {str(e)}")
        return {"status": "error", "message": str(e)}

@app.get("/api/generation/cache/info")
async def get_cache_info(current_user: dict = Depends(get_current_user)):
    """Get information about the generation cache"""
    try:
        # Count cache items by type
        counts = {
            "notecards": 0,
            "quiz": 0,
            "other": 0
        }
        
        for key in generation_cache:
            if "_notecards" in key:
                counts["notecards"] += 1
            elif "_quiz" in key:
                counts["quiz"] += 1
            else:
                counts["other"] += 1
        
        # Get the oldest and newest cache items
        if generation_cache:
            timestamps = [item["timestamp"] for item in generation_cache.values()]
            oldest = min(timestamps)
            newest = max(timestamps)
            oldest_age = time.time() - oldest
            newest_age = time.time() - newest
        else:
            oldest_age = None
            newest_age = None
        
        return {
            "status": "success",
            "cache_size": len(generation_cache),
            "item_counts": counts,
            "oldest_item_age": oldest_age,
            "newest_item_age": newest_age,
            "expiry_seconds": CACHE_EXPIRY_SECONDS
        }
    except Exception as e:
        logging.error(f"Error getting cache info: {str(e)}")
        return {"status": "error", "message": str(e)}

# Run the app with uvicorn
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 

# Add this function after sanitize_content
def clean_transcript_text(text):
    """
    Thoroughly clean and structure lecture transcript text for effective study material generation.
    Aggressively removes timestamps, markers, speaker identifiers, and other non-educational content.
    Focuses on extracting meaningful educational content only.
    """
    if not text or len(text.strip()) < 10:
        return ""
    
    # Remove common transcript artifacts
    
    # Remove timestamp patterns like [00:01:23], [01], [Minute], etc.
    text = re.sub(r'\[\d{2}:\d{2}:\d{2}\]', '', text)
    text = re.sub(r'\[\d{2}:\d{2}\]', '', text)
    text = re.sub(r'\[\d+\]', '', text)
    text = re.sub(r'\[Minute\s*\d*\]', '', text)
    text = re.sub(r'\[minute\s*\d*\]', '', text)
    
    # Remove numeric markers at start of lines like "19]"
    text = re.sub(r'^\s*\d+\]', '', text, flags=re.MULTILINE)
    text = re.sub(r'\s\d+\]', ' ', text)
    
    # Remove speaker identifiers that might appear at start of lines
    text = re.sub(r'^\s*\w+\s*:', '', text, flags=re.MULTILINE)
    
    # Remove more common transcript artifacts
    text = re.sub(r'\(inaudible\)', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\(pause\)', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\(silence\)', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\(background noise\)', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\(laughter\)', '', text, flags=re.IGNORECASE)
    
    # Remove URL artifacts that might appear in transcripts
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'www\.\S+', '', text)
    
    # Remove standard lecture introductions and housekeeping
    intro_patterns = [
        r'Hello\s+everyone',
        r'Welcome to today\'s class',
        r'So we\'ll now begin our class',
        r'Let\'s get started',
        r'Before we start',
        r'Let me share my screen',
        r'Can everyone see my screen',
        r'Is everyone ready',
        r'Thanks for joining',
        r'Good morning',
        r'Good afternoon',
        r'Let me know if you have any questions',
        r'I hope you can all hear me',
        r'Let\'s dive right in',
        r'Today we\'re going to talk about',
        r'In today\'s lecture',
        r'Any questions before we begin',
        r'Let\'s finish up there for today',
        r'That\'s all for today',
        r'See you next time',
    ]
    
    for pattern in intro_patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    
    # Remove other bracketed content
    text = re.sub(r'\[.*?\]', '', text)
    
    # Remove references to slides, modules, assignments unrelated to content
    text = re.sub(r'(?i)(today\'s lecture|this week|next week|module \d+|the deadline is|assignment|homework|due date)', '', text)
    
    # Keep important educational phrases - preserve common definitional phrases
    educational_phrases = [
        r'is defined as',
        r'refers to',
        r'is a type of',
        r'is characterized by',
        r'is composed of',
        r'consists of',
        r'there are \w+ types of',
        r'the key concept',
        r'important principles',
        r'fundamental ideas',
        r'key characteristics',
    ]
    
    # Mark these phrases to protect them from over-aggressive cleaning
    for phrase in educational_phrases:
        marker = f"__PRESERVE_PHRASE_{educational_phrases.index(phrase)}__"
        text = re.sub(phrase, marker, text, flags=re.IGNORECASE)
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    
    # Split by periods and process each sentence
    sentences = [s.strip() for s in text.split('.') if s.strip()]
    cleaned_sentences = []
    
    # Filter out non-educational sentences - those too short or containing administrative content
    admin_keywords = ['submit', 'deadline', 'due', 'grading', 'attendance', 'assignment', 'report', 'presentation']
    
    for sentence in sentences:
        # Skip short sentences
        if len(sentence) < 25:
            continue
            
        # Skip administrative content
        if any(keyword in sentence.lower() for keyword in admin_keywords):
            continue
            
        # Skip sentences that start with filler or transition phrases
        if re.match(r'^(so|um|uh|well|now|okay|all right|basically)', sentence.lower()):
            continue

        # Skip sentences with too many pronouns and vague references
        pronoun_count = len(re.findall(r'\b(it|this|that|these|those|they|them|we|our|you|your)\b', sentence.lower()))
        if pronoun_count > 5 and len(sentence) < 100:  # If short sentence with many pronouns, likely not substantive
            continue
            
        # Ensure sentence ends with proper punctuation
        if not sentence.endswith(('.', '?', '!')):
            sentence += '.'
            
        # Restore preserved educational phrases
        for i, phrase in enumerate(educational_phrases):
            marker = f"__PRESERVE_PHRASE_{i}__"
            sentence = sentence.replace(marker, phrase)
            
        cleaned_sentences.append(sentence)
    
    # Score sentences by educational value - look for technical terms, definitions, etc.
    scored_sentences = []
    for sentence in cleaned_sentences:
        score = 0
        
        # Higher score for sentences that contain educational keywords
        educational_terms = ['concept', 'principle', 'theory', 'method', 'technique', 'framework', 'model', 'approach', 'definition', 'example']
        for term in educational_terms:
            if term in sentence.lower():
                score += 2
        
        # Higher score for sentences with capitalized terms (potentially important concepts)
        capitalized_terms = re.findall(r'\b[A-Z][a-z]{2,}\b', sentence)
        score += len(capitalized_terms)
        
        # Higher score for definitional sentences
        if any(phrase in sentence.lower() for phrase in ['is defined as', 'refers to', 'is a', 'means', 'is considered']):
            score += 5
            
        # Higher score for sentences with technical or domain-specific terms
        if re.search(r'\b[a-z]+[-_][a-z]+\b', sentence) or re.search(r'\b[A-Za-z][a-z]{2,}(?:[A-Z][a-z]*)+\b', sentence):
            score += 3
        
        scored_sentences.append((sentence, score))
    
    # Sort sentences by score (higher is better) to prioritize more educational content
    scored_sentences.sort(key=lambda x: x[1], reverse=True)
    
    # Join top-scoring sentences back into paragraphs, maintaining some original order
    # by grouping related sentences
    ordered_sentences = [sentence for sentence, _ in scored_sentences]
    paragraphs = []
    current_paragraph = []
    
    for sentence in ordered_sentences:
        current_paragraph.append(sentence)
        
        # Start a new paragraph after longer sentences or those that end topics
        if len(sentence) > 100 or re.search(r'(?i)(in summary|to summarize|moving on|next|let\'s discuss)', sentence):
            if current_paragraph:
                paragraphs.append(' '.join(current_paragraph))
                current_paragraph = []
    
    # Add the last paragraph if there's content
    if current_paragraph:
        paragraphs.append(' '.join(current_paragraph))
    
    # Final cleanup
    cleaned_text = '\n\n'.join(paragraphs)
    
    # Remove any remaining obvious transcript artifacts
    cleaned_text = re.sub(r'(?i)\b(click|screen|slide|button)\b', '', cleaned_text)
    
    # Final sanity check - if we've removed too much content
    if len(cleaned_text) < 100 and len(text) > 500:
        # Fall back to a simpler cleaning approach
        simple_cleaned = re.sub(r'\[\d+\]|\[\d{2}:\d{2}(:\d{2})?\]|\[Minute\s*\d*\]', '', text)
        simple_cleaned = re.sub(r'\s+', ' ', simple_cleaned)
        return simple_cleaned.strip()
        
    return cleaned_text.strip()