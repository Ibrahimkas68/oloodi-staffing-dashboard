-- Least privilege for the running app.
-- Run as the owner after schema.sql. The app password is passed in the session setting
-- `staffing.app_password` (set with set_config by the reset script, never written in this file).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'staffing_app') THEN
    CREATE ROLE staffing_app LOGIN;
  END IF;
  EXECUTE format('ALTER ROLE staffing_app WITH LOGIN PASSWORD %L',
                 current_setting('staffing.app_password'));
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM staffing_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM staffing_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO staffing_app;

-- Read and change statuses; never insert or delete shifts or assignments.
GRANT SELECT, UPDATE ON shifts, assignments TO staffing_app;
-- Workers are read-only.
GRANT SELECT ON workers TO staffing_app;
-- Events are append-only: no UPDATE, no DELETE.
GRANT SELECT, INSERT ON events TO staffing_app;
GRANT USAGE ON SEQUENCE events_id_seq TO staffing_app;
