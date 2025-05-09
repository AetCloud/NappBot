const fetch = require("node-fetch");

const DEFAULT_BLACKLIST = [
  "cub",
  "toddlercon",
  "shota",
  "loli",
  "gore",
  "scat",
  "watersports",
  "vore",
];

const API_HEADERS = { "User-Agent": "NappBot/1.0 (by Napp on e621)" };

async function fetchE621Images(tags = [], count = 10) {
  const apiKey = process.env.E621_API_KEY;
  if (!apiKey) {
    console.error("❌ Missing E621 API Key!");
    return null;
  }

  if (tags.length === 0) tags.push("score:>=100");

  const query = [...tags, ...DEFAULT_BLACKLIST.map((tag) => `-${tag}`)].join(
    "+"
  );
  const url = `https://e621.net/posts.json?tags=${query}&limit=100`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...API_HEADERS,
        Authorization: `Basic ${Buffer.from(`Napp:${apiKey}`).toString(
          "base64"
        )}`,
      },
    });

    if (!response.ok) throw new Error(`e621 API error: ${response.statusText}`);

    const data = await response.json();
    if (!data.posts?.length) return null;

    return [...data.posts]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(count, data.posts.length))
      .map((post) => ({
        postId: post.id,
        postUrl: `https://e621.net/posts/${post.id}`,
        imageUrl: post.file?.url || null,
        thumbnail: post.preview?.url || null,
        artists: post.tags?.artist?.length ? post.tags.artist : ["Unknown"],
        characters: post.tags?.character?.slice(0, 3) || [
          "No characters tagged",
        ],
        score: post.score?.total || 0,
        favCount: post.fav_count || 0,
      }));
  } catch (error) {
    console.error("❌ Error fetching images from e621:", error.message);
    return null;
  }
}

async function fetchE621User(username) {
  const apiKey = process.env.E621_API_KEY;
  if (!apiKey) {
    console.error("❌ Missing E621 API Key!");
    return null;
  }

  const url = `https://e621.net/users.json?search[name_matches]=${username}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...API_HEADERS,
        Authorization: `Basic ${Buffer.from(`Napp:${apiKey}`).toString(
          "base64"
        )}`,
      },
    });

    if (!response.ok) throw new Error(`e621 API error: ${response.statusText}`);

    const data = await response.json();
    if (!data?.length) return null;

    const user = data[0];

    return {
      id: user.id,
      username: user.name,
      joined: new Date(user.created_at).toDateString(),
      uploads: user.post_upload_count || 0,
      tagEdits: user.tag_edit_count || 0,
      favorites: user.favorite_count || 0,
      notes: user.note_update_count || 0,
    };
  } catch (error) {
    console.error("❌ Error fetching e621 user data:", error.message);
    return null;
  }
}

async function getE621PostId(imageUrl) {
  if (!imageUrl.includes("e621.net")) return null;

  const apiKey = process.env.E621_API_KEY;
  if (!apiKey) {
    console.error("❌ Missing E621 API Key!");
    return null;
  }

  const md5Hash = imageUrl.split("/").pop().split(".")[0];
  const url = `https://e621.net/posts.json?tags=md5:${md5Hash}&limit=1`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...API_HEADERS,
        Authorization: `Basic ${Buffer.from(`Napp:${apiKey}`).toString(
          "base64"
        )}`,
      },
    });

    if (!response.ok) throw new Error(`e621 API error: ${response.statusText}`);

    const data = await response.json();
    return data.posts?.[0]?.id || null;
  } catch (error) {
    console.error("❌ Error fetching e621 post ID:", error.message);
    return null;
  }
}

module.exports = { fetchE621Images, fetchE621User, getE621PostId };
