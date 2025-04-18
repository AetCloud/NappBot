const fetch = require("node-fetch");

const DEFAULT_BLACKLIST = [
  "loli",
  "shota",
  "cub",
  "toddlercon",
  "gore",
  "scat",
  "vore",
];

const API_HEADERS = { "User-Agent": "NappBot/1.0" };

async function fetchRule34Images(tags = [], count = 10) {
  if (tags.length === 0) tags.push("score:>100");

  const query = [...tags, ...DEFAULT_BLACKLIST.map((tag) => `-${tag}`)].join(
    "+"
  );
  const url = `https://cloud.rule34.xxx/posts?limit=100&tags=${query}`;

  try {
    const response = await fetch(url, { method: "GET", headers: API_HEADERS });

    if (!response.ok)
      throw new Error(`Rule34 API error: ${response.statusText}`);

    const data = await response.json();
    if (!data?.length) return null;

    return [...data]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(count, data.length))
      .map((post) => ({
        postId: post.id,
        postUrl: `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`,
        imageUrl: post.file_url || null,
        thumbnail: post.preview_url || null,
        tags: post.tags || [],
        score: post.score || 0,
      }));
  } catch (error) {
    console.error("❌ Error fetching images from Rule34:", error.message);
    return null;
  }
}

module.exports = { fetchRule34Images };
