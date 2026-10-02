-- Allow the automated schedule sync to verify that duplicate game rows have
-- no saved picks before quarantining them. Grant only the one column the
-- safety check reads; the workflow cannot read player IDs or selections.
grant select (game_id) on table public.picks to service_role;
