module.exports = async function handler(req, res) {
  setCorsHeaders(res, "application/json");

  if (req.method === "OPTIONS") {
    return res.status(200).json({});
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const entriesTable = process.env.AIRTABLE_ENTRIES_TABLE_ID;
  const docsTable = process.env.AIRTABLE_DOCS_TABLE_ID;

  if (!token || !baseId || !entriesTable || !docsTable) {
    return res.status(500).json({
      error: "Missing Airtable environment variables in Vercel."
    });
  }

  const { table: tableParam, ...forwardedParams } = req.query || {};

  if (!tableParam) {
    return res.status(400).json({ error: "Missing table parameter." });
  }

  const [tableId, recordId] = String(tableParam).split("/");

  if (tableId !== entriesTable && tableId !== docsTable) {
    return res.status(403).json({ error: "Table not allowed." });
  }

  let airtableUrl = `https://api.airtable.com/v0/${baseId}/${tableId}`;
  if (recordId) airtableUrl += `/${recordId}`;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(forwardedParams)) {
    if (Array.isArray(value)) {
      value.forEach(function(v) { query.append(key, v); });
    } else if (value !== undefined) {
      query.append(key, value);
    }
  }
  const queryString = query.toString();
  if (queryString) airtableUrl += `?${queryString}`;

  const options = {
    method: req.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  };

  if (!["GET", "HEAD"].includes(req.method) && req.body) {
    options.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  try {
    const airtableResponse = await fetch(airtableUrl, options);
    const text = await airtableResponse.text();

    setCorsHeaders(res, airtableResponse.headers.get("content-type") || "application/json");
    return res.status(airtableResponse.status).send(text);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Airtable proxy error." });
  }
};

function setCorsHeaders(res, contentType) {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
}
