from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv
from supabase import create_client, Client
import jwt
from datetime import datetime, timedelta
import importlib
import logging

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
JWT_SECRET = os.getenv("JWT_SECRET")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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
@app.get("/")
async def root():
    return {"message": "Welcome to FaciliGator API"}

@app.post("/auth/signup", response_model=Token)
async def signup(user: UserCreate):
    try:
        # Log the signup attempt for debugging
        logger.info(f"Signup attempt for email: {user.email}")
        
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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 