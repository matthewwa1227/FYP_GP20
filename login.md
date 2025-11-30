Microsoft Windows [Version 10.0.26100.7171]
(c) Microsoft Corporation. All rights reserved.

C:\Users\eeapp>curl -X POST http://localhost:5000/api/sessions/start ^
More? -H "Content-Type: application/json" ^
More? -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiI2NmE3MWUxZi0yYjY3LTQ3MzEtOWI2Yi01ZDkxYjMxZTQwYzQiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDMwMTU1MywiZXhwIjoxNzY0Mzg3OTUzfQ.b-_U4boVki5q14cwFAWP2rf_Cblc8AyL2tFNNeGCSqs" ^
More? -d "{\"subject\":\"Mathematics\",\"notes\":\"Studying calculus\"}"
{"success":false,"message":"Invalid or expired token."}
C:\Users\eeapp>curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"charlie\",\"email\":\"charlie@example.com\",\"password\":\"Charlie123\"}"
{"success":true,"message":"User registered successfully!","data":{"student":{"id":"ab02ac39-5a1e-4750-a02b-b711642fc97b","username":"charlie","email":"charlie@example.com","level":1,"xp":0,"total_study_time":0,"current_streak":0,"longest_streak":0,"created_at":"2025-11-29T05:06:30.501Z"},"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiJhYjAyYWMzOS01YTFlLTQ3NTAtYTAyYi1iNzExNjQyZmM5N2IiLCJlbWFpbCI6ImNoYXJsaWVAZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6ImNoYXJsaWUiLCJpYXQiOjE3NjQzOTI3OTAsImV4cCI6MTc2NDQ3OTE5MH0.R0I80W6aPAbxHxjE9HKv288Zk9zusX4-lESA_aqRgi4"}}
C:\Users\eeapp>curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"alice@example.com\",\"password\":\"Alice123\"}"
{"success":false,"message":"Invalid email or password"}
C:\Users\eeapp>curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"alice\",\"email\":\"alice@example.com\",\"password\":\"Alice123\"}"
{"success":true,"message":"User registered successfully!","data":{"student":{"id":"0c3a7672-e120-4799-b2bd-f908638242c1","username":"alice","email":"alice@example.com","level":1,"xp":0,"total_study_time":0,"current_streak":0,"longest_streak":0,"created_at":"2025-11-29T05:07:31.595Z"},"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDM5Mjg1MSwiZXhwIjoxNzY0NDc5MjUxfQ.Ja-hI4qZh8ZTlTbOa85SrQ2Dd3jxm44C1ppt4WbNj_I"}}

curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"alice@example.com\",\"password\":\"Alice123\"}"

{"success":true,"message":"Login successful!","data":{"student":{"id":"0c3a7672-e120-4799-b2bd-f908638242c1","username":"alice","email":"alice@example.com","level":1,"xp":0,"total_study_time":0,"current_streak":0,"longest_streak":0,"created_at":"2025-11-29T05:07:31.595Z"},"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDQ3Njg0OCwiZXhwIjoxNzY0NTYzMjQ4fQ.qIzcL2l7JgBC_iVwl4YkYhSYXl2YjtgaZDLm8qRLsYU"}}


# 1. Start a session
curl -X POST http://localhost:5000/api/sessions/start \-H "Content-Type: application/json" \-H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDQ3ODgzNywiZXhwIjoxNzY0NTY1MjM3fQ.nkZVwzxyc7igrIkN2skrGNhHDu1p8yfiPtp_0189m9M" \-d '{"subject":"Mathematics","topic":"Calculus"}'

curl -Method POST `
  -Uri "http://localhost:5000/api/sessions/start" `
  -Headers @{"Content-Type"="application/json"; "Authorization"="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDQ3OTc5NywiZXhwIjoxNzY0NTY2MTk3fQ.Wvf4H4UI-DJ9LSEPaytvGf3hPl2eN5yjGia_Ztcgf1s"} `
  -Body '{"subject":"Mathematics","topic":"Calculus"}'

# 2. Get active session
curl http://localhost:3000/api/sessions/active \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 3. End session
curl -X POST http://localhost:3000/api/sessions/end/SESSION_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"notes":"Great study session!"}'

   curl -Method POST -Uri "http://localhost:5000/api/sessions/end/57780f0c-8a7b-4e28-9f6e-4375060851b6" -Headers @{"Content-Type"="application/json"; "Authorization"="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDQ3OTI2NywiZXhwIjoxNzY0NTY1NjY3fQ.fsEkqdEdvOPT8mcc8QVu10q8nlZzd0u3SeYj-ZCjVMs"}

# 4. Get session history
curl http://localhost:3000/api/sessions/history?page=1&limit=10 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 5. Get stats
curl http://localhost:3000/api/sessions/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDUwNTY5MywiZXhwIjoxNzY0NTkyMDkzfQ.WvMKSFAR4AB3uT8pbtGTyz0S-tZFFaiDUnznoF5YczU

# Save the token, then test:

# 1. Dashboard
curl http://localhost:5000/api/dashboard -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDUwNTY5MywiZXhwIjoxNzY0NTkyMDkzfQ.WvMKSFAR4AB3uT8pbtGTyz0S-tZFFaiDUnznoF5YczU"

# 2. Achievements
curl http://localhost:5000/api/achievements -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDUwNTY5MywiZXhwIjoxNzY0NTkyMDkzfQ.WvMKSFAR4AB3uT8pbtGTyz0S-tZFFaiDUnznoF5YczU"

# 3. Student achievements
curl http://localhost:5000/api/achievements/student -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDUwNTY5MywiZXhwIjoxNzY0NTkyMDkzfQ.WvMKSFAR4AB3uT8pbtGTyz0S-tZFFaiDUnznoF5YczU"

# 4. Leaderboard
curl http://localhost:5000/api/leaderboard/global -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDUwNTY5MywiZXhwIjoxNzY0NTkyMDkzfQ.WvMKSFAR4AB3uT8pbtGTyz0S-tZFFaiDUnznoF5YczU"

# 5. My rank
curl http://localhost:5000/api/leaderboard/my-rank -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDUwNTY5MywiZXhwIjoxNzY0NTkyMDkzfQ.WvMKSFAR4AB3uT8pbtGTyz0S-tZFFaiDUnznoF5YczU"

curl -X POST http://localhost:5000/api/achievements/check -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDUwNTY5MywiZXhwIjoxNzY0NTkyMDkzfQ.WvMKSFAR4AB3uT8pbtGTyz0S-tZFFaiDUnznoF5YczU" -H "Content-Type: application/json"

curl http://localhost:5000/api/dashboard -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDUwNTY5MywiZXhwIjoxNzY0NTkyMDkzfQ.WvMKSFAR4AB3uT8pbtGTyz0S-tZFFaiDUnznoF5YczU"

curl http://localhost:5000/api/achievements/student -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDUwNTY5MywiZXhwIjoxNzY0NTkyMDkzfQ.WvMKSFAR4AB3uT8pbtGTyz0S-tZFFaiDUnznoF5YczU"

curl -X POST http://localhost:5000/api/achievements/check -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdHVkZW50SWQiOiIwYzNhNzY3Mi1lMTIwLTQ3OTktYjJiZC1mOTA4NjM4MjQyYzEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwidXNlcm5hbWUiOiJhbGljZSIsImlhdCI6MTc2NDUwNTY5MywiZXhwIjoxNzY0NTkyMDkzfQ.WvMKSFAR4AB3uT8pbtGTyz0S-tZFFaiDUnznoF5YczU" -H "Content-Type: application/json"