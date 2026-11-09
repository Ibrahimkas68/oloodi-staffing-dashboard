-- Seed: one shift today, starting 2 hours after the reset (A10), three uninvited workers.

INSERT INTO shifts (title, location, starts_at, ends_at, required_workers)
SELECT 'Rabat Tech Summit · Hall Setup',
       'Main Hall, Rabat',
       start_time,
       start_time + interval '6 hours',
       3
FROM (SELECT date_trunc('minute', now() + interval '2 hours') AS start_time) AS t;

INSERT INTO workers (full_name)
VALUES ('Amina El Idrissi'), ('Youssef Benali'), ('Salma Haddad');

INSERT INTO assignments (shift_id, worker_id)
SELECT s.id, w.id
FROM shifts s
CROSS JOIN workers w
ORDER BY w.id;
