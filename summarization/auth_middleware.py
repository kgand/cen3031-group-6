# auth_middleware.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import os
import time
from typing import Dict, Optional
from datetime import datetime
import logging

# Configure logging
logger = logging.getLogger("auth_middleware")

# Initialize security scheme
security = HTTPBearer()

class SupabaseAuthMiddleware:
    """Middleware for handling Supabase authentication"""
    
    def __init__(self, jwt_secret: Optional[str] = None):
        """
        Initialize the auth middleware
        
        Args:
            jwt_secret: Optional custom JWT secret. If not provided, will be loaded from environment
        """
        self.jwt_secret = jwt_secret or os.getenv("JWT_SECRET")
        
        if not self.jwt_secret:
            logger.warning("JWT_SECRET not set in environment. Authentication will not work properly.")
            self.jwt_secret = "insecure-fallback-secret-do-not-use-in-production"
    
    async def get_current_user(self, credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
        """
        Validate the JWT token and return the user information
        
        Args:
            credentials: The HTTP authorization credentials containing the JWT token
            
        Returns:
            Dict containing user information from the token
            
        Raises:
            HTTPException: If the token is invalid, expired, or cannot be decoded
        """
        token = credentials.credentials
        
        try:
            # Decode and verify the token
            payload = jwt.decode(
                token, 
                self.jwt_secret, 
                algorithms=["HS256"],
                options={"verify_signature": True}
            )
            
            # Check if token is expired
            if 'exp' in payload:
                expiration = datetime.fromtimestamp(payload['exp'])
                if expiration < datetime.now():
                    logger.warning(f"Expired token used. Expired at: {expiration.isoformat()}")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Token has expired",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            
            # Ensure required claims exist
            if 'sub' not in payload:
                logger.warning("Token missing required 'sub' claim")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token format - missing subject claim",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            # Add token validation timestamp
            payload['_validated_at'] = int(time.time())
            
            logger.debug(f"Token successfully validated for user: {payload.get('sub')}")
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.warning("Token with expired signature")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        except Exception as e:
            logger.error(f"Unexpected authentication error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication error",
                headers={"WWW-Authenticate": "Bearer"},
            )

    async def get_optional_user(self, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[Dict]:
        """
        Like get_current_user but doesn't raise an exception if no valid auth is provided
        
        Args:
            credentials: The HTTP authorization credentials containing the JWT token (optional)
            
        Returns:
            Dict containing user information from the token, or None if no valid auth
        """
        if not credentials:
            return None
            
        try:
            return await self.get_current_user(credentials)
        except HTTPException:
            return None

# Create a default instance for easy importing
auth = SupabaseAuthMiddleware()

# Default dependency for enforcing authentication
get_current_user = auth.get_current_user

# Optional authentication dependency
get_optional_user = auth.get_optional_user