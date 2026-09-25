-- Plans (prices from docs/decisions/0001-pricing.md; update paddle_price_ids after creating products in Paddle)
insert into rf.plans (code, name, price_usd_month, price_usd_year, seats, features) values
 ('analyst',    'Analyst',    249,  2490, 1,  '{"weekly":true,"monthly_report":true,"archive":true}'),
 ('team',       'Team',       750,  7500, 5,  '{"weekly":true,"monthly_report":true,"archive":true,"portfolio_watch":true,"quarterly_call":true,"csv_export":true}'),
 ('enterprise', 'Enterprise', 2000, 20000, 999,'{"weekly":true,"monthly_report":true,"archive":true,"portfolio_watch":true,"custom_scope":true,"bespoke_report":1,"api":true,"po_invoicing":true}')
on conflict (code) do update set name = excluded.name, price_usd_month = excluded.price_usd_month, price_usd_year = excluded.price_usd_year, seats = excluded.seats, features = excluded.features;
