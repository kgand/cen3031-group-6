#!/usr/bin/env python
"""
Setup script for FaciliGator backend
This script helps with setting up the environment and checking dependencies
"""

import os
import sys
import subprocess
import secrets
import shutil
from pathlib import Path

def check_python_version():
    """Check if Python version is compatible"""
    print("Checking Python version...")
    if sys.version_info < (3, 8):
        print("Error: Python 3.8 or higher is required")
        sys.exit(1)
    print(f"Using Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")

def create_venv():
    """Create a virtual environment if it doesn't exist"""
    print("Checking for virtual environment...")
    venv_path = Path("venv")
    
    if venv_path.exists():
        print("Virtual environment already exists")
        return
    
    print("Creating virtual environment...")
    try:
        subprocess.run([sys.executable, "-m", "venv", "venv"], check=True)
        print("Virtual environment created successfully")
    except subprocess.CalledProcessError:
        print("Error: Failed to create virtual environment")
        sys.exit(1)

def install_dependencies():
    """Install dependencies from requirements.txt"""
    print("Installing dependencies...")
    
    # Determine the pip path based on the platform
    pip_path = "venv/bin/pip" if os.name != "nt" else "venv\\Scripts\\pip"
    
    try:
        subprocess.run([pip_path, "install", "-r", "requirements.txt"], check=True)
        print("Dependencies installed successfully")
    except subprocess.CalledProcessError:
        print("Error: Failed to install dependencies")
        sys.exit(1)

def create_env_file():
    """Create .env file if it doesn't exist"""
    print("Checking for .env file...")
    env_path = Path(".env")
    example_path = Path(".env.example")
    
    if env_path.exists():
        print(".env file already exists")
        return
    
    if not example_path.exists():
        print("Creating .env.example file...")
        with open(example_path, "w") as f:
            f.write("""# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_key_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_here

# Server Configuration
PORT=8000
HOST=0.0.0.0
""")
    
    print("Creating .env file from .env.example...")
    shutil.copy(example_path, env_path)
    
    # Generate a random JWT secret
    jwt_secret = secrets.token_hex(32)
    
    # Read the .env file
    with open(env_path, "r") as f:
        env_content = f.read()
    
    # Replace the JWT_SECRET placeholder with the generated secret
    env_content = env_content.replace("JWT_SECRET=your_jwt_secret_here", f"JWT_SECRET={jwt_secret}")
    
    # Write the updated content back to the .env file
    with open(env_path, "w") as f:
        f.write(env_content)
    
    print(".env file created successfully with a random JWT secret")
    print("Please update the Supabase credentials in the .env file")

def main():
    """Main function"""
    print("Setting up FaciliGator backend...")
    
    check_python_version()
    create_venv()
    install_dependencies()
    create_env_file()
    
    print("\nSetup completed successfully!")
    print("\nNext steps:")
    print("1. Update the Supabase credentials in the .env file")
    print("2. Activate the virtual environment:")
    if os.name == "nt":
        print("   venv\\Scripts\\activate")
    else:
        print("   source venv/bin/activate")
    print("3. Run the server:")
    print("   uvicorn main:app --reload")

if __name__ == "__main__":
    main() 