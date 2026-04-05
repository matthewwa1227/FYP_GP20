-- ============================================
-- STUDYQUEST REBUILD - SEED DATA
-- Question Type Templates and Examples
-- ============================================

-- ============================================
-- 1. QUESTION TYPE TEMPLATES
-- These are JSON schemas for each question type
-- ============================================

-- Create a table to store question type schemas
CREATE TABLE IF NOT EXISTS question_type_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_name TEXT UNIQUE NOT NULL,
    description TEXT,
    schema JSONB NOT NULL, -- JSON Schema for validation
    example JSONB NOT NULL, -- Example question_data
    ui_component TEXT, -- Which frontend component to use
    validation_rules JSONB, -- How to validate answers
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert question type schemas
INSERT INTO question_type_schemas (type_name, description, schema, example, ui_component, validation_rules) VALUES

-- CODE EXECUTION TYPE
('code_execution', 
 'User writes code that gets executed against test cases',
 '{
    "type": "object",
    "required": ["question", "starterCode", "testCases", "language"],
    "properties": {
        "question": {"type": "string"},
        "setup": {"type": "string"},
        "starterCode": {"type": "string"},
        "language": {"type": "string", "enum": ["python", "javascript", "sql"]},
        "testCases": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "input": {"type": "string"},
                    "expectedOutput": {"type": "string"},
                    "check": {"type": "string"}
                }
            }
        },
        "timeoutSeconds": {"type": "integer", "default": 5},
        "allowedImports": {"type": "array", "items": {"type": "string"}},
        "forbiddenPatterns": {"type": "array", "items": {"type": "string"}}
    }
}',
 '{
    "question": "Write a function to calculate the average of a list of numbers.",
    "setup": "# Test data\nnumbers = [10, 20, 30, 40, 50]",
    "starterCode": "def calculate_average(numbers):\n    # Your code here\n    pass",
    "language": "python",
    "testCases": [
        {
            "input": "[10, 20, 30, 40, 50]",
            "expectedOutput": "30.0",
            "check": "result == 30.0"
        },
        {
            "input": "[5, 5, 5]",
            "expectedOutput": "5.0",
            "check": "result == 5.0"
        }
    ],
    "timeoutSeconds": 5,
    "allowedImports": ["math"],
    "forbiddenPatterns": ["numpy", "pandas", "sum() / len()"]
}',
 'CodeExecutionQuestion',
 '{
    "type": "execute",
    "timeout": 5,
    "compare": "output_or_variable"
}'
),

-- FILL IN THE BLANK TYPE
('fill_blank',
 'User fills in missing code or words in a sentence',
 '{
    "type": "object",
    "required": ["template", "blanks"],
    "properties": {
        "template": {"type": "string"},
        "blanks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "placeholder": {"type": "string"},
                    "correctAnswer": {"type": "string"},
                    "hint": {"type": "string"},
                    "caseSensitive": {"type": "boolean", "default": false}
                }
            }
        },
        "allowPartial": {"type": "boolean", "default": false}
    }
}',
 '{
    "template": "To handle missing values in pandas, use df._____(method=''ffill'').",
    "blanks": [
        {
            "id": 1,
            "placeholder": "method_name",
            "correctAnswer": "fillna",
            "hint": "Starts with ''fill''",
            "caseSensitive": false
        }
    ],
    "allowPartial": true
}',
 'FillBlankQuestion',
 '{
    "type": "exact_match",
    "caseSensitive": false,
    "allowPartial": true
}'
),

-- ERROR ANALYSIS TYPE
('error_analysis',
 'User identifies and fixes errors in provided code',
 '{
    "type": "object",
    "required": ["code", "error", "options"],
    "properties": {
        "code": {"type": "string"},
        "error": {"type": "string"},
        "errorType": {"type": "string", "enum": ["runtime", "syntax", "logic"]},
        "options": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "text": {"type": "string"},
                    "isCorrect": {"type": "boolean"},
                    "explanation": {"type": "string"}
                }
            }
        },
        "showStackTrace": {"type": "boolean", "default": true}
    }
}',
 '{
    "code": "df[''steps''] = df[''steps''].fillna(0).astype(int)",
    "error": "ValueError: cannot convert float NaN to integer",
    "errorType": "runtime",
    "options": [
        {
            "id": 1,
            "text": "fillna(0) runs after astype(int)",
            "isCorrect": false,
            "explanation": "The order is correct, but the issue is different."
        },
        {
            "id": 2,
            "text": "fillna returns a new DataFrame; must assign the result",
            "isCorrect": true,
            "explanation": "Correct! df.fillna() returns a new DataFrame. You need: df[''steps''] = df[''steps''].fillna(0)"
        }
    ],
    "showStackTrace": true
}',
 'ErrorAnalysisQuestion',
 '{
    "type": "multiple_choice",
    "singleSelect": true
}'
),

-- CONCEPT SYNTHESIS TYPE
('concept_synthesis',
 'User combines multiple concepts to solve a problem',
 '{
    "type": "object",
    "required": ["scenario", "question", "options"],
    "properties": {
        "scenario": {"type": "string"},
        "question": {"type": "string"},
        "options": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "text": {"type": "string"},
                    "isCorrect": {"type": "boolean"},
                    "explanation": {"type": "string"}
                }
            }
        },
        "requiresArtifact": {"type": "boolean", "default": true},
        "multiSelect": {"type": "boolean", "default": false}
    }
}',
 '{
    "scenario": "Your fitness data has dates as strings. You need to: 1) Convert to datetime, 2) Extract day of week, 3) Calculate weekly averages.",
    "question": "Which sequence of operations is correct?",
    "options": [
        {
            "id": 1,
            "text": "pd.to_datetime → dt.dayofweek → groupby",
            "isCorrect": true,
            "explanation": "Correct! Convert first, then extract, then aggregate."
        },
        {
            "id": 2,
            "text": "astype(datetime) → dayofweek → pivot",
            "isCorrect": false,
            "explanation": "astype(datetime) won''t work on string dates. Use pd.to_datetime."
        }
    ],
    "requiresArtifact": true,
    "multiSelect": false
}',
 'ConceptSynthesisQuestion',
 '{
    "type": "multiple_choice",
    "singleSelect": true
}'
),

-- DEBUGGING TYPE
('debugging',
 'User fixes broken code to make it work',
 '{
    "type": "object",
    "required": ["brokenCode", "expectedBehavior", "hints"],
    "properties": {
        "brokenCode": {"type": "string"},
        "expectedBehavior": {"type": "string"},
        "hints": {"type": "array", "items": {"type": "string"}},
        "maxFixes": {"type": "integer", "default": 3},
        "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]}
    }
}',
 '{
    "brokenCode": "def load_data(file):\n    df = pd.read_csv(file)\n    df.dropna()\n    return df",
    "expectedBehavior": "Load CSV and return DataFrame with missing values removed",
    "hints": [
        "Look at what dropna() returns",
        "Are you saving the result?"
    ],
    "maxFixes": 2,
    "difficulty": "easy"
}',
 'DebuggingQuestion',
 '{
    "type": "code_comparison",
    "checkOutput": true
}'
),

-- PREDICTION TYPE
('prediction',
 'User predicts output of code before running',
 '{
    "type": "object",
    "required": ["code", "question"],
    "properties": {
        "code": {"type": "string"},
        "question": {"type": "string"},
        "options": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "output": {"type": "string"},
                    "isCorrect": {"type": "boolean"},
                    "explanation": {"type": "string"}
                }
            }
        },
        "showCodeAfter": {"type": "boolean", "default": false}
    }
}',
 '{
    "code": "df = pd.DataFrame({''A'': [1, 2, None, 4]})\nprint(df[''A''].mean())",
    "question": "What will this code output?",
    "options": [
        {
            "id": 1,
            "output": "2.333...",
            "isCorrect": false,
            "explanation": "By default, pandas skips NaN values in aggregation."
        },
        {
            "id": 2,
            "output": "2.333... (NaN skipped)",
            "isCorrect": true,
            "explanation": "Correct! pandas automatically skips NaN in mean() calculation."
        }
    ],
    "showCodeAfter": true
}',
 'PredictionQuestion',
 '{
    "type": "multiple_choice",
    "runCode": true,
    "compareOutput": true
}'
);

-- ============================================
-- 2. SKILL TREE TEMPLATES
-- Pre-defined skill trees for common topics
-- ============================================

CREATE TABLE IF NOT EXISTS skill_tree_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT UNIQUE NOT NULL,
    category TEXT, -- e.g., "data-science", "web-dev", "language"
    skill_tree JSONB NOT NULL,
    estimated_hours INTEGER,
    prerequisites TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Python for Data Analysis skill tree
INSERT INTO skill_tree_templates (topic, category, skill_tree, estimated_hours, prerequisites) VALUES
('python-data-analysis', 'data-science',
'[
    {"id": "1", "name": "Python Basics", "prerequisites": [], "unlocks": ["2"], "estimatedMinutes": 20},
    {"id": "2", "name": "Pandas Introduction", "prerequisites": ["1"], "unlocks": ["3"], "estimatedMinutes": 25},
    {"id": "3", "name": "Loading Data (CSV/Excel)", "prerequisites": ["2"], "unlocks": ["4", "5"], "estimatedMinutes": 20},
    {"id": "4", "name": "Data Cleaning", "prerequisites": ["3"], "unlocks": ["6"], "estimatedMinutes": 30},
    {"id": "5", "name": "Data Exploration", "prerequisites": ["3"], "unlocks": ["6"], "estimatedMinutes": 25},
    {"id": "6", "name": "Data Visualization", "prerequisites": ["4", "5"], "unlocks": ["boss"], "estimatedMinutes": 30},
    {"id": "boss", "name": "Complete Analysis Project", "prerequisites": ["6"], "unlocks": [], "estimatedMinutes": 45, "isBoss": true}
]'::jsonb,
180,
'[]'
),

('python-fitness-dashboard', 'data-science',
'[
    {"id": "1", "name": "Loading Health Data", "prerequisites": [], "unlocks": ["2"], "estimatedMinutes": 15},
    {"id": "2", "name": "Handling Missing Values", "prerequisites": ["1"], "unlocks": ["3"], "estimatedMinutes": 20},
    {"id": "3", "name": "DateTime Operations", "prerequisites": ["2"], "unlocks": ["4"], "estimatedMinutes": 25},
    {"id": "4", "name": "Calculating Statistics", "prerequisites": ["3"], "unlocks": ["5"], "estimatedMinutes": 20},
    {"id": "5", "name": "Creating Visualizations", "prerequisites": ["4"], "unlocks": ["boss"], "estimatedMinutes": 30},
    {"id": "boss", "name": "Build Fitness Dashboard", "prerequisites": ["5"], "unlocks": [], "estimatedMinutes": 40, "isBoss": true}
]'::jsonb,
150,
'[]'
),

('sql-data-analysis', 'data-science',
'[
    {"id": "1", "name": "SELECT Basics", "prerequisites": [], "unlocks": ["2"], "estimatedMinutes": 15},
    {"id": "2", "name": "Filtering with WHERE", "prerequisites": ["1"], "unlocks": ["3"], "estimatedMinutes": 20},
    {"id": "3", "name": "Aggregation Functions", "prerequisites": ["2"], "unlocks": ["4"], "estimatedMinutes": 25},
    {"id": "4", "name": "GROUP BY and HAVING", "prerequisites": ["3"], "unlocks": ["5"], "estimatedMinutes": 25},
    {"id": "5", "name": "JOINs", "prerequisites": ["4"], "unlocks": ["boss"], "estimatedMinutes": 30},
    {"id": "boss", "name": "Complex Analysis Query", "prerequisites": ["5"], "unlocks": [], "estimatedMinutes": 35, "isBoss": true}
]'::jsonb,
150,
'[]'
);

-- ============================================
-- 3. KNOWLEDGE ARTIFACT TEMPLATES
-- Templates for auto-generating cheat sheets
-- ============================================

CREATE TABLE IF NOT EXISTS artifact_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_pattern TEXT NOT NULL, -- Regex pattern to match topics
    title_template TEXT NOT NULL,
    content_template TEXT NOT NULL,
    tags TEXT[],
    order_index INTEGER DEFAULT 0
);

INSERT INTO artifact_templates (topic_pattern, title_template, content_template, tags, order_index) VALUES
('pandas|csv|data', 
 '{{topic}} Cheat Sheet',
 '## {{topic}} - Quick Reference

### Loading Data
```python
import pandas as pd

# Read CSV
df = pd.read_csv(''file.csv'')

# Read Excel
df = pd.read_excel(''file.xlsx'')

# Read from URL
df = pd.read_csv(''https://example.com/data.csv'')
```

### Common Operations
| Operation | Code |
|-----------|------|
| First 5 rows | `df.head()` |
| Shape | `df.shape` |
| Column types | `df.dtypes` |
| Summary stats | `df.describe()` |

### Handling Missing Data
```python
# Check missing values
df.isnull().sum()

# Drop rows with any NaN
df.dropna()

# Fill NaN with value
df.fillna(0)

# Forward fill
df.fillna(method=''ffill'')
```

### Remember
- Always check `df.shape` after operations
- Use `inplace=True` or reassign: `df = df.dropna()`
- Chain operations: `df.dropna().fillna(0)`
',
 '["pandas", "python", "data-analysis"]',
 1
),

('python|function|def',
 'Python Functions Guide',
 '## Python Functions

### Defining Functions
```python
def greet(name):
    """Docstring: Explain what function does"""
    return f"Hello, {name}!"
```

### Key Concepts
| Concept | Example |
|---------|---------|
| Parameters | `def f(x, y):` |
| Default values | `def f(x=0):` |
| Return multiple | `return a, b` |
| *args | `def f(*args):` |
| **kwargs | `def f(**kwargs):` |

### Common Patterns
```python
# Filter with function
def is_positive(n):
    return n > 0

numbers = [1, -2, 3, -4]
positive = list(filter(is_positive, numbers))

# Lambda for simple functions
square = lambda x: x ** 2
```
',
 '["python", "functions", "basics"]',
 2
);

-- ============================================
-- SEEDING COMPLETE
-- ============================================
