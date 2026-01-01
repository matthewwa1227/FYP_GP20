This is my db

select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by table_name;

| table_schema | table_name           |
| ------------ | -------------------- |
| public       | achievements         |
| public       | daily_goals          |
| public       | student_achievements |
| public       | students             |
| public       | study_sessions       |

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

| table_name           | column_name         | data_type                   | is_nullable | column_default              |
| -------------------- | ------------------- | --------------------------- | ----------- | --------------------------- |
| achievements         | id                  | uuid                        | NO          | uuid_generate_v4()          |
| achievements         | name                | character varying           | NO          | null                        |
| achievements         | description         | text                        | NO          | null                        |
| achievements         | icon                | character varying           | YES         | null                        |
| achievements         | category            | character varying           | YES         | null                        |
| achievements         | requirement_type    | character varying           | NO          | null                        |
| achievements         | requirement_value   | integer                     | NO          | null                        |
| achievements         | points_reward       | integer                     | YES         | 0                           |
| achievements         | badge_tier          | character varying           | YES         | 'bronze'::character varying |
| achievements         | created_at          | timestamp with time zone    | YES         | CURRENT_TIMESTAMP           |
| achievements         | is_active           | boolean                     | YES         | true                        |
| daily_goals          | id                  | uuid                        | NO          | uuid_generate_v4()          |
| daily_goals          | student_id          | uuid                        | NO          | null                        |
| daily_goals          | goal_date           | date                        | NO          | null                        |
| daily_goals          | target_minutes      | integer                     | NO          | 60                          |
| daily_goals          | completed_minutes   | integer                     | YES         | 0                           |
| daily_goals          | is_completed        | boolean                     | YES         | false                       |
| daily_goals          | created_at          | timestamp with time zone    | YES         | CURRENT_TIMESTAMP           |
| daily_goals          | completed_at        | timestamp with time zone    | YES         | null                        |
| student_achievements | id                  | uuid                        | NO          | uuid_generate_v4()          |
| student_achievements | student_id          | uuid                        | NO          | null                        |
| student_achievements | achievement_id      | uuid                        | NO          | null                        |
| student_achievements | unlocked_at         | timestamp with time zone    | YES         | CURRENT_TIMESTAMP           |
| student_achievements | progress            | integer                     | YES         | 0                           |
| student_leaderboard  | id                  | uuid                        | YES         | null                        |
| student_leaderboard  | username            | character varying           | YES         | null                        |
| student_leaderboard  | full_name           | character varying           | YES         | null                        |
| student_leaderboard  | avatar_url          | text                        | YES         | null                        |
| student_leaderboard  | total_points        | integer                     | YES         | null                        |
| student_leaderboard  | current_level       | integer                     | YES         | null                        |
| student_leaderboard  | total_study_minutes | integer                     | YES         | null                        |
| student_leaderboard  | total_sessions      | integer                     | YES         | null                        |
| student_leaderboard  | streak_days         | integer                     | YES         | null                        |
| student_leaderboard  | rank                | bigint                      | YES         | null                        |
| students             | id                  | uuid                        | NO          | uuid_generate_v4()          |
| students             | username            | character varying           | NO          | null                        |
| students             | email               | character varying           | NO          | null                        |
| students             | password_hash       | character varying           | NO          | null                        |
| students             | full_name           | character varying           | YES         | null                        |
| students             | avatar_url          | text                        | YES         | null                        |
| students             | bio                 | text                        | YES         | null                        |
| students             | total_points        | integer                     | YES         | 0                           |
| students             | current_level       | integer                     | YES         | 1                           |
| students             | experience_points   | integer                     | YES         | 0                           |
| students             | streak_days         | integer                     | YES         | 0                           |
| students             | total_study_minutes | integer                     | YES         | 0                           |
| students             | total_sessions      | integer                     | YES         | 0                           |
| students             | created_at          | timestamp with time zone    | YES         | CURRENT_TIMESTAMP           |
| students             | updated_at          | timestamp with time zone    | YES         | CURRENT_TIMESTAMP           |
| students             | last_login          | timestamp with time zone    | YES         | null                        |
| students             | level               | integer                     | YES         | 1                           |
| students             | xp                  | integer                     | YES         | 0                           |
| students             | total_study_time    | integer                     | YES         | 0                           |
| students             | current_streak      | integer                     | YES         | 0                           |
| students             | longest_streak      | integer                     | YES         | 0                           |
| study_sessions       | id                  | uuid                        | NO          | gen_random_uuid()           |
| study_sessions       | student_id          | uuid                        | NO          | null                        |
| study_sessions       | subject             | character varying           | NO          | null                        |
| study_sessions       | topic               | character varying           | YES         | null                        |
| study_sessions       | started_at          | timestamp without time zone | NO          | CURRENT_TIMESTAMP           |
| study_sessions       | ended_at            | timestamp without time zone | YES         | null                        |
| study_sessions       | duration            | integer                     | YES         | 0                           |
| study_sessions       | xp_earned           | integer                     | YES         | 0                           |
| study_sessions       | notes               | text                        | YES         | null                        |
| study_sessions       | is_active           | boolean                     | YES         | true                        |
| study_sessions       | status              | character varying           | YES         | 'active'::character varying |
| study_sessions       | created_at          | timestamp without time zone | YES         | CURRENT_TIMESTAMP           |
| study_sessions       | updated_at          | timestamp without time zone | YES         | CURRENT_TIMESTAMP           |
| study_sessions       | focus_score         | integer                     | YES         | 0                           |

select
  tc.table_name,
  kcu.column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type = 'PRIMARY KEY'
order by tc.table_name, kcu.ordinal_position;

| table_name           | column_name |
| -------------------- | ----------- |
| achievements         | id          |
| daily_goals          | id          |
| student_achievements | id          |
| students             | id          |
| study_sessions       | id          |

select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
order by tc.table_name;

| table_name           | column_name    | foreign_table_name | foreign_column_name |
| -------------------- | -------------- | ------------------ | ------------------- |
| daily_goals          | student_id     | students           | id                  |
| student_achievements | achievement_id | achievements       | id                  |
| student_achievements | student_id     | students           | id                  |
| study_sessions       | student_id     | students           | id                  |

select relname as table_name, n_live_tup as approx_rows
from pg_stat_user_tables
order by approx_rows desc;

| table_name                 | approx_rows |
| -------------------------- | ----------- |
| student_achievements       | 13          |
| study_sessions             | 3           |
| migrations                 | 1           |
| oauth_consents             | 0           |
| mfa_challenges             | 0           |
| flow_state                 | 0           |
| daily_goals                | 0           |
| s3_multipart_uploads_parts | 0           |
| one_time_tokens            | 0           |
| sessions                   | 0           |
| objects                    | 0           |
| buckets_analytics          | 0           |
| achievements               | 0           |
| oauth_authorizations       | 0           |
| audit_log_entries          | 0           |
| schema_migrations          | 0           |
| mfa_factors                | 0           |
| saml_providers             | 0           |
| subscription               | 0           |
| users                      | 0           |
| s3_multipart_uploads       | 0           |
| refresh_tokens             | 0           |
| buckets_vectors            | 0           |
| students                   | 0           |
| secrets                    | 0           |
| prefixes                   | 0           |
| sso_domains                | 0           |
| schema_migrations          | 0           |
| oauth_client_states        | 0           |
| vector_indexes             | 0           |
| messages                   | 0           |
| sso_providers              | 0           |
| identities                 | 0           |
| saml_relay_states          | 0           |
| oauth_clients              | 0           |
| instances                  | 0           |
| buckets                    | 0           |
| mfa_amr_claims             | 0           |