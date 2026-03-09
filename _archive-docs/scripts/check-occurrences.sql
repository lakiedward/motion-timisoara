-- Check the course recurrence_rule
SELECT 
    id,
    name,
    recurrence_rule,
    active
FROM courses 
WHERE id = '34f866d0-ed18-46ce-acb7-a92d9131f6e1';

-- Check all occurrences for this course
SELECT 
    id,
    starts_at,
    ends_at,
    EXTRACT(DOW FROM starts_at) as day_of_week,
    CASE EXTRACT(DOW FROM starts_at)::integer
        WHEN 0 THEN 'Duminică'
        WHEN 1 THEN 'Luni'
        WHEN 2 THEN 'Marți'
        WHEN 3 THEN 'Miercuri'
        WHEN 4 THEN 'Joi'
        WHEN 5 THEN 'Vineri'
        WHEN 6 THEN 'Sâmbătă'
    END as day_name
FROM course_occurrences 
WHERE course_id = '34f866d0-ed18-46ce-acb7-a92d9131f6e1'
ORDER BY starts_at;

-- Count occurrences by day of week
SELECT 
    CASE EXTRACT(DOW FROM starts_at)::integer
        WHEN 0 THEN 'Duminică'
        WHEN 1 THEN 'Luni'
        WHEN 2 THEN 'Marți'
        WHEN 3 THEN 'Miercuri'
        WHEN 4 THEN 'Joi'
        WHEN 5 THEN 'Vineri'
        WHEN 6 THEN 'Sâmbătă'
    END as day_name,
    COUNT(*) as count
FROM course_occurrences 
WHERE course_id = '34f866d0-ed18-46ce-acb7-a92d9131f6e1'
GROUP BY EXTRACT(DOW FROM starts_at)
ORDER BY EXTRACT(DOW FROM starts_at);

-- Check upcoming occurrences only
SELECT 
    id,
    starts_at,
    ends_at,
    CASE EXTRACT(DOW FROM starts_at)::integer
        WHEN 0 THEN 'Duminică'
        WHEN 1 THEN 'Luni'
        WHEN 2 THEN 'Marți'
        WHEN 3 THEN 'Miercuri'
        WHEN 4 THEN 'Joi'
        WHEN 5 THEN 'Vineri'
        WHEN 6 THEN 'Sâmbătă'
    END as day_name
FROM course_occurrences 
WHERE course_id = '34f866d0-ed18-46ce-acb7-a92d9131f6e1'
  AND starts_at > NOW()
ORDER BY starts_at
LIMIT 10;

