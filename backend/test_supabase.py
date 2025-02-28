#!/usr/bin/env python
"""
Test script to verify Supabase client is working correctly
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

def test_supabase_connection():
    """Test Supabase connection"""
    # Load environment variables
    load_dotenv()
    
    # Get Supabase credentials
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set in .env file")
        return False
    
    try:
        # Initialize Supabase client
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Test a simple query
        print("Testing Supabase connection...")
        print(f"Supabase URL: {supabase_url}")
        
        # Try to get the current user (this should work even if not authenticated)
        response = supabase.auth.get_user()
        print("Supabase client initialized successfully!")
        return True
    except Exception as e:
        print(f"Error connecting to Supabase: {str(e)}")
        return False

if __name__ == "__main__":
    if test_supabase_connection():
        print("✅ Supabase connection test passed")
    else:
        print("❌ Supabase connection test failed") 