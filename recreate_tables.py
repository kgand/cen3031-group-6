import requests
import sys

# Get auth token from command line arguments
if len(sys.argv) < 2:
    print("Please provide your authentication token as an argument")
    sys.exit(1)

auth_token = sys.argv[1]
# Remove "Bearer " prefix if present
if auth_token.startswith("Bearer "):
    auth_token = auth_token[7:]

# Call the dev/create-tables endpoint
url = 'http://localhost:8000/dev/create-tables'
headers = {
    'Authorization': f'Bearer {auth_token}',
    'Content-Type': 'application/json'
}

print("Calling dev/create-tables endpoint to recreate tables with the correct schema...")
response = requests.post(url, headers=headers, json={})

# Print the response
print(f"Status code: {response.status_code}")
print(f"Response: {response.text}")

if response.status_code == 200:
    print("Successfully recreated tables with the correct schema!")
else:
    print("Failed to recreate tables.") 