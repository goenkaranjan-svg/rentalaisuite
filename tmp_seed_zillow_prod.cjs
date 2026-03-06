const { Client } = require("pg");

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const p = await c.query(
    "select id,address,city,state,zip_code,status from properties where id=$1",
    [5],
  );
  if (!p.rows.length) {
    throw new Error("Property 5 not found in production DB");
  }

  const q = `
    insert into zillow_leads (
      external_lead_id, listing_external_id, property_external_id, manager_email,
      applicant_name, applicant_email, applicant_phone, message, move_in_date, status, raw_payload
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
    on conflict (external_lead_id)
    do update set
      listing_external_id = excluded.listing_external_id,
      property_external_id = excluded.property_external_id,
      manager_email = excluded.manager_email,
      applicant_name = excluded.applicant_name,
      applicant_email = excluded.applicant_email,
      applicant_phone = excluded.applicant_phone,
      message = excluded.message,
      move_in_date = excluded.move_in_date,
      status = excluded.status,
      raw_payload = excluded.raw_payload,
      updated_at = now()
  `;

  await c.query(q, [
    "zl-sample-5-001",
    "z-listing-5",
    "5",
    "ranjan_goenka@yahoo.com",
    "Ava Thompson",
    "ava.thompson@example.com",
    "+1-404-555-0148",
    "Interested in scheduling a tour this weekend.",
    "2026-04-01",
    "received",
    JSON.stringify({ source: "zillow", propertyId: 5, applicant: { name: "Ava Thompson", email: "ava.thompson@example.com" } }),
  ]);

  await c.query(q, [
    "zl-sample-5-002",
    "z-listing-5",
    "5",
    "ranjan_goenka@yahoo.com",
    "Noah Patel",
    "noah.patel@example.com",
    "+1-678-555-0109",
    "Can you share lease terms and pet policy?",
    "2026-04-15",
    "received",
    JSON.stringify({ source: "zillow", propertyId: 5, applicant: { name: "Noah Patel", email: "noah.patel@example.com" } }),
  ]);

  const leads = await c.query(
    "select id,external_lead_id,property_external_id,applicant_name,applicant_email,status,received_at from zillow_leads where property_external_id=$1 order by id desc limit 5",
    ["5"],
  );

  console.log(JSON.stringify({ property: p.rows[0], leads: leads.rows }, null, 2));
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
