-- Compatibility migration for existing databases.
-- Minimum stock is not part of the core movement-tracking workflow.
-- Keep an existing column if present, but the application no longer depends on it.
-- No destructive schema change is performed here so this migration is safe to apply
-- whether the previous products table has minimum_stock or not.

notify pgrst, 'reload schema';
