const fetch = require("node-fetch");
const FormData = require("form-data");

const SAUCENAO_API_URL = "https://saucenao.com/search.php";

async function searchSauceNaoByUrl(
  apiKey,
  imageUrl,
  numResults = 5,
  hideLevel = 0,
  dbMask = "999"
) {
  if (!apiKey || !imageUrl) {
    console.error("[SauceNAO API] API key and Image URL are required.");
    return null;
  }

  const params = new URLSearchParams({
    output_type: 2,
    url: imageUrl,
    numres: numResults,
    hide: hideLevel,
    db: dbMask,
  });

  const fullUrl = `${SAUCENAO_API_URL}?api_key=${encodeURIComponent(
    apiKey
  )}&${params.toString()}`;
  const loggableUrl = `${SAUCENAO_API_URL}?${params.toString()}&api_key=REDACTED`;

  try {
    const response = await fetch(fullUrl, {
      method: "GET",
      headers: { "User-Agent": "NappBot/1.0 (SauceMessage Command)" },
    });

    if (!response.ok) {
      console.error(
        `[SauceNAO API] Error by URL: ${response.status} ${response.statusText}. Requested (key redacted): ${loggableUrl}`
      );
      let errorDataMessage = `SauceNAO API request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        console.error("[SauceNAO API] Error Body:", errorData);
        if (errorData && errorData.header && errorData.header.message) {
          errorDataMessage = `SauceNAO: ${errorData.header.message}`;
        }
      } catch (e) {}
      throw new Error(errorDataMessage);
    }

    const data = await response.json();

    if (data.header && data.header.status < 0) {
      const clientErrorMessage = data.header.message || "Unknown client error";
      console.error(`[SauceNAO API] Client-side error: ${clientErrorMessage}`);
      throw new Error(`SauceNAO: ${clientErrorMessage}`);
    }
    if (data.header && data.header.status > 0) {
      console.warn(
        `[SauceNAO API] Server-side warning/error: ${
          data.header.message || "Unknown server error"
        }`
      );
    }

    return data;
  } catch (error) {
    console.error(
      `[SauceNAO API] Fetch error for ${loggableUrl}:`,
      error.message
    );
    throw error;
  }
}

async function searchSauceNaoByFile(
  apiKey,
  imageBuffer,
  fileName,
  numResults = 5,
  hideLevel = 0,
  dbMask = "999"
) {
  if (!apiKey || !imageBuffer || !fileName) {
    console.error(
      "[SauceNAO API] API key, image buffer, and file name are required for file upload."
    );
    return null;
  }

  const form = new FormData();
  form.append("api_key", apiKey);
  form.append("output_type", 2);
  form.append("file", imageBuffer, { filename: fileName });
  form.append("numres", numResults);
  form.append("hide", hideLevel);
  form.append("db", dbMask);

  try {
    const response = await fetch(SAUCENAO_API_URL, {
      method: "POST",
      body: form,
      headers: {
        ...form.getHeaders(),
        "User-Agent": "NappBot/1.0 (SauceMessage Command)",
      },
    });

    if (!response.ok) {
      console.error(
        `[SauceNAO API] Error by File: ${response.status} ${response.statusText}. File: ${fileName}`
      );
      let errorDataMessage = `SauceNAO API request failed with status ${response.status} (file upload)`;
      try {
        const errorData = await response.json();
        console.error("[SauceNAO API] Error Body (file upload):", errorData);
        if (errorData && errorData.header && errorData.header.message) {
          errorDataMessage = `SauceNAO: ${errorData.header.message}`;
        }
      } catch (e) {}
      throw new Error(errorDataMessage);
    }

    const data = await response.json();

    if (data.header && data.header.status < 0) {
      const clientErrorMessage = data.header.message || "Unknown client error";
      console.error(
        `[SauceNAO API] Client-side error (file upload): ${clientErrorMessage}`
      );
      throw new Error(`SauceNAO: ${clientErrorMessage} (file upload).`);
    }
    if (data.header && data.header.status > 0) {
      console.warn(
        `[SauceNAO API] Server-side warning/error (file upload): ${
          data.header.message || "Unknown server error"
        }`
      );
    }
    return data;
  } catch (error) {
    console.error(
      `[SauceNAO API] Fetch error for file ${fileName}:`,
      error.message
    );
    throw error;
  }
}

module.exports = {
  searchSauceNaoByUrl,
  searchSauceNaoByFile,
};
