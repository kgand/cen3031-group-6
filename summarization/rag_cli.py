#rag_cli.py
"""
RAG System CLI - A command-line interface for interacting with your RAG API.

Usage:
  rag_cli.py upload <file_path> [--title=<title>] [--type=<type>] [--course-id=<course_id>]
  rag_cli.py list-docs [--type=<type>] [--course-id=<course_id>]
  rag_cli.py query <query_text> [--doc-id=<id>]... [--top-k=<num>]
  rag_cli.py delete-doc <doc_id>
  rag_cli.py auth login [--email=<email>] [--password=<password>]
  rag_cli.py auth token

Options:
  -h --help                 Show this help message and exit.
  --title=<title>           Title for the uploaded document [default: Untitled Document].
  --type=<type>             Document type (transcript or assignment) [default: transcript].
  --course-id=<course_id>   Course ID for assignments.
  --doc-id=<id>             Document ID to query (can be used multiple times).
  --top-k=<num>             Number of top chunks to retrieve [default: 3].
  --email=<email>           Email for authentication.
  --password=<password>     Password for authentication.
"""

import os
import uuid
import sys
import json
import time
import requests
import jwt
from docopt import docopt
from rich.console import Console
from rich.table import Table
from rich.markdown import Markdown
from rich.panel import Panel
from rich.progress import Progress
from dotenv import load_dotenv
from datetime import datetime, timedelta

# Import our custom logging configuration
from logging_config import setup_logging

# Configure logging
logger = setup_logging("rag_cli")

# Load environment variables
load_dotenv()

# Configuration
API_BASE_URL = "http://localhost:8000"
console = Console()

# File to store authentication token
TOKEN_FILE = os.path.join(os.path.expanduser("~"), ".rag_token")

def get_auth_token():
    """Get the authentication token from file or environment."""
    # First try from file
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r") as f:
            token = f.read().strip()
            if token:
                return token
    
    # Then try from environment
    return os.getenv("RAG_AUTH_TOKEN")

def save_auth_token(token):
    """Save the authentication token to file."""
    with open(TOKEN_FILE, "w") as f:
        f.write(token)
    console.print(f"[green]Token saved to {TOKEN_FILE}[/green]")

def get_auth_headers():
    """Get the headers with authorization token if available."""
    headers = {"Content-Type": "application/json"}
    token = get_auth_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers

def login(email=None, password=None):
    """Login to get an authentication token."""
    # Get credentials if not provided
    if not email:
        email = console.input("[cyan]Email: [/cyan]")
    if not password:
        password = console.input("[cyan]Password: [/cyan]", password=True)
    
    # For demonstration purposes, we'll generate a token locally
    # In a real app, you'd authenticate against Supabase or another auth provider
    try:
        # Get JWT secret from environment
        jwt_secret = os.getenv("JWT_SECRET")
        if not jwt_secret:
            console.print("[bold red]Error:[/bold red] JWT_SECRET not found in environment variables.")
            return False
        
        # Create a payload with reasonable defaults
        payload = {
            "sub": str(uuid.uuid4()),  # User ID
            "email": email,
            "name": email.split("@")[0],
            "role": "authenticated",
            "exp": int((datetime.utcnow() + timedelta(days=7)).timestamp()),
            "iat": int(datetime.utcnow().timestamp())
        }
        
        # Generate token
        token = jwt.encode(payload, jwt_secret, algorithm="HS256")
        
        # Save the token
        save_auth_token(token)
        console.print("[bold green]Login successful![/bold green]")
        return True
    except Exception as e:
        logger.error(f"Login error: {str(e)}", exc_info=True)
        console.print(f"[bold red]Login error:[/bold red] {str(e)}")
        return False

def display_token():
    """Display the current authentication token."""
    token = get_auth_token()
    if not token:
        console.print("[bold yellow]No authentication token found.[/bold yellow]")
        console.print("Use 'rag_cli.py auth login' to get a token.")
        return False
    
    # Try to decode token for display
    try:
        # Decode without verification for display
        decoded = jwt.decode(token, options={"verify_signature": False})
        
        # Check expiration
        exp = decoded.get("exp", 0)
        now = int(datetime.utcnow().timestamp())
        is_expired = exp < now
        
        # Display token info
        console.print(Panel.fit(
            f"[bold]Token:[/bold] {token}\n\n"
            f"[bold]User ID:[/bold] {decoded.get('sub', 'Unknown')}\n"
            f"[bold]Email:[/bold] {decoded.get('email', 'Unknown')}\n"
            f"[bold]Expires:[/bold] {'[red]Expired[/red]' if is_expired else datetime.fromtimestamp(exp).strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"[bold]Role:[/bold] {decoded.get('role', 'Unknown')}",
            title="Authentication Token"
        ))
        
        # Copy to clipboard if available
        try:
            import pyperclip
            pyperclip.copy(token)
            console.print("[green]Token copied to clipboard[/green]")
        except ImportError:
            pass
            
        return True
    except Exception as e:
        console.print(f"[bold yellow]Warning:[/bold yellow] Could not decode token - {str(e)}")
        console.print(f"Raw token: {token}")
        return True

def upload_document(file_path, title, doc_type="transcript", course_id=None):
    """Upload a document to the RAG system."""
    if not os.path.exists(file_path):
        console.print(f"[bold red]Error:[/bold red] File not found: {file_path}")
        logger.error(f"Upload failed: File not found: {file_path}")
        return False
    
    try:
        with Progress() as progress:
            task = progress.add_task("[cyan]Uploading document...", total=1)
            
            with open(file_path, 'rb') as file:
                files = {'file': file}
                data = {
                    'title': title or os.path.basename(file_path),
                    'document_type': doc_type
                }
                
                if course_id:
                    data['course_id'] = course_id
                
                logger.info(f"Uploading file: {file_path}, title: {data['title']}, type: {doc_type}")
                response = requests.post(
                    f"{API_BASE_URL}/documents/upload",
                    files=files,
                    data=data,
                    headers={"Authorization": f"Bearer {get_auth_token()}"}
                )
                
                progress.update(task, advance=1)
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"Document uploaded successfully: {result['document_id']}")
            console.print(Panel.fit(
                f"[bold green]Document uploaded successfully![/bold green]\n"
                f"Document ID: [cyan]{result['document_id']}[/cyan]\n"
                f"Title: {result['title']}\n"
                f"Type: {result.get('document_type', doc_type)}\n"
                f"Content Length: {result.get('content_length', 'Unknown')}"
            ))
            return True
        else:
            logger.error(f"Upload failed: HTTP {response.status_code} - {response.text}")
            console.print(f"[bold red]Error:[/bold red] {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        logger.error(f"Upload error: {str(e)}", exc_info=True)
        console.print(f"[bold red]Error:[/bold red] {str(e)}")
        return False

def list_documents(doc_type=None, course_id=None):
    """List all documents in the RAG system."""
    try:
        with Progress() as progress:
            task = progress.add_task("[cyan]Fetching documents...", total=1)
            logger.info("Fetching document list")
            
            url = f"{API_BASE_URL}/documents"
            params = {}
            if doc_type:
                params['document_type'] = doc_type
            if course_id:
                params['course_id'] = course_id
                
            response = requests.get(url, params=params, headers=get_auth_headers())
            progress.update(task, advance=1)
        
        if response.status_code == 200:
            documents = response.json()
            logger.info(f"Retrieved {len(documents)} documents")
            
            if not documents:
                console.print("[yellow]No documents found[/yellow]")
                return True
            
            table = Table(title="Documents")
            table.add_column("ID", style="cyan")
            table.add_column("Title")
            table.add_column("Type")
            table.add_column("Content Length", justify="right")
            table.add_column("Created At")
            
            for doc in documents:
                table.add_row(
                    doc["document_id"],
                    doc["title"] or "Untitled",
                    doc.get("document_type", "Unknown"),
                    str(doc.get("content_length", 0)),
                    doc["created_at"]
                )
            
            console.print(table)
            return True
        else:
            logger.error(f"List documents failed: HTTP {response.status_code} - {response.text}")
            console.print(f"[bold red]Error:[/bold red] {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        logger.error(f"List documents error: {str(e)}", exc_info=True)
        console.print(f"[bold red]Error:[/bold red] {str(e)}")
        return False

def submit_query(query_text, doc_ids, top_k):
    """Submit a query to the RAG system."""
    # Check if doc_ids is empty
    if not doc_ids:
        console.print("[bold yellow]Warning:[/bold yellow] No document IDs provided. You should specify at least one document with --doc-id")
        logger.warning("Query submitted without document IDs")
        
        # Ask user if they want to continue with all documents
        if not console.input("Do you want to query all documents instead? [y/N]: ").lower().startswith('y'):
            return False
        
        # Get all documents and use their IDs
        logger.info("Fetching all documents for query")
        try:
            response = requests.get(f"{API_BASE_URL}/documents", headers=get_auth_headers())
            if response.status_code == 200:
                all_docs = response.json()
                if not all_docs:
                    logger.warning("No documents available for querying")
                    console.print("[bold red]Error:[/bold red] No documents available. Upload some documents first.")
                    return False
                doc_ids = [doc["document_id"] for doc in all_docs]
                logger.info(f"Using all {len(doc_ids)} available documents")
                console.print(f"[bold green]Using all {len(doc_ids)} available documents[/bold green]")
            else:
                logger.error(f"Failed to fetch documents: HTTP {response.status_code}")
                console.print(f"[bold red]Error:[/bold red] Could not fetch documents: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            logger.error(f"Error fetching documents: {str(e)}")
            console.print(f"[bold red]Error:[/bold red] {str(e)}")
            return False
    
    payload = {
        "query": query_text,
        "document_ids": doc_ids,
        "top_k": int(top_k)
    }
    
    logger.info(f"Submitting query: {query_text}")
    
    try:
        with Progress() as progress:
            task = progress.add_task("[cyan]Processing query...", total=1)
            
            # For regular endpoint
            response = requests.post(
                f"{API_BASE_URL}/query",
                json=payload,
                headers={"Content-Type": "application/json", **get_auth_headers()},
                timeout=60  # Longer timeout
            )
            
            progress.update(task, advance=1)
        
        if response.status_code == 200:
            result = response.json()
            
            # Display the query result
            display_query_result(result)
            return True
        else:
            logger.error(f"Query submission failed: HTTP {response.status_code} - {response.text}")
            console.print(f"[bold red]Error:[/bold red] {response.status_code} - {response.text}")
                
            # Fall back to diagnostic endpoint if available
            if len(doc_ids) == 1:
                console.print("[yellow]Trying diagnostic endpoint as fallback...[/yellow]")
                try:
                    diag_response = requests.post(
                        f"{API_BASE_URL}/diagnostic/full-pipeline/{doc_ids[0]}",
                        params={"query": query_text},
                        headers=get_auth_headers(),
                        timeout=60
                    )
                    
                    if diag_response.status_code == 200:
                        diag_result = diag_response.json()
                        if diag_result.get("overall_success") and diag_result.get("response"):
                            console.print("[green]Diagnostic query succeeded[/green]")
                            console.print(Panel(Markdown(diag_result["response"]), title="Generated Response"))
                            return True
                except Exception:
                    pass
            return False
    
    except requests.exceptions.Timeout:
        logger.error("Request timed out")
        console.print("[bold red]Error:[/bold red] Request timed out")            
        return False
        
    except Exception as e:
        logger.error(f"Query error: {str(e)}", exc_info=True)
        console.print(f"[bold red]Error:[/bold red] {str(e)}")
        return False

def display_query_result(result):
    """Display the results of a query in a nicely formatted way."""
    # Header section
    header_content = [
        f"[bold]Query:[/bold] {result.get('query', 'N/A')}",
        f"[bold]Status:[/bold] {'[green]Success[/green]' if result.get('success') else '[red]Failed[/red]'}",
        f"[bold]Documents:[/bold] {result.get('document_count', 0)}",
        f"[bold]Processing Time:[/bold] {result.get('processing_time', 0):.2f} seconds",
        f"[bold]Timestamp:[/bold] {result.get('timestamp', 'N/A')}"
    ]
    
    console.print(Panel.fit("\n".join(header_content), title="Query Results"))
    
    # Display error if present
    if result.get("error"):
        console.print(Panel(f"[bold red]{result['error']}[/bold red]", title="Error"))
        return
    
    # Display retrieved chunks if present
    if result.get("retrieved_chunks"):
        console.print("[bold]Retrieved Chunks:[/bold]")
        for i, chunk in enumerate(result["retrieved_chunks"], 1):
            source_info = ""
            if isinstance(chunk, dict) and "source" in chunk:
                # Handle case where chunks include source information
                source_info = f" (from {chunk['source']})"
                chunk_text = chunk["text"]
            else:
                chunk_text = chunk
                
            console.print(Panel(chunk_text, title=f"Chunk {i}{source_info}"))
    
    # Display response if present
    if result.get("response"):
        console.print(Panel(Markdown(result["response"]), title="Generated Response"))

def delete_document(doc_id):
    """Delete a document from the RAG system."""
    try:
        with Progress() as progress:
            task = progress.add_task("[cyan]Deleting document...", total=1)
            logger.info(f"Deleting document: {doc_id}")
            response = requests.delete(
                f"{API_BASE_URL}/documents/{doc_id}", 
                headers=get_auth_headers()
            )
            progress.update(task, advance=1)
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"Document deleted successfully: {doc_id}")
            console.print(f"[bold green]Success:[/bold green] {result['message']}")
            return True
        else:
            logger.error(f"Document deletion failed: HTTP {response.status_code} - {response.text}")
            console.print(f"[bold red]Error:[/bold red] {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        logger.error(f"Document deletion error: {str(e)}", exc_info=True)
        console.print(f"[bold red]Error:[/bold red] {str(e)}")
        return False

def main():
    """Main entry point for the CLI application."""
    arguments = docopt(__doc__)
    logger.debug(f"CLI arguments: {arguments}")
    
    # Handle auth commands first
    if arguments["auth"]:
        if arguments["login"]:
            return 0 if login(arguments["--email"], arguments["--password"]) else 1
        elif arguments["token"]:
            return 0 if display_token() else 1
    
    # Check server availability
    try:
        logger.info(f"Checking server availability at {API_BASE_URL}")
        requests.get(f"{API_BASE_URL}/")
    except requests.exceptions.ConnectionError:
        logger.error(f"Cannot connect to the RAG API at {API_BASE_URL}")
        console.print(f"[bold red]Error:[/bold red] Cannot connect to the RAG API at {API_BASE_URL}")
        console.print("Make sure the server is running with: [bold]python run-fastapi.py[/bold]")
        return 1
    
    # Execute commands
    success = False
    try:
        if arguments["upload"]:
            logger.info(f"Command: upload {arguments['<file_path>']}")
            success = upload_document(
                arguments["<file_path>"],
                arguments["--title"],
                arguments["--type"] or "transcript",
                arguments["--course-id"]
            )
        elif arguments["list-docs"]:
            logger.info("Command: list-docs")
            success = list_documents(
                arguments["--type"],
                arguments["--course-id"]
            )
        elif arguments["query"]:
            logger.info(f"Command: query '{arguments['<query_text>']}'")
            success = submit_query(
                arguments["<query_text>"],
                arguments["--doc-id"],
                arguments["--top-k"] or 3
            )
        elif arguments["delete-doc"]:
            logger.info(f"Command: delete-doc {arguments['<doc_id>']}")
            success = delete_document(arguments["<doc_id>"])
        else:
            logger.error("Invalid command")
            console.print("[bold red]Invalid command[/bold red]")
            return 1
    except Exception as e:
        logger.error(f"Command execution error: {str(e)}", exc_info=True)
        console.print(f"[bold red]Error:[/bold red] {str(e)}")
        return 1
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())