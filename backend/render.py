from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import jwt
import os

# Create a router for render-related endpoints
router = APIRouter(prefix="/render", tags=["render"])

# Authentication dependency
async def get_current_user(request):
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
        JWT_SECRET = os.getenv("JWT_SECRET")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return {"user_id": user_id, "email": payload.get("email")}
    except jwt.PyJWTError:
        raise credentials_exception

# Models
class RenderRequest(BaseModel):
    data: Dict[str, Any]
    options: Optional[Dict[str, Any]] = None

class RenderResponse(BaseModel):
    result: Dict[str, Any]
    status: str

# Routes
@router.post("/process", response_model=RenderResponse)
async def process_render(
    request: RenderRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Process render data with user authentication.
    This is a placeholder for your actual rendering logic.
    """
    try:
        # Here you would implement your actual rendering logic
        # For now, we'll just return the data with a success status
        
        # You can access the authenticated user with current_user["user_id"] and current_user["email"]
        
        return {
            "result": {
                "processed_data": request.data,
                "user_id": current_user["user_id"],
                "message": "Data processed successfully"
            },
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing render: {str(e)}"
        )

# Include the router in the main app
# This is imported in main.py
