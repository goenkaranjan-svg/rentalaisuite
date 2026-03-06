const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const managers = await client.query(`
    select id,email,first_name,last_name,role
    from users
    where role='manager'
    order by id
  `);

  const properties = await client.query(`
    select id,manager_id,address,city,state,status
    from properties
    order by id
  `);

  const leadSummary = await client.query(`
    select
      count(*)::int as total,
      count(distinct manager_id)::int as distinct_manager_ids,
      count(distinct manager_email)::int as distinct_manager_emails,
      array_agg(distinct manager_id) as manager_ids,
      array_agg(distinct manager_email) as manager_emails,
      array_agg(distinct property_external_id) as property_external_ids
    from zillow_leads
  `);

  const leads = await client.query(`
    select id,external_lead_id,manager_id,manager_email,property_external_id,status
    from zillow_leads
    order by id desc
  `);

  console.log(JSON.stringify({
    managers: managers.rows,
    properties: properties.rows,
    leadSummary: leadSummary.rows[0],
    leads: leads.rows,
  }, null, 2));

  await client.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
