#rag_diagnostic.py
"""
RAG System Diagnostic Tool

This script performs a comprehensive check of all RAG system components
to help diagnose issues like the 500 Internal Server Error.

Usage:
  python rag_diagnostic.py [--doc-id=<doc_id>] [--token=<token>]

Options:
  --doc-id=<doc_id>    Specific document ID to test
  --token=<token>      Authentication token to use for requests

The script will:
1. Test basic server connectivity
2. Check Supabase connection
3. List all documents
4. Verify specific document existence and content
5. Test document querying with detailed logging
"""

import requests
import json
import time
import sys
import os
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.markdown import Markdown
from rich.progress import Progress
from docopt import docopt

# Configuration
API_BASE_URL = "http://localhost:8000"
console = Console()

# File to store authentication token
TOKEN_FILE = os.path.join(os.path.expanduser("~"), ".rag_token")

def get_auth_token(provided_token=None):
    """Get the authentication token from parameter, file, or environment."""
    if provided_token:
        return provided_token
        
    # Try from file
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r") as f:
            token = f.read().strip()
            if token:
                return token
    
    # Then try from environment
    return os.getenv("RAG_AUTH_TOKEN")

def get_auth_headers(token=None):
    """Get headers with authorization token if available."""
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers

def print_section(title):
    """Print a section header"""
    console.print(f"\n[bold cyan]{'=' * 20} {title} {'=' * 20}[/bold cyan]\n")

def test_server_connection():
    """Test basic server connectivity"""
    print_section("Testing Server Connection")
    
    try:
        response = requests.get(f"{API_BASE_URL}/test", timeout=5)
        if response.status_code == 200:
            data = response.json()
            console.print(f"[bold green]Server is running correctly[/bold green]")
            console.print(f"Test ID: {data.get('test_id')}")
            console.print(f"Timestamp: {data.get('timestamp')}")
            return True
        else:
            console.print(f"[bold red]Server returned status code: {response.status_code}[/bold red]")
            console.print(response.text)
            return False
    except requests.exceptions.RequestException as e:
        console.print(f"[bold red]Error connecting to server: {str(e)}[/bold red]")
        return False

def check_supabase_connection(token=None):
    """Check Supabase connection"""
    print_section("Testing Supabase Connection")
    
    try:
        response = requests.get(
            f"{API_BASE_URL}/auth/supabase-status", 
            headers=get_auth_headers(token)
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Parse the response
            connection_ok = data.get("supabase_connection", {}).get("connection_ok", False)
            
            if connection_ok:
                console.print(f"[bold green]Supabase connection successful[/bold green]")
                
                # Display authentication status
                if data.get("authentication", {}).get("is_authenticated"):
                    user_id = data.get("authentication", {}).get("user_id")
                    console.print(f"[green]Authenticated as user: {user_id}[/green]")
                else:
                    console.print("[yellow]Not authenticated - some functions may be limited[/yellow]")
                
                # Display environment status
                env_info = data.get("environment", {})
                console.print(Panel(
                    f"JWT Secret: {'[green]✓[/green]' if env_info.get('has_jwt_secret') else '[red]✗[/red]'}\n"
                    f"Supabase URL: {'[green]✓[/green]' if env_info.get('has_supabase_url') else '[red]✗[/red]'}\n"
                    f"Supabase Key: {'[green]✓[/green]' if env_info.get('has_supabase_key') else '[red]✗[/red]'}\n"
                    f"Service Key: {'[green]✓[/green]' if env_info.get('has_service_key') else '[yellow]✗[/yellow]'}\n",
                    title="Environment Configuration"
                ))
                
                return True
            else:
                error = data.get("supabase_connection", {}).get("connection_error")
                console.print(f"[bold red]Supabase connection failed[/bold red]")
                if error:
                    console.print(f"Error: {error}")
                return False
        else:
            console.print(f"[bold red]Error checking Supabase: {response.status_code}[/bold red]")
            console.print(response.text)
            return False
    except requests.exceptions.RequestException as e:
        console.print(f"[bold red]Error connecting to Supabase status endpoint: {str(e)}[/bold red]")
        return False

def list_documents(token=None):
    """List all documents in the system"""
    print_section("Listing All Documents")
    
    try:
        response = requests.get(
            f"{API_BASE_URL}/documents",
            headers=get_auth_headers(token)
        )
        
        if response.status_code == 200:
            documents = response.json()
            
            if not documents:
                console.print("[yellow]No documents found in the system[/yellow]")
                return []
            
            table = Table(title=f"Documents ({len(documents)})")
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
            return documents
        else:
            console.print(f"[bold red]Error listing documents: {response.status_code}[/bold red]")
            console.print(response.text)
            return []
    except requests.exceptions.RequestException as e:
        console.print(f"[bold red]Error connecting to documents endpoint: {str(e)}[/bold red]")
        return []

def check_document_content(doc_id, token=None):
    """Check detailed document content"""
    print_section(f"Checking Document: {doc_id}")
    
    try:
        # Get document details directly
        response = requests.get(
            f"{API_BASE_URL}/documents/{doc_id}",
            headers=get_auth_headers(token)
        )
        
        if response.status_code == 200:
            doc_data = response.json()
            
            content_panel = Panel(
                f"Title: {doc_data.get('title')}\n"
                f"Type: {doc_data.get('document_type')}\n"
                f"Content Length: {doc_data.get('content_length')} characters\n"
                f"Created At: {doc_data.get('created_at')}\n\n"
                f"Content Preview:\n{doc_data.get('content_preview', 'No preview available')}"
            )
            
            console.print(content_panel)
            
            # Check if content is valid
            if doc_data.get('content_length', 0) == 0:
                console.print("[bold red]WARNING: Document has zero content length![/bold red]")
                return False
            
            console.print(f"[green]Document {doc_id} retrieved successfully[/green]")
            return True
        else:
            console.print(f"[bold red]Error retrieving document: {response.status_code}[/bold red]")
            console.print(response.text)
            return False
    except requests.exceptions.RequestException as e:
        console.print(f"[bold red]Error connecting to document endpoint: {str(e)}[/bold red]")
        return False

def test_query(doc_id, token=None, query_text="Summarize the main points"):
    """Test query processing for a document"""
    print_section(f"Testing Query: '{query_text}'")
    
    try:
        console.print(f"Submitting query to document ID: {doc_id}")
        
        payload = {
            "query": query_text,
            "document_ids": [doc_id],
            "top_k": 3
        }
        
        # Use the main query endpoint
        with Progress() as progress:
            task = progress.add_task("Processing query...", total=1)
            
            try:
                # Use a longer timeout for processing
                response = requests.post(
                    f"{API_BASE_URL}/query",
                    json=payload,
                    headers={**get_auth_headers(token), "Content-Type": "application/json"},
                    timeout=60
                )
                progress.update(task, advance=1)
                
                if response.status_code == 200:
                    result = response.json()
                    display_query_result(result)
                    return result.get("success", False)
                else:
                    console.print(f"[bold red]Error processing query: {response.status_code}[/bold red]")
                    try:
                        error_detail = response.json()
                        console.print(f"Error details: {json.dumps(error_detail, indent=2)}")
                    except:
                        console.print(response.text)
                    
                    # Try diagnostic endpoint as fallback
                    console.print("[yellow]Trying diagnostic endpoint as fallback...[/yellow]")
                    return test_pipeline(doc_id, token, query_text)
            except requests.exceptions.Timeout:
                console.print("[yellow]Query timed out, trying diagnostic endpoint...[/yellow]")
                return test_pipeline(doc_id, token, query_text)
            except requests.exceptions.RequestException as e:
                console.print(f"[bold red]Error with query: {str(e)}[/bold red]")
                return test_pipeline(doc_id, token, query_text)
                
    except Exception as e:
        console.print(f"[bold red]Error setting up query test: {str(e)}[/bold red]")
        return False

def test_pipeline(doc_id, token=None, query_text="Summarize the main points"):
    """Test with the full pipeline diagnostic endpoint"""
    try:
        console.print("[yellow]Using full pipeline diagnostic endpoint...[/yellow]")
        
        # Use the diagnostic endpoint
        response = requests.post(
            f"{API_BASE_URL}/diagnostic/full-pipeline/{doc_id}",
            params={"query": query_text},
            headers=get_auth_headers(token),
            timeout=60  # Longer timeout
        )
        
        if response.status_code == 200:
            result = response.json()
            
            # Display processing steps
            steps = result.get("steps", {})
            
            table = Table(title="Pipeline Steps")
            table.add_column("Step", style="cyan")
            table.add_column("Status", justify="center")
            table.add_column("Details")
            
            for step_name, step_data in steps.items():
                success = step_data.get("success", False)
                status = f"[green]✓[/green]" if success else f"[red]✗[/red]"
                
                details = ""
                if success:
                    if step_name == "document_retrieval":
                        details = f"Content: {step_data.get('content_length', 0)} chars"
                    elif step_name == "chunking":
                        details = f"Chunks: {step_data.get('chunk_count', 0)}"
                    elif step_name == "embedding":
                        details = f"Embeddings: {step_data.get('embedding_count', 0)}"
                    elif step_name == "retrieval":
                        details = f"Retrieved: {step_data.get('retrieved_count', 0)} chunks"
                    elif step_name == "response_generation":
                        details = f"Context: {step_data.get('context_length', 0)} chars"
                else:
                    details = f"Error: {step_data.get('error', 'Unknown')}"
                
                table.add_row(step_name.replace("_", " ").title(), status, details)
            
            console.print(table)
            
            # Show overall result
            if result.get("overall_success"):
                console.print("[bold green]Pipeline test successful[/bold green]")
                
                # Display response if available
                if result.get("response"):
                    console.print(Panel(Markdown(result["response"]), title="Generated Response"))
                    
                return True
            else:
                console.print(f"[bold red]Pipeline test failed: {result.get('error', 'Unknown error')}[/bold red]")
                return False
        else:
            console.print(f"[bold red]Error with pipeline test: {response.status_code}[/bold red]")
            console.print(response.text)
            return False
    except requests.exceptions.RequestException as e:
        console.print(f"[bold red]Error with pipeline test: {str(e)}[/bold red]")
        return False

def display_query_result(result):
    """Display the results of a query in a nicely formatted way."""
    # Header section
    status_style = "green" if result.get("success") else "red"
    header_content = [
        f"[bold]Query:[/bold] {result.get('query', 'N/A')}",
        f"[bold]Status:[/bold] [{status_style}]{'Success' if result.get('success') else 'Failed'}[/{status_style}]",
        f"[bold]Documents:[/bold] {result.get('document_count', 0)}",
        f"[bold]Processing Time:[/bold] {result.get('processing_time', 0):.2f} seconds",
        f"[bold]Timestamp:[/bold] {result.get('timestamp', 'N/A')}"
    ]
    
    console.print(Panel("\n".join(header_content), title="Query Results"))
    
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

def check_auth_status(token=None):
    """Check authentication status"""
    print_section("Checking Authentication")
    
    if not token:
        console.print("[yellow]No authentication token provided[/yellow]")
        console.print("Some functionality may be limited")
        return False
        
    try:
        response = requests.get(
            f"{API_BASE_URL}/auth/test",
            headers=get_auth_headers(token)
        )
        
        if response.status_code == 200:
            data = response.json()
            console.print(f"[bold green]Authentication successful[/bold green]")
            console.print(f"User ID: {data.get('user_id')}")
            if data.get('user_info'):
                user_info = data.get('user_info')
                console.print(Panel(
                    f"Email: {user_info.get('email', 'N/A')}\n"
                    f"Role: {user_info.get('role', 'N/A')}\n"
                    f"Token Expiry: {user_info.get('exp', 'N/A')}\n",
                    title="User Information"
                ))
            return True
        elif response.status_code == 401:
            console.print("[bold red]Authentication failed - Invalid or expired token[/bold red]")
            return False
        else:
            console.print(f"[bold red]Error checking authentication: {response.status_code}[/bold red]")
            console.print(response.text)
            return False
    except requests.exceptions.RequestException as e:
        console.print(f"[bold red]Error connecting to auth test endpoint: {str(e)}[/bold red]")
        return False

def run_full_diagnostic(doc_id=None, token=None):
    """Run a full system diagnostic"""
    print_section("Starting Full RAG System Diagnostic")
    console.print(f"Testing API at: {API_BASE_URL}")
    
    # Step 1: Basic server connection
    if not test_server_connection():
        console.print("[bold red]Server connection failed, aborting diagnostic[/bold red]")
        return False
    
    # Step 2: Check authentication
    auth_ok = check_auth_status(token)
    if not auth_ok:
        console.print("[yellow]Authentication check failed, continuing with limited functionality[/yellow]")
    
    # Step 3: Database connection
    if not check_supabase_connection(token):
        console.print("[bold red]Supabase connection failed, aborting diagnostic[/bold red]")
        return False
    
    # Step 4: List documents
    documents = list_documents(token)
    if not documents:
        console.print("[bold yellow]No documents found in the system[/bold yellow]")
        console.print("You should upload a document before testing queries")
    
    # Step 5: Check specific document
    if doc_id:
        document_valid = check_document_content(doc_id, token)
        if not document_valid:
            console.print(f"[bold red]Issues detected with document {doc_id}[/bold red]")
            console.print("This may be causing your query to fail")
            return False
    elif documents:
        # Use the first document if none specified
        doc_id = documents[0]["document_id"]
        console.print(f"[yellow]No document ID specified, using first document: {doc_id}[/yellow]")
        document_valid = check_document_content(doc_id, token)
        if not document_valid:
            console.print(f"[bold red]Issues detected with document {doc_id}[/bold red]")
            return False
    else:
        console.print("[bold yellow]No documents to test, skipping document check[/bold yellow]")
        return False
    
    # Step 6: Test query
    if doc_id:
        query_success = test_query(doc_id, token)
        if not query_success:
            console.print("[bold red]Query processing failed[/bold red]")
            return False
        else:
            console.print("[bold green]Query processing succeeded[/bold green]")
            return True
    
    return True

if __name__ == "__main__":
    arguments = docopt(__doc__)
    
    # Get document ID and token from command line args
    doc_id = arguments.get('--doc-id')
    token = arguments.get('--token') or get_auth_token()
    
    if doc_id:
        console.print(f"Using document ID from command line: {doc_id}")
    
    success = run_full_diagnostic(doc_id, token)
    
    if success:
        console.print("\n[bold green]RAG System Diagnostic completed successfully[/bold green]")
        sys.exit(0)
    else:
        console.print("\n[bold red]RAG System Diagnostic found issues[/bold red]")
        sys.exit(1)