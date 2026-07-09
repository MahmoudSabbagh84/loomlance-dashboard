-- Add 'sent' (awaiting client signature) to the contract lifecycle, between draft and active.
-- MUST be its own migration: Postgres 15 forbids USING a newly-added enum value in the same
-- transaction that adds it, so the signing columns + RPCs live in the next migration.
alter type contract_status add value if not exists 'sent' before 'active';
