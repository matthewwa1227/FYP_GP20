curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"alice@example.com\",\"password\":\"Alice123\"}"

  curl -X POST http://localhost:5000/api/storyquest/learn \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJpZCI6IjBjM2E3NjcyLWUxMjAtNDc5OS1iMmJkLWY5MDg2MzgyNDJjMSIsImVtYWlsIjoiYWxpY2VAZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6ImFsaWNlIiwicm9sZSI6InN0dWRlbnQiLCJmb3JtTGV2ZWwiOiJQMSIsImFnZVRpZXIiOiJQMS1QMyIsImlhdCI6MTc3MTkyNzE4MywiZXhwIjoxNzcyMDEzNTgzfQ.xmZY8Iehsd8hIGp4cHYm3_8jmMXtdP2qf4zH1IrHKBo" \
    -d '{"topic": "Photosynthesis"}'