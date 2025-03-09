from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import RedirectResponse, HTMLResponse
import os
from dotenv import load_dotenv
import logging
import re

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

# Create a router for confirmation-related endpoints
router = APIRouter(tags=["confirmation"])

# Extension URL for confirmation success page
EXTENSION_URL = os.getenv("EXTENSION_URL", "chrome-extension://")

@router.get("/auth/callback", response_class=HTMLResponse)
async def auth_callback(request: Request):
    """
    Handle authentication callbacks from Supabase.
    This endpoint is called when a user confirms their email.
    Instead of showing a JSON response, it redirects to the extension's confirmation success page.
    """
    try:
        # Log the callback
        logger.info(f"Auth callback received: {request.url}")
        
        # Extract the token from the URL if present
        url_str = str(request.url)
        token_match = re.search(r'access_token=([^&]+)', url_str)
        token = token_match.group(1) if token_match else None
        
        if token:
            logger.info(f"Token found in callback URL")
        
        # Create HTML that redirects to the extension's confirmation success page
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Email Confirmed - FaciliGator</title>
            <meta http-equiv="refresh" content="5;url=chrome-extension://{extension_id}/popup/confirmation-success.html">
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
                .success-icon {
                    font-size: 64px;
                    color: #4caf50;
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
                .note {
                    font-size: 14px;
                    color: #666;
                    margin-top: 30px;
                }
                .redirect-link {
                    display: inline-block;
                    margin-top: 20px;
                    color: #1a73e8;
                    text-decoration: none;
                    font-weight: 500;
                }
                .redirect-link:hover {
                    text-decoration: underline;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success-icon">✓</div>
                <h1>Email Confirmed Successfully!</h1>
                <p>Your email has been confirmed and your account is now active.</p>
                <p>You can now return to the FaciliGator extension and log in to access all features.</p>
                <p>You will be automatically redirected to the extension in 5 seconds.</p>
                <a href="chrome-extension://{extension_id}/popup/confirmation-success.html" class="redirect-link">
                    Click here if you are not redirected automatically
                </a>
                <p class="note">This window can be closed after redirection.</p>
            </div>
            <script>
                // Attempt to open the extension if possible
                setTimeout(function() {
                    try {
                        // Try to open the extension's confirmation success page
                        window.location.href = 'chrome-extension://{extension_id}/popup/confirmation-success.html';
                    } catch (e) {
                        console.error('Could not open extension:', e);
                    }
                }, 5000);
            </script>
        </body>
        </html>
        """
        
        return HTMLResponse(content=html_content, status_code=200)
    except Exception as e:
        logger.error(f"Error in auth callback: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing confirmation: {str(e)}"
        ) 