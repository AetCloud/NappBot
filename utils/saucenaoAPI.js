const fetch = require("node-fetch");
const FormData = require("form-data");

const SAUCENAO_API_URL = "https://saucenao.com/search.php";

/**
 * Searches for an image  using  SauceNAO API.
 * @param {string} apiKey - SauceNAO API key.
 * @param {string} imageUrl - The URL of the image to search.
 * @param {number} numResults - Number of results to request.
 * @param {number} hideLevel - Controls result hiding (0-3). 0=show all.
 * @param {string} dbMask - Bitmask for enabling specific indexes.
 * @returns {Promise<object|null>} The API response or null on error.
 */
async function searchSauceNaoByUrl(
  apiKey,
  imageUrl,
  numResults = 5,
  hideLevel = 0,
  dbMask = "999"
) {
  if (!apiKey || !imageUrl) {
    console.error("SauceNAO API key and Image URL are required.");
    return null;
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    output_type: 2,
    url: imageUrl,
    numres: numResults,
    hide: hideLevel,
    db: dbMask,
  });

  try {
    const response = await fetch(`${SAUCENAO_API_URL}?${params.toString()}`, {
      method: "GET",
      headers: { "User-Agent": "NappBot/1.0" },
    });

    if (!response.ok) {
      console.error(
        `SauceNAO API error: ${response.status} ${response.statusText}`
      );
      try {
        const errorData = await response.json();
        console.error("SauceNAO API Error Body:", errorData);
        if (errorData && errorData.header && errorData.header.message) {
          throw new Error(`SauceNAO: ${errorData.header.message}`);
        }
      } catch (e) {}
      throw new Error(
        `SauceNAO API request failed with status ${response.status}`
      );
    }

    const data = await response.json();

    if (data.header && data.header.status < 0) {
      console.error(
        "SauceNAO API returned client-side error:",
        data.header.message || "Unknown client error"
      );
      throw new Error(data.header.message || "SauceNAO client-side error.");
    }
    if (data.header && data.header.status > 0) {
      console.warn(
        "SauceNAO API returned server-side warning/error:",
        data.header.message || "Unknown server error"
      );
    }

    return data;
  } catch (error) {
    console.error("Error fetching from SauceNAO:", error);
    throw error;
  }
}

/**
 * Searches for an image source using SauceNAO API by uploading a file.
 * @param {string} apiKey - SauceNAO API key.
 * @param {Buffer} imageBuffer - The buffer of the image to search.
 * @param {string} fileName - The name of the file.
 * @param {number} numResults - Number of results to request.
 * @param {number} hideLevel - Controls result hiding (0-3). 0=show all.
 * @param {string} dbMask - Bitmask for enabling specific indexes.
 * @returns {Promise<object|null>} The API response or null on error.
 */
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
      "SauceNAO API key, image buffer, and file name are required."
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
      headers: { ...form.getHeaders(), "User-Agent": "NappBot/1.0" },
    });

    if (!response.ok) {
      console.error(
        `SauceNAO API error (file upload): ${response.status} ${response.statusText}`
      );
      try {
        const errorData = await response.json();
        console.error("SauceNAO API Error Body (file upload):", errorData);
        if (errorData && errorData.header && errorData.header.message) {
          throw new Error(`SauceNAO: ${errorData.header.message}`);
        }
      } catch (e) {}
      throw new Error(
        `SauceNAO API request failed with status ${response.status} (file upload)`
      );
    }

    const data = await response.json();

    if (data.header && data.header.status < 0) {
      console.error(
        "SauceNAO API returned client-side error (file upload):",
        data.header.message || "Unknown client error"
      );
      throw new Error(
        data.header.message || "SauceNAO client-side error (file upload)."
      );
    }
    if (data.header && data.header.status > 0) {
      console.warn(
        "SauceNAO API returned server-side warning/error (file upload):",
        data.header.message || "Unknown server error"
      );
    }

    return data;
  } catch (error) {
    console.error("Error fetching from SauceNAO (file upload):", error);
    throw error;
  }
}

module.exports = {
  searchSauceNaoByUrl,
  searchSauceNaoByFile,
};
