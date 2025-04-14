import os
import requests
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get auth token from command line arguments
if len(sys.argv) < 2:
    print("Please provide your authentication token as an argument")
    sys.exit(1)

auth_token = sys.argv[1]

# Read the SQL script
with open('add_segment_count.sql', 'r') as file:
    sql_script = file.read()

# Call the dev/sql endpoint
url = 'http://localhost:8000/dev/sql'
headers = {
    'Authorization': f'Bearer {auth_token}',
    'Content-Type': 'application/json'
}
data = {
    'sql': sql_script
}

print("Sending SQL to add segment_count column to zoom_transcripts table...")
response = requests.post(url, headers=headers, json=data)

# Print the response
print(f"Status code: {response.status_code}")
print(f"Response: {response.text}")

if response.status_code == 200:
    print("Successfully added segment_count column to zoom_transcripts table!")
else:
    print("Failed to add segment_count column.") 