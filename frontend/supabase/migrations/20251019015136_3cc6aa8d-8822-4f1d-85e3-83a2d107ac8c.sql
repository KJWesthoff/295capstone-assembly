-- Add the new 'analyst' value to the user_persona enum
ALTER TYPE user_persona ADD VALUE IF NOT EXISTS 'analyst';