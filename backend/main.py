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
        
        # Log the full response from Supabase update
        logger.info(f"Supabase update recording response object: {update_response}")
        
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

# ==================== END DEVELOPMENT ENDPOINTS ====================

# Import and include the render module
if importlib.util.find_spec("render"):
    import render
    app.include_router(render.router)

# Import and include the confirmation module
if importlib.util.find_spec("confirmation"):
    import confirmation
    app.include_router(confirmation.router)

# Run the app with uvicorn
if __name__ == "__main__":
    import uvicorn
    
    # Run startup SQL scripts
    try:
        with open("startup_scripts.sql", "r") as f:
            startup_sql = f.read()
        
        logger.info("Running startup SQL scripts...")
        # Use the supabase_admin client to run the SQL directly
        result = supabase_admin.rpc("exec_sql", {"sql": startup_sql}).execute()
        logger.info(f"Startup SQL result: {result}")
    except Exception as e:
        logger.error(f"Error running startup SQL scripts: {e}")
    
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 