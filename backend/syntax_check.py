import ast

try:
    with open('main.py', 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Parse the file to check for syntax errors
    ast.parse(content)
    print("Syntax is valid!")
except SyntaxError as e:
    print(f"Syntax error at line {e.lineno}, column {e.offset}: {e.text}")
    print(f"Error message: {str(e)}")
except Exception as e:
    print(f"Error: {str(e)}") 