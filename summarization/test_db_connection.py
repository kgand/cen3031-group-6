#!/usr/bin/env python
# test_db_connection.py
import os
from dotenv import load_dotenv
from supabase import create_client
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

# Initialize console for prettier output
console = Console()

# Load environment variables
console.print("[bold cyan]Loading environment variables...[/bold cyan]")
load_dotenv()

# Get Supabase credentials
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")
service_key = os.environ.get("SUPABASE_SERVICE_KEY")

# Display credentials (without showing full key)
console.print(f"URL: {supabase_url}")
console.print(f"Anon Key: {'[green]Available[/green]' if supabase_key else '[red]Missing[/red]'}")
console.print(f"Service Key: {'[green]Available[/green]' if service_key else '[yellow]Not provided[/yellow]'}")

# Use service key if available (bypasses RLS)
if service_key:
    console.print("[yellow]Using service role key for testing (bypasses RLS)[/yellow]")
    key_to_use = service_key
else:
    key_to_use = supabase_key

try:
    # Initialize Supabase client
    console.print("\n[bold cyan]Initializing Supabase client...[/bold cyan]")
    supabase = create_client(supabase_url, key_to_use)
    
    # Test tables relevant to our system
    tables = ['zoom_transcripts', 'assignments']
    
    # Create results table
    results_table = Table(title="Supabase Connection Test Results")
    results_table.add_column("Table", style="cyan")
    results_table.add_column("Status", justify="center")
    results_table.add_column("Details")
    
    all_successful = True
    
    for table in tables:
        try:
            # Try to count records
            response = supabase.table(table).select('count', count='exact').execute()
            count = response.count if hasattr(response, 'count') else len(response.data)
            
            # Also try to get one record
            record_response = supabase.table(table).select('*').limit(1).execute()
            has_records = len(record_response.data) > 0
            
            results_table.add_row(
                table,
                "[green]✓[/green]",
                f"Found {count} records" + (f", sample ID: {record_response.data[0]['id'][:8]}..." if has_records else "")
            )
        except Exception as table_error:
            all_successful = False
            results_table.add_row(
                table,
                "[red]✗[/red]",
                f"Error: {str(table_error)}"
            )
    
    # Display results
    console.print(results_table)
    
    # Show overall result
    if all_successful:
        console.print(Panel("[bold green]All connections successful![/bold green]", title="Connection Test"))
    else:
        console.print(Panel("[bold yellow]Some connections failed. Check the table for details.[/bold yellow]", title="Connection Test"))
    
    # Optional: Test authentication if JWT_SECRET is available
    jwt_secret = os.environ.get("JWT_SECRET")
    if jwt_secret:
        console.print("\n[bold cyan]Testing JWT generation...[/bold cyan]")
        try:
            import jwt
            import datetime
            import uuid
            
            # Create a test token
            payload = {
                "sub": str(uuid.uuid4()),
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1),
                "iat": datetime.datetime.utcnow()
            }
            
            token = jwt.encode(payload, jwt_secret, algorithm="HS256")
            console.print("[green]JWT token generation successful[/green]")
        except Exception as jwt_error:
            console.print(f"[red]JWT token generation failed: {str(jwt_error)}[/red]")
    
except Exception as e:
    console.print(f"[bold red]Connection failed: {str(e)}[/bold red]")