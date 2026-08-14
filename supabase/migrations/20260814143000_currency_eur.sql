-- First-class EUR for bunq / Revolut accounts and bank-app imports.
-- ADD VALUE must run before any statements that insert EUR rows.
alter type numa.currency_code add value if not exists 'EUR';
