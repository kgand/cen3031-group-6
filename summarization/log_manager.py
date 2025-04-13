#log_manager.py
#!/usr/bin/env python
"""
Log Manager for RAG System

This script manages log files for the RAG system:
1. Ensures the logs directory exists
2. Cleans up old log files (keeping the most recent N days)
3. Adds a console script to view recent logs

Usage:
  log_manager.py setup
  log_manager.py cleanup [--days=<days>]
  log_manager.py view [--lines=<lines>] [--component=<component>]
  log_manager.py tail [--component=<component>]

Options:
  -h --help                 Show this help message and exit.
  --days=<days>             Number of days of logs to keep [default: 7].
  --lines=<lines>           Number of lines to view [default: 100].
  --component=<component>   Component logs to view (all, rag_api, rag_system, rag_cli, rag_server) [default: all].
"""

import os
import sys
import time
import glob
import shutil
from datetime import datetime, timedelta
from docopt import docopt
import subprocess

def ensure_logs_directory():
    """Ensure the logs directory exists"""
    if not os.path.exists("logs"):
        print("Creating logs directory...")
        os.makedirs("logs")
        print("logs directory created.")
    else:
        print("logs directory already exists.")

def cleanup_old_logs(days=7):
    """Clean up log files older than specified days"""
    if not os.path.exists("logs"):
        print("No logs directory found.")
        return
    
    print(f"Cleaning up logs older than {days} days...")
    
    # Calculate cutoff date
    cutoff_date = datetime.now() - timedelta(days=int(days))
    cutoff_timestamp = cutoff_date.timestamp()
    
    # Get all log files
    log_files = glob.glob("logs/*.log")
    removed_count = 0
    
    for log_file in log_files:
        # Skip the main consolidated log
        if log_file == "logs/rag_system_all.log":
            continue
            
        file_timestamp = os.path.getmtime(log_file)
        if file_timestamp < cutoff_timestamp:
            print(f"Removing old log: {log_file}")
            os.remove(log_file)
            removed_count += 1
    
    if removed_count > 0:
        print(f"Removed {removed_count} old log files.")
    else:
        print("No old log files to remove.")
    
    # Rotate the main log if it's too large (> 10MB)
    main_log = "logs/rag_system_all.log"
    if os.path.exists(main_log) and os.path.getsize(main_log) > 10 * 1024 * 1024:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_log = f"logs/rag_system_all_{timestamp}.log"
        print(f"Main log file is large, rotating to: {backup_log}")
        shutil.copy2(main_log, backup_log)
        with open(main_log, 'w') as f:
            f.write(f"Log rotated at {datetime.now().isoformat()}\n")

def view_logs(lines=100, component="all"):
    """View recent logs"""
    if not os.path.exists("logs"):
        print("No logs directory found.")
        return
    
    log_file = "logs/rag_system_all.log"  # Default to consolidated log
    
    if component != "all" and os.path.exists(f"logs/{component}.log"):
        log_file = f"logs/{component}.log"
    
    if not os.path.exists(log_file):
        print(f"Log file {log_file} not found.")
        return
    
    # Use tail to get last N lines
    try:
        command = ["tail", f"-{lines}", log_file]
        output = subprocess.check_output(command, universal_newlines=True)
        print(f"\n=== Last {lines} lines from {log_file} ===\n")
        print(output)
    except Exception as e:
        print(f"Error viewing logs: {str(e)}")
        # Fallback if tail command is not available
        try:
            with open(log_file, 'r') as f:
                content = f.readlines()
                print(f"\n=== Last {lines} lines from {log_file} ===\n")
                for line in content[-int(lines):]:
                    print(line, end='')
        except Exception as e2:
            print(f"Error reading log file: {str(e2)}")

def tail_logs(component="all"):
    """Tail logs in real-time"""
    if not os.path.exists("logs"):
        print("No logs directory found.")
        return
    
    log_file = "logs/rag_system_all.log"  # Default to consolidated log
    
    if component != "all" and os.path.exists(f"logs/{component}.log"):
        log_file = f"logs/{component}.log"
    
    if not os.path.exists(log_file):
        print(f"Log file {log_file} not found.")
        return
    
    # Use tail -f to follow log updates
    try:
        print(f"\n=== Tailing {log_file} (Ctrl+C to exit) ===\n")
        subprocess.call(["tail", "-f", log_file])
    except KeyboardInterrupt:
        print("\nStopped tailing logs.")
    except Exception as e:
        print(f"Error tailing logs: {str(e)}")
        print("Falling back to manual tailing...")
        
        # Fallback implementation if tail -f is not available
        try:
            with open(log_file, 'r') as f:
                # Go to the end of the file
                f.seek(0, 2)
                
                print("Tailing logs (Ctrl+C to exit)...")
                while True:
                    line = f.readline()
                    if line:
                        print(line, end='')
                    else:
                        time.sleep(0.1)
        except KeyboardInterrupt:
            print("\nStopped tailing logs.")
        except Exception as e2:
            print(f"Error in manual tailing: {str(e2)}")

def main():
    """Main entry point"""
    arguments = docopt(__doc__)
    
    if arguments["setup"]:
        ensure_logs_directory()
    elif arguments["cleanup"]:
        cleanup_old_logs(arguments["--days"] or 7)
    elif arguments["view"]:
        view_logs(
            lines=arguments["--lines"] or 100,
            component=arguments["--component"] or "all"
        )
    elif arguments["tail"]:
        tail_logs(component=arguments["--component"] or "all")
    else:
        print("Invalid command. Use --help for usage information.")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())