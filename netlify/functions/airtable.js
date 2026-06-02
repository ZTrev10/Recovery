exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return response(200, {});
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const entriesTable = process.env.AIRTABLE_ENTRIES_TABLE_ID;
  const docsTable = process.env.AIRTABLE_DOCS_TABLE_ID;

  if (!token || !baseId || !entriesTable || !docsTable) {
    return response(500, {
      error: "Missing Airtable environment variables in Netlify."
    });
  }

  const params = event.queryStringParameters || {};
  const tableParam = params.table;

  if (!tableParam) {
    return response(400, { error: "Missing table parameter." });
  }

  const parts = tableParam.split("/");
  const tableId = parts[0];
  const recordId = parts[1];

  if (tableId !== entriesTable && tableId !== docsTable) {
    return response(403, { error: "Table not allowed." });
  }

  let airtableUrl = `https://api.airtable.com/v0/${baseId}/${tableId}`;
  if (recordId) airtableUrl += `/${recordId}`;

  const forwardParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "table") forwardParams.append(key, value);
  }
  const query = forwardParams.toString();
  if (query) airtableUrl += `?${query}`;

  const options = {
    method: event.httpMethod,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  };

  if (!["GET", "HEAD"].includes(event.httpMethod) && event.body) {
    options.body = event.body;
  }

  try {
    const airtableResponse = await fetch(airtableUrl, options);
    const text = await airtableResponse.text();

    return {
      statusCode: airtableResponse.status,
      headers: corsHeaders(airtableResponse.headers.get("content-type") || "application/json"),
      body: text
    };
  } catch (error) {
    return response(500, { error: error.message || "Airtable proxy error." });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders("application/json"),
    body: JSON.stringify(body)
  };
}

function corsHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS"
  };
}